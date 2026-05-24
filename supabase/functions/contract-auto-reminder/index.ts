import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { 
  enviarMensagemZapi, 
  getZapiConfig, 
  sendText,
  gerarSubscriberId,
  normalizePhone 
} from '../_shared/zapi-helper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");

// Tenta obter um link de assinatura válido a partir do document_key.
// 1. V1 API: busca request_signature_key em /documents/{key}/lists
// 2. V3 API: busca signer.url em /envelopes/{key}/signers
// Retorna o link atual se ambas as tentativas falharem.
async function refreshContractLink(documentKey: string, currentLink: string): Promise<string> {
  if (!CLICKSIGN_API_KEY || !documentKey) return currentLink;

  try {
    const v1 = await fetch(
      `https://app.clicksign.com/api/v1/documents/${documentKey}/lists?access_token=${CLICKSIGN_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (v1.ok) {
      const data = await v1.json();
      const reqKey = (data?.lists || []).find((l: any) => l.request_signature_key)?.request_signature_key;
      if (reqKey) return `https://app.clicksign.com/sign/${reqKey}`;
    }
  } catch { /* tenta V3 */ }

  try {
    const v3 = await fetch(
      `https://app.clicksign.com/api/v3/envelopes/${documentKey}/signers`,
      { headers: { "Authorization": CLICKSIGN_API_KEY }, signal: AbortSignal.timeout(8000) }
    );
    if (v3.ok) {
      const data = await v3.json();
      const url = data?.data?.[0]?.attributes?.url;
      if (url) return url;
    }
  } catch { /* devolve o atual */ }

  return currentLink;
}

// Reminder schedule: 12h, 24h, 48h, 5d (in hours)
const REMINDER_INTERVALS_HOURS = [12, 24, 48, 120];
const REMINDER_STAGE_NAMES = ['12h', '24h', '48h', '5d'];

