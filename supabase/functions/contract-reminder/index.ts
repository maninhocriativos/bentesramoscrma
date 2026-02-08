import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MANYCHAT_API_URL = 'https://api.manychat.com';

const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");
const CLICKSIGN_BASE_URL = "https://app.clicksign.com/api/v1";

// Helper: retry for transient HTTP/2 errors (same pattern used elsewhere)
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
      console.log(`[Contract Reminder] Retry ${attempt + 1}/${maxRetries} after ${delay}ms due to: ${msg}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isBadClicksignLink(link: string | null | undefined, documentKey?: string | null) {
  if (!link) return true;
  if (!documentKey) return false;
  // Padrão que gera 404: /sign/{documentKey} (o correto é /sign/{request_signature_key})
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
      console.error(`[Contract Reminder] Clicksign get_document failed [${response.status}]: ${txt.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const doc = data?.document || data;
    const lists = doc?.lists || doc?.document?.lists;

    const requestKey: string | undefined =
      lists?.[0]?.request_signature_key ||
      lists?.[0]?.request_signature_key;

    if (!requestKey) return null;

    return `https://app.clicksign.com/sign/${requestKey}`;
  } catch (err) {
    console.error('[Contract Reminder] Error resolving signer link:', err);
    return null;
  }
}

// Messages for contract reminders
const CONTRACT_MESSAGES = {
  soft: (clientName: string, contractLink: string) =>
    `Oi ${clientName}! 👋\n\n` +
    `Passando para lembrar que seu contrato ainda aguarda assinatura.\n\n` +
    `🔗 Link para assinar: ${contractLink}\n\n` +
    `É bem rapidinho, leva menos de 2 minutos! 😊\n\n` +
    `*Bentes & Ramos Advocacia*`,
  
  urgent: (clientName: string, contractLink: string) => 
    `${clientName}, seu contrato precisa de atenção! ⚠️\n\n` +
    `Percebemos que ainda não houve a assinatura. Para darmos continuidade ao seu processo, ` +
    `*é essencial que você assine o contrato hoje*.\n\n` +
    `🔗 Assine agora: ${contractLink}\n\n` +
    `Sem a assinatura, não podemos iniciar os trabalhos. Por favor, priorize isso! 📝\n\n` +
    `*Bentes & Ramos Advocacia*`,
};

