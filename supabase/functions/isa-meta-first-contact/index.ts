// supabase/functions/isa-meta-first-contact/index.ts
// Dispara primeiro contato da ISA para leads novos de tráfego (Meta/Sheets)
// Cria subscriber para que isa-auto-process processe as respostas

const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Instância de tráfego Z-API
const ZAPI_INSTANCE = '3EDDF959BC2B81F86B410203B614D70E';
const ZAPI_TOKEN    = 'EB4D1716F4FB661310E9DE33';
const ZAPI_BASE     = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;

// ── Normaliza telefone para formato internacional ──────────────────────────
function normalizarTelefone(tel: string): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

// ── Envia texto via Z-API ──────────────────────────────────────────────────
async function enviarTexto(telefone: string, mensagem: string): Promise<{ success: boolean; messageId?: string }> {
  try {
    const res = await fetch(`${ZAPI_BASE}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: telefone, message: mensagem }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('[ZAPI] Erro:', data.error || res.status);
      return { success: false };
    }
    return { success: true, messageId: data.messageId || data.id };
  } catch (err) {
    console.error('[ZAPI] Exception:', err);
    return { success: false };
  }
}

// ── Monta mensagem de primeiro contato ────────────────────────────────────
// Genérica — a ISA vai fazer a triagem nas próximas mensagens
function montarMensagem(nome: string | null, campaignName: string | null): string {
  const primeiro = nome?.split(' ')[0]?.trim() || '';
  
  // Tenta inferir área pela campanha
  const campLower = (campaignName || '').toLowerCase();
  const isBancario = campLower.includes('banco') || campLower.includes('bancari') || 
                     campLower.includes('consignado') || campLower.includes('juros') ||
                     campLower.includes('financ') || campLower.includes('cartao') ||
                     campLower.includes('empréstimo') || campLower.includes('emprestimo');
  const isAereo = campLower.includes('voo') || campLower.includes('aere') || 
                  campLower.includes('companhia') || campLower.includes('bagagem') ||
                  campLower.includes('cancelad') || campLower.includes('atraso');

  if (isBancario) {
    return `Olá${primeiro ? `, ${primeiro}` : ''}! Sou a Isa do Bentes & Ramos. 😊\n\nVi que você tem uma questão bancária. Qual banco ou financeira está envolvida?`;
  }

  if (isAereo) {
    return `Olá${primeiro ? `, ${primeiro}` : ''}! Sou a Isa do Bentes & Ramos. 😊\n\nVi que você tem uma questão com voo. Qual companhia aérea e o que aconteceu?`;
  }

  // Genérico — deixa a triagem fazer o trabalho
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Sou a Isa do Bentes & Ramos. 😊\n\nAtendemos problemas bancários e aéreos em todo o Brasil. Pode me contar qual é a sua situação?`;
}

// ── Handler principal ──────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    
    // Aceita lead_id direto ou lead_ids (lote)
    const leadIds: string[] = body.lead_ids || (body.lead_id ? [body.lead_id] : []);
    const dryRun: boolean = body.dry_run || false;
    const intervaloSegundos: number = body.intervalo_segundos || 10;

    if (leadIds.length === 0) {
      return new Response(JSON.stringify({ error: 'lead_id ou lead_ids é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads_juridicos')
      .select('id, nome, telefone, email, status, tipo_origem, fonte_trafego, linha_whatsapp, isa_ativa')
      .in('id', leadIds);

    if (leadsError) throw new Error(`Erro ao buscar leads: ${leadsError.message}`);

    const resultados: any[] = [];
    let enviados = 0;
    let ignorados = 0;
    let erros = 0;

    for (let i = 0; i < (leads || []).length; i++) {
      const lead = leads![i];

      try {
        // Verifica se já recebeu primeiro contato
        const { data: jaContatado } = await supabase
          .from('lead_followups')
          .select('id, primeiro_contato_em')
          .eq('lead_id', lead.id)
          .maybeSingle();

        if (jaContatado?.primeiro_contato_em) {
          console.log(`[ISA First Contact] Lead ${lead.nome} já teve primeiro contato. Ignorando.`);
          ignorados++;
          resultados.push({ id: lead.id, nome: lead.nome, status: 'ignorado', motivo: 'ja_contatado' });
          continue;
        }

        // Verifica telefone
        const telefone = normalizarTelefone(lead.telefone);
        if (!telefone) {
          console.log(`[ISA First Contact] Lead ${lead.nome} sem telefone válido.`);
          ignorados++;
          resultados.push({ id: lead.id, nome: lead.nome, status: 'ignorado', motivo: 'sem_telefone' });
          continue;
        }

        // Busca dados da campanha do meta_form_leads (se existir)
        const { data: metaLead } = await supabase
          .from('meta_form_leads')
          .select('campaign_name, ad_name, form_id')
          .eq('linked_lead_id', lead.id)
          .maybeSingle();

        const mensagem = montarMensagem(lead.nome, metaLead?.campaign_name || null);
        const subscriberId = `zapi_${telefone}`;

        console.log(`[ISA First Contact] [${i + 1}/${leads!.length}] ${lead.nome} (${telefone})`);

        if (dryRun) {
          resultados.push({ id: lead.id, nome: lead.nome, telefone, mensagem, status: 'dry_run' });
          continue;
        }

        // Envia mensagem
        const result = await enviarTexto(telefone, mensagem);

        if (result.success) {
          enviados++;

          // Cria subscriber para isa-auto-process processar respostas
          await supabase.from('manychat_subscribers').upsert({
            subscriber_id: subscriberId,
            nome: lead.nome || 'Lead',
            telefone: lead.telefone,
            lead_id: lead.id,
            canal: 'whatsapp',
            linha_whatsapp: 'trafego_isa',
            isa_ativa: true,
            atendimento_humano: false,
            ultima_interacao: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'subscriber_id', ignoreDuplicates: false });

          // Salva mensagem no histórico
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: 'Isa do Bentes & Ramos',
            lead_id: lead.id,
            conteudo: mensagem,
            direcao: 'saida',
            tipo: 'text',
            canal: 'whatsapp',
            metadata: {
              source: 'isa_meta_first_contact',
              message_id: result.messageId,
              campaign_name: metaLead?.campaign_name || null,
            },
          });

          // Registra interação
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            direcao: 'Saída',
            resumo: 'Primeiro contato ISA - Lead tráfego',
            detalhes: mensagem.substring(0, 200),
          });

          // Atualiza lead
          await supabase.from('leads_juridicos').update({
            status: 'Em Atendimento',
            last_contact_at: new Date().toISOString(),
            linha_whatsapp: 'trafego_isa',
            isa_ativa: true,
          }).eq('id', lead.id);

          // Cria/atualiza lead_followups
          await supabase.from('lead_followups').upsert({
            lead_id: lead.id,
            primeiro_contato_em: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_isa_outbound_at: new Date().toISOString(),
            status: 'aguardando',
            waiting_reply: true,
            canal: 'whatsapp',
            subscriber_id: subscriberId,
            respondido: false,
          }, { onConflict: 'lead_id' });

          // Registra evento no sistema
          await supabase.from('system_events').insert({
            tipo: 'primeiro_contato',
            fonte: 'isa_meta_first_contact',
            acao: 'primeiro_contato_enviado',
            lead_id: lead.id,
            dados: {
              telefone,
              subscriber_id: subscriberId,
              campaign_name: metaLead?.campaign_name || null,
              message_id: result.messageId,
            },
            processado: true,
          });

          resultados.push({ id: lead.id, nome: lead.nome, telefone, status: 'enviado', message_id: result.messageId });
          console.log(`[ISA First Contact] ✅ ${lead.nome}`);

        } else {
          erros++;
          resultados.push({ id: lead.id, nome: lead.nome, status: 'erro', motivo: 'falha_envio_zapi' });
          console.error(`[ISA First Contact] ❌ ${lead.nome}`);
        }

        // Intervalo entre envios para evitar bloqueio
        if (i < leads!.length - 1) {
          await new Promise(r => setTimeout(r, intervaloSegundos * 1000));
        }

      } catch (err: any) {
        erros++;
        resultados.push({ id: lead.id, nome: lead.nome, status: 'erro', motivo: err.message });
        console.error(`[ISA First Contact] ❌ Erro em ${lead.nome}:`, err.message);
      }
    }

    console.log(`[ISA First Contact] Concluído — Enviados: ${enviados}, Ignorados: ${ignorados}, Erros: ${erros}`);

    return new Response(JSON.stringify({
      success: true,
      total: leads?.length || 0,
      enviados,
      ignorados,
      erros,
      resultados,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[ISA First Contact] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