const CONTRACT_MESSAGES = {
  reminder_12h: (name: string, link: string) => 
    `Oi ${name}! 👋\n\nVi que seu contrato ainda está aguardando assinatura.\n\n🔗 Link para assinar: ${link}\n\nÉ bem rapidinho, leva menos de 2 minutos! 😊\n\n*Bentes & Ramos Advocacia*`,
  
  reminder_24h: (name: string, link: string) => 
    `${name}, bom dia! ☀️\n\nPassando para lembrar do seu contrato que aguarda assinatura desde ontem.\n\n🔗 Assine aqui: ${link}\n\nPrecisando de ajuda, é só chamar!\n\n*Bentes & Ramos Advocacia*`,
  
  reminder_48h: (name: string, link: string) => 
    `${name}, seu contrato precisa de atenção! ⚠️\n\nJá se passaram 2 dias e ainda não recebemos sua assinatura.\n\n🔗 Assine agora: ${link}\n\nPara darmos continuidade ao seu processo, *a assinatura é essencial*.\n\n*Bentes & Ramos Advocacia*`,
  
  reminder_5d: (name: string, link: string) => 
    `${name}, URGENTE! 🚨\n\nSeu contrato está pendente há 5 dias. *Sem a assinatura, não podemos iniciar os trabalhos.*\n\n🔗 ASSINE AGORA: ${link}\n\nPor favor, priorize isso hoje! Se houver algum problema ou dúvida, me avise.\n\n*Bentes & Ramos Advocacia*`,
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    
    console.log(`[Contract Reminder Z-API] Processing reminders at ${now.toISOString()}`);

    // Buscar todas as instâncias para roteamento por lead
    const { data: allInstances } = await supabase
      .from('zapi_instances')
      .select('instance_id, is_default, name, token, client_token, phone_number')
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    if (!allInstances || allInstances.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Z-API não configurado ou inativo' 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get pending reminders that are due (exclude any with signed_at already set)
    const { data: pendingReminders, error } = await supabase
      .from('contract_reminders')
      .select(`
        *,
        leads_juridicos!contract_reminders_lead_id_fkey(
          id, nome, telefone, status, lead_state, contract_signed_at, linha_whatsapp, tipo_origem
        )
      `)
      .eq('status', 'pending')
      .is('signed_at', null)
      .lte('next_reminder_at', now.toISOString())
      .lt('reminder_stage', 4)
      .order('next_reminder_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[Contract Reminder] Error fetching reminders:', error);
      throw error;
    }

    console.log(`[Contract Reminder] Found ${pendingReminders?.length || 0} pending reminders`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const reminder of pendingReminders || []) {
      const lead = reminder.leads_juridicos;
      
      // Skip if lead is already won/signed, or reminder itself is already signed
      const alreadySigned = reminder.signed_at != null;
      const leadAlreadySigned = lead && (
        lead.status === 'Ganho' || 
        lead.status === 'Contrato Assinado' ||
        lead.lead_state === 'CONTRACT_SIGNED' ||
        lead.lead_state === 'DOCS_PENDING' ||
        lead.lead_state === 'READY_FOR_LAWYER' ||
        lead.contract_signed_at
      );
      if (alreadySigned || leadAlreadySigned) {
        console.log(`[Contract Reminder] Skipping ${reminder.document_key} - lead already signed/won`);
        
        await supabase
          .from('contract_reminders')
          .update({ status: 'signed', next_reminder_at: null, updated_at: now.toISOString() })
          .eq('id', reminder.id);
        
        skipped++;
        continue;
      }

      // Verificar se lead tem telefone
      if (!lead?.telefone) {
        console.log(`[Contract Reminder] No phone for ${reminder.document_key}`);
        skipped++;
        continue;
      }

      // Determine message based on stage
      const stage = reminder.reminder_stage;
      const stageName = REMINDER_STAGE_NAMES[stage] || '12h';
      const clientName = lead?.nome?.split(' ')[0] || reminder.signer_name?.split(' ')[0] || 'Cliente';
      const contractLink = await refreshContractLink(reminder.document_key, reminder.contract_link);

      // Se o link foi atualizado, persiste para não repetir o fetch nos próximos lembretes
      if (contractLink !== reminder.contract_link) {
        await supabase.from('contract_reminders').update({ contract_link: contractLink }).eq('id', reminder.id);
        console.log(`[Contract Reminder] 🔗 Link atualizado: ${contractLink}`);
      }

      let message = '';
      switch (stage) {
        case 0: message = CONTRACT_MESSAGES.reminder_12h(clientName, contractLink); break;
        case 1: message = CONTRACT_MESSAGES.reminder_24h(clientName, contractLink); break;
        case 2: message = CONTRACT_MESSAGES.reminder_48h(clientName, contractLink); break;
        case 3: message = CONTRACT_MESSAGES.reminder_5d(clientName, contractLink); break;
      }

      // REGRA ABSOLUTA: tipo_origem é a fonte de verdade; phone_number é a seleção primária
      const PHONE_TRAFEGO    = '5592985888190'; // (92) 98588-8190 — "Bentes Ramos Trafego"
      const PHONE_ESCRITORIO = '5592991604348'; // (92) 99160-4348 — "Bentes Ramos"
      const isTrafego = lead.tipo_origem === 'trafego' || lead.tipo_origem === 'trafego_isa' ||
                        lead.linha_whatsapp === 'trafego_isa' || lead.linha_whatsapp === 'trafego';
      const targetPhone = isTrafego ? PHONE_TRAFEGO : PHONE_ESCRITORIO;
      const byPhone = allInstances.find((i: any) => i.phone_number?.replace(/\D/g, '') === targetPhone);
      const byFlag  = isTrafego
        ? allInstances.find((i: any) => !i.is_default) || allInstances[0]
        : allInstances.find((i: any) => i.is_default) || allInstances[0];
      const target = byPhone || byFlag;
      const zapiConfig = {
        instance_id: target.instance_id,
        token: target.token,
        client_token: target.client_token,
        name: target.name,
        phone_number: target.phone_number,
      };

      // Enviar via Z-API pela instância correta
      const result = await sendText(zapiConfig, lead.telefone, message);

      if (result.success) {
        console.log(`[Contract Reminder] ✅ Sent ${stageName} via Z-API for ${reminder.document_key}`);

        // Calculate next reminder
        const nextStage = stage + 1;
        let nextReminderAt = null;
        let newStatus = 'pending';
        
        if (nextStage < REMINDER_INTERVALS_HOURS.length) {
          const hoursUntilNext = REMINDER_INTERVALS_HOURS[nextStage] - REMINDER_INTERVALS_HOURS[stage];
          nextReminderAt = new Date(now.getTime() + hoursUntilNext * 60 * 60 * 1000).toISOString();
        } else {
          newStatus = `sent_${stageName}`;
        }

        // Update reminder record
        await supabase
          .from('contract_reminders')
          .update({
            reminder_stage: nextStage,
            last_reminder_at: now.toISOString(),
            next_reminder_at: nextReminderAt,
            status: newStatus,
            updated_at: now.toISOString(),
          })
          .eq('id', reminder.id);

        // Record in manychat_mensagens (usando tabela existente como histórico unificado)
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: gerarSubscriberId(lead.telefone),
          lead_id: lead.id,
          conteudo: message,
          direcao: 'saida',
          tipo: 'text',
          subscriber_nome: lead.nome || 'Cliente',
          canal: 'whatsapp',
          metadata: { source: 'zapi', context: 'contract_auto_reminder', stage: stageName }
        });

        // Record interaction
        await supabase.from('interacoes').insert({
          cliente_id: lead.id,
          tipo: 'WhatsApp',
          resumo: `Cobrança automática de contrato (${stageName}) via Z-API`,
          detalhes: `Mensagem automática enviada para cobrar assinatura do contrato. Estágio: ${stageName}. Link: ${contractLink}`,
          direcao: 'Saída',
        });

        // Log system event
        await supabase.from('system_events').insert({
          tipo: 'contrato',
          acao: `auto_reminder_${stageName}`,
          fonte: 'zapi-contract-reminder',
          lead_id: lead?.id,
          dados: {
            document_key: reminder.document_key,
            stage: stage,
            stage_name: stageName,
            provider: 'zapi',
            phone: normalizePhone(lead.telefone)
          }
        });

        sent++;
      } else {
        console.log(`[Contract Reminder] ❌ Failed for ${reminder.document_key}: ${result.error}`);
        failed++;
      }
    }

    const summary = {
      processed: pendingReminders?.length || 0,
      sent,
      skipped,
      failed,
      provider: 'zapi',
      timestamp: now.toISOString(),
    };

    console.log('[Contract Reminder] Summary:', summary);

    return new Response(JSON.stringify({ success: true, ...summary }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error('[Contract Reminder] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