async function sendViaZapi(
  supabase: any,
  phone: string,
  message: string,
  leadId?: string
): Promise<{ success: boolean; error?: string }> {
  // Get Z-API config
  const { data: config } = await supabase
    .from('integrations_config')
    .select('*')
    .eq('provider', 'zapi')
    .single();

  if (!config?.is_active) {
    return { success: false, error: 'Z-API não está ativa' };
  }

  const instanceId = config.config_json?.instance_id;
  const token = config.config_json?.token;

  if (!instanceId || !token) {
    return { success: false, error: 'Credenciais Z-API não configuradas' };
  }

  // Normalize phone
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }

  try {
    console.log(`[Contract Reminder] Sending via Z-API to ${cleanPhone}`);
    
    const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone, message })
    });

    const data = await response.json();
    console.log('[Contract Reminder] Z-API response:', data);
    
    if (response.ok && !data.error) {
      // Save message to history
      if (leadId) {
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: `zapi_${cleanPhone}`,
          lead_id: leadId,
          conteudo: message,
          direcao: 'saida',
          tipo: 'text',
          subscriber_nome: 'Sistema',
          canal: 'whatsapp',
          metadata: { source: 'zapi', context: 'contract_reminder' }
        });
      }
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Erro Z-API' };
    }
  } catch (error) {
    console.error('[Contract Reminder] Z-API error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function sendManyChatMessage(
  subscriberId: string,
  message: string
): Promise<{ success: boolean; error?: string; code?: number }> {
  const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');
  
  if (!MANYCHAT_API_KEY) {
    return { success: false, error: 'MANYCHAT_API_KEY não configurada' };
  }

  try {
    console.log(`[Contract Reminder] Sending ManyChat message to subscriber ${subscriberId}`);
    
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
    console.log('[Contract Reminder] ManyChat response:', result);
    
    if (result.status === 'success') {
      return { success: true };
    } else {
      return { success: false, error: result.message || 'Erro ao enviar mensagem', code: result.code };
    }
  } catch (error) {
    console.error('[Contract Reminder] Error sending ManyChat message:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function findLeadByDocumentName(
  supabase: any,
  documentName: string
): Promise<{ lead: any; subscriber: any } | null> {
  // Extract possible name from document filename
  // Format: "Documento - Nome Completo" or similar
  const nameParts = documentName
    .replace(/^Documento\s*-?\s*/i, '')
    .replace(/\.[^/.]+$/, '') // Remove extension
    .trim();

  console.log(`[Contract Reminder] Searching for lead with name: ${nameParts}`);

  // Try to find lead by name (partial match)
  const searchTerms = nameParts.split(' ').filter((t: string) => t.length > 2);
  
  if (searchTerms.length === 0) {
    console.log('[Contract Reminder] No valid search terms');
    return null;
  }

  // Build OR conditions for partial name match
  const orConditions = searchTerms
    .slice(0, 3) // Use first 3 terms
    .map((term: string) => `nome.ilike.%${term}%`)
    .join(',');

  const { data: leads, error } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone, email, link_contrato, status')
    .or(orConditions)
    .limit(5);

  if (error || !leads || leads.length === 0) {
    console.log('[Contract Reminder] No leads found');
    return null;
  }

  // Find the best match (most search terms match)
  let bestMatch = leads[0];
  let bestScore = 0;

  for (const lead of leads) {
    const leadNameLower = (lead.nome || '').toLowerCase();
    let score = 0;
    
    for (const term of searchTerms) {
      if (leadNameLower.includes(term.toLowerCase())) {
        score++;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = lead;
    }
  }

  console.log(`[Contract Reminder] Best match: ${bestMatch.nome} (score: ${bestScore})`);

  // Get ManyChat subscriber for this lead
  const { data: subscriber } = await supabase
    .from('manychat_subscribers')
    .select('subscriber_id, nome, telefone')
    .eq('lead_id', bestMatch.id)
    .maybeSingle();

  if (!subscriber) {
    console.log(`[Contract Reminder] No ManyChat subscriber found for lead ${bestMatch.id}`);
    return null;
  }

  return { lead: bestMatch, subscriber };
}

async function findLeadByDocumentKey(
  supabase: any,
  documentKey: string
): Promise<{ lead: any; subscriber: any } | null> {
  console.log(`[Contract Reminder] Searching for lead by documentKey: ${documentKey}`);

  const { data: lead, error } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone, email, link_contrato, status, contract_key')
    .or(`contract_key.eq.${documentKey},link_contrato.ilike.%${documentKey}%`)
    .limit(1)
    .maybeSingle();

  if (error || !lead) {
    console.log('[Contract Reminder] No lead found by documentKey');
    return null;
  }

  const { data: subscriber } = await supabase
    .from('manychat_subscribers')
    .select('subscriber_id, nome, telefone')
    .eq('lead_id', lead.id)
    .maybeSingle();

  if (!subscriber) {
    console.log(`[Contract Reminder] No ManyChat subscriber found for lead ${lead.id}`);
    return null;
  }

  return { lead, subscriber };
}
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { 
      documentKey,
      documentName,
      contractLink,
      reminderType = 'soft' // 'soft' or 'urgent'
    } = await req.json();

    console.log('[Contract Reminder] Request:', { documentKey, documentName, reminderType });

    if (!documentName && !documentKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'documentName ou documentKey é obrigatório' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find lead and subscriber
    let result: { lead: any; subscriber: any } | null = null;

    if (documentName) {
      result = await findLeadByDocumentName(supabase, documentName);
    }

    if (!result && documentKey) {
      result = await findLeadByDocumentKey(supabase, documentKey);
    }

    if (!result) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lead não encontrado ou sem subscriber ManyChat vinculado',
          details: 'Verifique se o cliente está cadastrado no CRM e vinculado ao ManyChat'
        }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { lead, subscriber } = result;
    const clientName = lead.nome?.split(' ')[0] || 'Cliente';

    // Resolve best possible link (evita /sign/{documentKey} que dá 404)
    let link: string | null = contractLink || lead.link_contrato || null;

    if (isBadClicksignLink(link, documentKey)) {
      link = null;
    }

    if (!link && documentKey) {
      const resolved = await resolveClicksignSignerLink(documentKey);
      if (resolved) {
        link = resolved;

        // Best-effort: persist corrected link for next reminders
        try {
          await supabase
            .from('leads_juridicos')
            .update({ link_contrato: link })
            .eq('id', lead.id);

          await supabase
            .from('contract_reminders')
            .update({ contract_link: link, updated_at: new Date().toISOString() })
            .eq('document_key', documentKey);
        } catch (persistErr) {
          console.warn('[Contract Reminder] Failed to persist corrected link:', persistErr);
        }
      }
    }

    if (!link && documentKey) {
      link = `https://app.clicksign.com/document/${documentKey}`;
    }

    if (!link) {
      link = 'https://app.clicksign.com';
    }
    // Generate message based on reminder type
    const message = reminderType === 'urgent' 
      ? CONTRACT_MESSAGES.urgent(clientName, link)
      : CONTRACT_MESSAGES.soft(clientName, link);

    // Try ManyChat first, fallback to Z-API if 24h window expired
    let sendResult = await sendManyChatMessage(subscriber.subscriber_id, message);
    let sentVia = 'manychat';

    // If ManyChat fails due to 24h window (code 3011), try Z-API
    if (!sendResult.success && sendResult.code === 3011 && lead.telefone) {
      console.log('[Contract Reminder] ManyChat 24h window expired, trying Z-API...');
      sendResult = await sendViaZapi(supabase, lead.telefone, message, lead.id);
      sentVia = 'zapi';
    }

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: sendResult.error,
          lead: { id: lead.id, nome: lead.nome },
          details: 'ManyChat falhou (janela 24h) e Z-API não disponível'
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Record the interaction
    await supabase.from('interacoes').insert({
      cliente_id: lead.id,
      tipo: 'WhatsApp',
      resumo: `Cobrança de assinatura enviada (${reminderType})`,
      detalhes: `Mensagem de cobrança de contrato enviada via ManyChat. Link: ${link}`,
      direcao: 'Saída',
    });

    // Record in manychat_mensagens
    await supabase.from('manychat_mensagens').insert({
      subscriber_id: subscriber.subscriber_id,
      lead_id: lead.id,
      conteudo: message,
      direcao: 'saida',
      tipo: 'text',
      subscriber_nome: subscriber.nome,
    });

    // Log system event
    await supabase.from('system_events').insert({
      tipo: 'contrato',
      acao: `reminder_${reminderType}_sent`,
      fonte: 'contract-reminder',
      lead_id: lead.id,
      dados: {
        document_key: documentKey,
        document_name: documentName,
        subscriber_id: subscriber.subscriber_id,
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cobrança enviada com sucesso',
        lead: { id: lead.id, nome: lead.nome },
        subscriberId: subscriber.subscriber_id
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('[Contract Reminder] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
