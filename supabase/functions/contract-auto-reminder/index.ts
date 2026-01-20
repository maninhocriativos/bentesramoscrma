import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MANYCHAT_API_URL = 'https://api.manychat.com';

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

async function sendManyChatMessage(
  subscriberId: string,
  message: string
): Promise<boolean> {
  const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');
  
  if (!MANYCHAT_API_KEY) {
    console.log('[Contract Reminder] MANYCHAT_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch(`${MANYCHAT_API_URL}/fb/sending/sendContent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: parseInt(subscriberId),
        data: {
          version: 'v2',
          content: {
            messages: [{ type: 'text', text: message }],
          },
        },
      }),
    });

    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error('[Contract Reminder] Error:', error);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    
    console.log(`[Contract Reminder] Processing reminders at ${now.toISOString()}`);

    // Get pending reminders that are due
    const { data: pendingReminders, error } = await supabase
      .from('contract_reminders')
      .select(`
        *,
        leads_juridicos!contract_reminders_lead_id_fkey(
          id, nome, telefone, status, lead_state
        )
      `)
      .eq('status', 'pending')
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
      
      // Skip if lead is already won or contract signed
      if (lead && (lead.status === 'Ganho' || lead.lead_state === 'CONTRACT_SIGNED')) {
        console.log(`[Contract Reminder] Skipping ${reminder.document_key} - lead already won`);
        
        await supabase
          .from('contract_reminders')
          .update({ status: 'signed', updated_at: now.toISOString() })
          .eq('id', reminder.id);
        
        skipped++;
        continue;
      }

      // Get subscriber for sending message
      let subscriber = null;
      if (lead) {
        const { data: sub } = await supabase
          .from('manychat_subscribers')
          .select('subscriber_id, nome')
          .eq('lead_id', lead.id)
          .single();
        subscriber = sub;
      }

      if (!subscriber) {
        console.log(`[Contract Reminder] No subscriber found for ${reminder.document_key}`);
        skipped++;
        continue;
      }

      // Determine message based on stage
      const stage = reminder.reminder_stage;
      const stageName = REMINDER_STAGE_NAMES[stage] || '12h';
      const clientName = lead?.nome?.split(' ')[0] || reminder.signer_name?.split(' ')[0] || 'Cliente';
      const contractLink = reminder.contract_link;

      let message = '';
      switch (stage) {
        case 0: message = CONTRACT_MESSAGES.reminder_12h(clientName, contractLink); break;
        case 1: message = CONTRACT_MESSAGES.reminder_24h(clientName, contractLink); break;
        case 2: message = CONTRACT_MESSAGES.reminder_48h(clientName, contractLink); break;
        case 3: message = CONTRACT_MESSAGES.reminder_5d(clientName, contractLink); break;
      }

      // Send message
      const success = await sendManyChatMessage(subscriber.subscriber_id, message);

      if (success) {
        console.log(`[Contract Reminder] Sent ${stageName} reminder for ${reminder.document_key}`);

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

        // Record in manychat_mensagens
        if (lead) {
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriber.subscriber_id,
            lead_id: lead.id,
            conteudo: message,
            direcao: 'saida',
            tipo: 'text',
            subscriber_nome: subscriber.nome,
          });

          // Record interaction
          await supabase.from('interacoes').insert({
            cliente_id: lead.id,
            tipo: 'WhatsApp',
            resumo: `Cobrança automática de contrato (${stageName})`,
            detalhes: `Mensagem automática enviada para cobrar assinatura do contrato. Estágio: ${stageName}. Link: ${contractLink}`,
            direcao: 'Saída',
          });
        }

        // Log system event
        await supabase.from('system_events').insert({
          tipo: 'contrato',
          acao: `auto_reminder_${stageName}`,
          fonte: 'contract-auto-reminder',
          lead_id: lead?.id,
          dados: {
            document_key: reminder.document_key,
            stage: stage,
            stage_name: stageName,
            subscriber_id: subscriber.subscriber_id,
          }
        });

        sent++;
      } else {
        console.log(`[Contract Reminder] Failed to send for ${reminder.document_key}`);
        failed++;
      }
    }

    const summary = {
      processed: pendingReminders?.length || 0,
      sent,
      skipped,
      failed,
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
