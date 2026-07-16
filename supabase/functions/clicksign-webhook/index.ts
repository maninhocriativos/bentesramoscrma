import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Z-API routing constants (REGRA ABSOLUTA)
const PHONE_TRAFEGO    = '5592985888190'; // (92) 98588-8190 — "Bentes Ramos Trafego"
const PHONE_ESCRITORIO = '5592991604348'; // (92) 99160-4348 — "Bentes Ramos"

const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");
const CLICKSIGN_BASE_URL = "https://app.clicksign.com/api/v1";

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error: any) {
      lastError = error;
      const msg = String(error?.message || error);
      const isRetryable =
        msg.includes('http2 error') ||
        msg.includes('connection error') ||
        msg.includes('SendRequest') ||
        msg.includes('ECONNRESET');

      if (!isRetryable || attempt === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Clicksign Webhook] Retry ${attempt + 1}/${maxRetries} after ${delay}ms due to: ${msg}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isBadClicksignLink(link: string | null | undefined, documentKey?: string | null) {
  if (!link) return true;
  // Qualquer link que não seja /sign/{request_signature_key} é ruim — inclui o
  // fallback /document/{key} (exige login no ClickSign, quebra para o cliente)
  // e não só o caso antigo de /sign/{documentKey} com a chave errada.
  if (!link.includes('/sign/')) return true;
  if (!documentKey) return false;
  return link.includes(`/sign/${documentKey}`);
}

async function resolveClicksignSignerLink(documentKey: string): Promise<string | null> {
  if (!CLICKSIGN_API_KEY) return null;

  try {
    const response = await fetchWithRetry(
      `${CLICKSIGN_BASE_URL}/documents/${documentKey}?access_token=${CLICKSIGN_API_KEY}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const txt = await response.text();
      console.error(`[Clicksign Webhook] Clicksign get_document failed [${response.status}]: ${txt.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const doc = data?.document || data;
    const lists = doc?.lists || doc?.document?.lists;

    const requestKey: string | undefined = lists?.[0]?.request_signature_key;
    if (!requestKey) return null;

    return `https://app.clicksign.com/sign/${requestKey}`;
  } catch (err) {
    console.error('[Clicksign Webhook] Error resolving signer link:', err);
    return null;
  }
}

// Reminder schedule: 12h, 24h, 48h, 5d
const REMINDER_INTERVALS_HOURS = [12, 24, 48, 120]; // 120 = 5 days

// Messages for contract status
const CONTRACT_MESSAGES = {
  created: (clientName: string, contractLink: string) => 
    `Olá ${clientName}! 📄✨\n\n` +
    `Ótimas notícias! Seu contrato foi gerado e está pronto para assinatura.\n\n` +
    `🔗 Acesse aqui para assinar: ${contractLink}\n\n` +
    `A assinatura é digital, rápida e segura. Qualquer dúvida, estou à disposição!\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  reminder_12h: (clientName: string, contractLink: string) => 
    `Oi ${clientName}! 👋\n\n` +
    `Vi que seu contrato ainda está aguardando assinatura.\n\n` +
    `🔗 Link para assinar: ${contractLink}\n\n` +
    `É bem rapidinho, leva menos de 2 minutos! 😊\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  reminder_24h: (clientName: string, contractLink: string) => 
    `${clientName}, bom dia! ☀️\n\n` +
    `Passando para lembrar do seu contrato que aguarda assinatura desde ontem.\n\n` +
    `🔗 Assine aqui: ${contractLink}\n\n` +
    `Precisando de ajuda, é só chamar!\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  reminder_48h: (clientName: string, contractLink: string) => 
    `${clientName}, seu contrato precisa de atenção! ⚠️\n\n` +
    `Já se passaram 2 dias e ainda não recebemos sua assinatura.\n\n` +
    `🔗 Assine agora: ${contractLink}\n\n` +
    `Para darmos continuidade ao seu processo, *a assinatura é essencial*.\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  reminder_5d: (clientName: string, contractLink: string) => 
    `${clientName}, URGENTE! 🚨\n\n` +
    `Seu contrato está pendente há 5 dias. *Sem a assinatura, não podemos iniciar os trabalhos.*\n\n` +
    `🔗 ASSINE AGORA: ${contractLink}\n\n` +
    `Por favor, priorize isso hoje! Se houver algum problema ou dúvida, me avise.\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  signed: (clientName: string) => 
    `Perfeito, ${clientName}! ✅🎉\n\n` +
    `Recebemos sua assinatura com sucesso!\n\n` +
    `Nossa equipe jurídica já está ciente e daremos início aos procedimentos.\n\n` +
    `Fique tranquilo(a), manteremos você informado(a) sobre cada etapa.\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  finalized: (clientName: string) => 
    `${clientName}, tudo certo! 📋✨\n\n` +
    `O contrato foi finalizado e todas as assinaturas foram coletadas.\n\n` +
    `Você receberá uma cópia do documento por e-mail.\n\n` +
    `Nossa equipe já está trabalhando no seu caso! 💼\n\n` +
    `*Bentes & Ramos Advocacia*`,
};

async function sendZapiMessage(
  supabase: any,
  tipoOrigem: string | null | undefined,
  telefone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const isTrafego = tipoOrigem === 'trafego' || tipoOrigem === 'trafego_isa';
  const targetPhone = isTrafego ? PHONE_TRAFEGO : PHONE_ESCRITORIO;
  const { data: instances } = await supabase
    .from('zapi_instances')
    .select('instance_id, token, client_token, phone_number, is_default')
    .eq('is_active', true);
  const byPhone = (instances || []).find((i: any) => i.phone_number?.replace(/\D/g, '') === targetPhone);
  const byFlag  = isTrafego
    ? (instances || []).find((i: any) => !i.is_default)
    : (instances || []).find((i: any) => i.is_default);
  const inst = byPhone || byFlag || (instances || [])[0];
  if (!inst) return { success: false, error: 'Nenhuma instância Z-API ativa' };
  let cleanPhone = telefone.replace(/\D/g, '');
  if (cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (inst.client_token) headers['Client-Token'] = inst.client_token;
  try {
    console.log(`[Clicksign] Sending Z-API message via ${inst.phone_number} to ${cleanPhone}`);
    const response = await fetch(
      `https://api.z-api.io/instances/${inst.instance_id}/token/${inst.token}/send-text`,
      { method: 'POST', headers, body: JSON.stringify({ phone: cleanPhone, message }) },
    );
    if (response.ok) {
      console.log('[Clicksign] Z-API message sent successfully');
      return { success: true };
    }
    const err = await response.text();
    return { success: false, error: err };
  } catch (error) {
    console.error('[Clicksign] Error sending Z-API:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function findLeadByConversationAnalysis(
  supabase: any,
  documentName: string,
  signerEmail?: string,
  signerPhone?: string,
  signerName?: string
): Promise<{ lead: any; subscriber: any } | null> {
  console.log('[Clicksign] Finding lead by conversation analysis...');
  
  // Strategy 1: Search by signer phone in manychat_subscribers
  if (signerPhone) {
    const cleanPhone = signerPhone.replace(/\D/g, '');
    const { data: subscribers } = await supabase
      .from('manychat_subscribers')
      .select('*, leads_juridicos(*)')
      .or(`telefone.ilike.%${cleanPhone}%,telefone.ilike.%${cleanPhone.slice(-9)}%`)
      .limit(5);
    
    if (subscribers && subscribers.length > 0) {
      const sub = subscribers[0];
      if (sub.lead_id && sub.leads_juridicos) {
        console.log(`[Clicksign] Found lead via phone: ${sub.leads_juridicos.nome}`);
        return { lead: sub.leads_juridicos, subscriber: sub };
      }
    }
  }

  // Strategy 2: Search by signer name in recent messages
  const nameParts = (signerName || documentName)
    .replace(/^Documento\s*-?\s*/i, '')
    .replace(/\.[^/.]+$/, '')
    .split(' ')
    .filter((t: string) => t.length > 2)
    .slice(0, 2);

  if (nameParts.length > 0) {
    // Search in recent messages for name mentions
    const { data: messages } = await supabase
      .from('manychat_mensagens')
      .select('subscriber_id, lead_id, subscriber_nome, conteudo')
      .order('created_at', { ascending: false })
      .limit(500);

    if (messages) {
      // Look for messages that mention the signer name
      for (const msg of messages) {
        const content = (msg.conteudo || '').toLowerCase();
        const subName = (msg.subscriber_nome || '').toLowerCase();
        
        // Check if content or subscriber name matches
        const matches = nameParts.every((part: string) => 
          content.includes(part.toLowerCase()) || subName.includes(part.toLowerCase())
        );
        
        if (matches && msg.lead_id) {
          const { data: lead } = await supabase
            .from('leads_juridicos')
            .select('*')
            .eq('id', msg.lead_id)
            .single();
          
          const { data: subscriber } = await supabase
            .from('manychat_subscribers')
            .select('*')
            .eq('subscriber_id', msg.subscriber_id)
            .single();
          
          if (lead && subscriber) {
            console.log(`[Clicksign] Found lead via message analysis: ${lead.nome}`);
            return { lead, subscriber };
          }
        }
      }
    }

    // Strategy 3: Direct lead name search
    const { data: leads } = await supabase
      .from('leads_juridicos')
      .select('*')
      .or(nameParts.map((p: string) => `nome.ilike.%${p}%`).join(','))
      .limit(5);

    if (leads && leads.length > 0) {
      // Find the best matching lead
      for (const lead of leads) {
        const { data: subscriber } = await supabase
          .from('manychat_subscribers')
          .select('*')
          .eq('lead_id', lead.id)
          .single();
        
        if (subscriber) {
          console.log(`[Clicksign] Found lead via name search: ${lead.nome}`);
          return { lead, subscriber };
        }
      }
    }
  }

  console.log('[Clicksign] No lead found via conversation analysis');
  return null;
}

async function createOrUpdateContractReminder(
  supabase: any,
  documentKey: string,
  documentName: string,
  contractLink: string,
  leadId: string | null,
  signerEmail: string | null,
  signerPhone: string | null,
  signerName: string | null,
  status: string,
  linkedBy: string
): Promise<void> {
  const now = new Date();
  
  // Check if reminder already exists
  const { data: existing } = await supabase
    .from('contract_reminders')
    .select('*')
    .eq('document_key', documentKey)
    .single();

  if (existing) {
    // Update existing
    const updates: any = {
      status,
      updated_at: now.toISOString(),
    };

    // Preencher/ajustar link (evita /sign/{documentKey} que gera 404)
    if (contractLink && (!existing.contract_link || isBadClicksignLink(existing.contract_link, documentKey))) {
      updates.contract_link = contractLink;
    }
    
    if (leadId && !existing.lead_id) {
      updates.lead_id = leadId;
      updates.linked_by = linkedBy;
      updates.linked_at = now.toISOString();
    }
    
    if (status === 'signed' || status === 'cancelled') {
      updates.next_reminder_at = null;
      updates.signed_at = status === 'signed' ? now.toISOString() : null;
    }
    
    await supabase
      .from('contract_reminders')
      .update(updates)
      .eq('document_key', documentKey);
    
    console.log(`[Clicksign] Updated contract_reminder for ${documentKey}`);
  } else {
    // Create new with first reminder scheduled for 12h later
    const nextReminder = new Date(now.getTime() + REMINDER_INTERVALS_HOURS[0] * 60 * 60 * 1000);
    
    await supabase.from('contract_reminders').insert({
      document_key: documentKey,
      document_name: documentName,
      contract_link: contractLink,
      lead_id: leadId,
      signer_email: signerEmail,
      signer_phone: signerPhone,
      signer_name: signerName,
      status: 'pending',
      reminder_stage: 0,
      next_reminder_at: nextReminder.toISOString(),
      contract_created_at: now.toISOString(),
      linked_by: leadId ? linkedBy : null,
      linked_at: leadId ? now.toISOString() : null,
    });
    
    console.log(`[Clicksign] Created contract_reminder for ${documentKey}, next reminder at ${nextReminder.toISOString()}`);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhook authentication - MANDATORY
  const CLICKSIGN_SECRET = Deno.env.get('CLICKSIGN_WEBHOOK_SECRET');
  if (!CLICKSIGN_SECRET) {
    console.error('[Clicksign Webhook] CLICKSIGN_WEBHOOK_SECRET not configured - rejecting request');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CLICKSIGN_SECRET}`) {
    console.warn('[Clicksign Webhook] Unauthorized request - invalid token');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const event = await req.json();
    console.log("Clicksign webhook received:", JSON.stringify(event, null, 2));

    const { document, event: eventData } = event;
    
    if (!document || !eventData) {
      console.log("Invalid webhook payload");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const documentKey = document.key;
    const documentFilename = document.filename || '';
    const eventName = eventData.name;
    const signers = document.signers || [];
    const firstSigner = signers[0] || {};

    // Preferimos sempre um link de assinatura válido (request_signature_key)
    // e evitamos /sign/{documentKey} (gera 404).
    let contractLink = `https://app.clicksign.com/document/${documentKey}`;

    const { data: existingReminder } = await supabase
      .from('contract_reminders')
      .select('contract_link')
      .eq('document_key', documentKey)
      .maybeSingle();

    if (existingReminder?.contract_link) {
      contractLink = existingReminder.contract_link;
    }

    if (isBadClicksignLink(contractLink, documentKey)) {
      const resolved = await resolveClicksignSignerLink(documentKey);
      if (resolved) contractLink = resolved;
    }

    console.log(`Processing event: ${eventName} for document: ${documentKey}`);

    // Map event to status and message type
    let newStatus: string | null = null;
    let messageType: string | null = null;
    let reminderStatus = 'pending';
    
    switch (eventName) {
      case "upload":
      case "add_signer":
        newStatus = "Aguardando Assinatura";
        messageType = 'created';
        reminderStatus = 'pending';
        break;
      case "sign":
        const allSigned = signers.every((s: any) => s.signed_at !== null);
        newStatus = allSigned ? "Assinado" : "Assinatura Parcial";
        messageType = allSigned ? 'signed' : null;
        // CRITICAL: Stop reminders as soon as ANY signer signs
        reminderStatus = 'signed';
        break;
      case "close":
        newStatus = "Finalizado";
        messageType = 'finalized';
        reminderStatus = 'signed';
        break;
      case "cancel":
        newStatus = "Cancelado";
        reminderStatus = 'cancelled';
        break;
      case "refuse":
        newStatus = "Recusado";
        reminderStatus = 'cancelled';
        break;
      default:
        console.log(`Unhandled event: ${eventName}`);
    }

    if (!newStatus) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Try to find lead using conversation analysis
    let leadData = await findLeadByConversationAnalysis(
      supabase,
      documentFilename,
      firstSigner.email,
      firstSigner.phone_number,
      firstSigner.name
    );

    // Fallback: try direct search in leads_juridicos
    if (!leadData) {
      const { data: leadsByKey } = await supabase
        .from("leads_juridicos")
        .select("*, manychat_subscribers!manychat_subscribers_lead_id_fkey(*)")
        .ilike("link_contrato", `%${documentKey}%`);

      if (leadsByKey && leadsByKey.length > 0) {
        const lead = leadsByKey[0];
        const subscriber = lead.manychat_subscribers?.[0];
        if (subscriber) {
          leadData = { lead, subscriber };
        }
      }
    }

    // Create/update contract reminder record
    await createOrUpdateContractReminder(
      supabase,
      documentKey,
      documentFilename,
      contractLink,
      leadData?.lead?.id || null,
      firstSigner.email,
      firstSigner.phone_number,
      firstSigner.name,
      reminderStatus,
      leadData ? 'isa_auto' : 'none'
    );

    if (leadData) {
      const { lead, subscriber } = leadData;
      const leadId = lead.id;
      const clientName = lead.nome?.split(' ')[0] || 'Cliente';

      // Update lead with contract link
      if (!lead.link_contrato || !lead.link_contrato.includes(documentKey)) {
        await supabase
          .from("leads_juridicos")
          .update({ 
            link_contrato: contractLink,
            contract_key: documentKey,
            contract_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", leadId);
        console.log(`[Clicksign] Lead ${leadId} updated with contract link`);
      }

      // Update lead state
      if (newStatus === "Assinado" || newStatus === "Finalizado") {
        await supabase
          .from("leads_juridicos")
          .update({ 
            status: "Ganho",
            lead_state: "CONTRACT_SIGNED",
            contract_signed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", leadId);

        await supabase.from("lead_state_history").insert({
          lead_id: leadId,
          from_state: lead.lead_state || 'CONTRACT_SENT',
          to_state: 'CONTRACT_SIGNED',
          changed_by: 'clicksign_webhook',
          reason: `Contrato assinado via Clicksign (${documentKey})`
        });
      } else if (newStatus === "Aguardando Assinatura") {
        await supabase
          .from("leads_juridicos")
          .update({ 
            lead_state: "CONTRACT_SENT",
            status: "Aguardando Contrato",
            updated_at: new Date().toISOString()
          })
          .eq("id", leadId)
          .not("lead_state", "in", "(CONTRACT_SIGNED,DOCS_PENDING,READY_FOR_LAWYER)");
      }

      // Create interaction
      await supabase.from("interacoes").insert({
        cliente_id: leadId,
        tipo: "Documento",
        resumo: `Contrato: ${newStatus}`,
        detalhes: `Evento Clicksign: ${eventName}. Status: ${newStatus}. Link: ${contractLink}`,
        direcao: "Sistema",
      });

      // Send ManyChat message for new contracts or completions
      if (messageType && subscriber?.subscriber_id) {
        let message = '';
        
        switch (messageType) {
          case 'created':
            message = CONTRACT_MESSAGES.created(clientName, contractLink);
            break;
          case 'signed':
            message = CONTRACT_MESSAGES.signed(clientName);
            break;
          case 'finalized':
            message = CONTRACT_MESSAGES.finalized(clientName);
            break;
        }
        
        if (message) {
          const sendResult = await sendZapiMessage(supabase, lead.tipo_origem, lead.telefone || subscriber.telefone, message);
          
          if (sendResult.success) {
            // Record in manychat_mensagens
            await supabase.from("manychat_mensagens").insert({
              subscriber_id: subscriber.subscriber_id,
              lead_id: leadId,
              conteudo: message,
              direcao: 'saida',
              tipo: 'text',
              subscriber_nome: subscriber.nome,
            });
          }
          
          await supabase.from("system_events").insert({
            tipo: "contrato",
            acao: `notification_${messageType}`,
            fonte: "clicksign_webhook",
            lead_id: leadId,
            dados: {
              document_key: documentKey,
              event_name: eventName,
              status: newStatus,
              zapi_sent: sendResult.success,
            }
          });
        }
      }
    } else {
      // No lead found - log for manual review
      console.log(`[Clicksign] No lead found for document ${documentKey}`);
      
      await supabase.from("system_events").insert({
        tipo: "contrato",
        acao: "orphan_contract",
        fonte: "clicksign_webhook",
        dados: {
          document_key: documentKey,
          document_name: documentFilename,
          event_name: eventName,
          signer_name: firstSigner.name,
          signer_email: firstSigner.email,
          signer_phone: firstSigner.phone_number,
        }
      });
    }

    return new Response(JSON.stringify({ success: true, status: newStatus, leadFound: !!leadData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in clicksign-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
