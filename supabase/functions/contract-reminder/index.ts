import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, normalizePhone } from "../_shared/zapi-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
      const isRetryable = msg.includes('http2 error') || msg.includes('connection error') || msg.includes('SendRequest') || msg.includes('ECONNRESET');
      if (!isRetryable || attempt === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[Contract Reminder] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Um link só é ACEITÁVEL para enviar ao cliente se for de assinatura de verdade:
//  - ClickSign: https://app.clicksign.com/sign/<request_signature_key>
//  - ZapSign:   https://app.zapsign.com.br/verificar/<token>
// Rejeita /document/<key>, a homepage e o /sign/<documentKey> (key do documento
// no lugar do request_signature_key) — todos levam a erro para o cliente.
function isBadClicksignLink(link: string | null | undefined, documentKey?: string | null) {
  if (!link) return true;
  if (link.includes('/verificar/')) return false;                     // ZapSign válido
  if (!link.includes('/sign/')) return true;                          // /document/<key>, homepage, key cru
  if (documentKey && link.includes(`/sign/${documentKey}`)) return true; // key do doc no lugar do request key
  return false;
}

async function resolveClicksignSignerLink(documentKey: string): Promise<string | null> {
  if (!CLICKSIGN_API_KEY) return null;
  try {
    const response = await fetchWithRetry(
      `${CLICKSIGN_BASE_URL}/documents/${documentKey}?access_token=${CLICKSIGN_API_KEY}`,
      { method: 'GET' }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const doc = data?.document || data;
    const lists = doc?.lists || doc?.document?.lists;
    const requestKey = lists?.[0]?.request_signature_key;
    if (!requestKey) return null;
    return `https://app.clicksign.com/sign/${requestKey}`;
  } catch (err) {
    console.error('[Contract Reminder] Error resolving signer link:', err);
    return null;
  }
}

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

async function findLeadByDocumentKey(
  supabase: any,
  documentKey: string
): Promise<any | null> {
  const { data: lead } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone, email, link_contrato, status, contract_key')
    .or(`contract_key.eq.${documentKey},link_contrato.ilike.%${documentKey}%`)
    .limit(1)
    .maybeSingle();
  return lead || null;
}

async function findLeadByDocumentName(
  supabase: any,
  documentName: string
): Promise<any | null> {
  const nameParts = documentName.replace(/^Documento\s*-?\s*/i, '').replace(/\.[^/.]+$/, '').trim();
  const searchTerms = nameParts.split(' ').filter((t: string) => t.length > 2);
  if (searchTerms.length === 0) return null;

  const orConditions = searchTerms.slice(0, 3).map((term: string) => `nome.ilike.%${term}%`).join(',');
  const { data: leads } = await supabase
    .from('leads_juridicos')
    .select('id, nome, telefone, email, link_contrato, status')
    .or(orConditions)
    .limit(5);

  if (!leads || leads.length === 0) return null;

  let bestMatch = leads[0];
  let bestScore = 0;
  for (const lead of leads) {
    const leadNameLower = (lead.nome || '').toLowerCase();
    let score = searchTerms.filter((t: string) => leadNameLower.includes(t.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; bestMatch = lead; }
  }
  return bestMatch;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { documentKey, documentName, contractLink, reminderType = 'soft' } = await req.json();

    console.log('[Contract Reminder] Request:', { documentKey, documentName, reminderType });

    if (!documentName && !documentKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'documentName ou documentKey é obrigatório' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find lead
    let lead = null;
    if (documentKey) lead = await findLeadByDocumentKey(supabase, documentKey);
    if (!lead && documentName) lead = await findLeadByDocumentName(supabase, documentName);

    if (!lead) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead não encontrado no CRM', details: 'Verifique se o cliente está cadastrado e vinculado ao contrato' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!lead.telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead sem telefone cadastrado', lead: { id: lead.id, nome: lead.nome } }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve contract link
    let link: string | null = contractLink || lead.link_contrato || null;
    if (isBadClicksignLink(link, documentKey)) link = null;
    if (!link && documentKey) {
      const resolved = await resolveClicksignSignerLink(documentKey);
      if (resolved) {
        link = resolved;
        const { error: updateErr } = await supabase.from('leads_juridicos').update({ link_contrato: link }).eq('id', lead.id);
        if (updateErr) console.error('[Contract Reminder] Falha ao salvar link no lead:', updateErr.message);
        await supabase.from('contract_reminders').update({ contract_link: link, updated_at: new Date().toISOString() }).eq('document_key', documentKey);
      }
    }
    // Sem link de assinatura VÁLIDO não enviamos nada: mandar /document/<key> ou a
    // homepage gera erro para o cliente. Melhor abortar e avisar o operador.
    if (isBadClicksignLink(link, documentKey)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível obter o link de assinatura do ClickSign. A cobrança não foi enviada para evitar mandar um link quebrado ao cliente.',
          lead: { id: lead.id, nome: lead.nome },
        }),
        { status: 422, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const signLink: string = link!; // garantido não-nulo pelo guard isBadClicksignLink acima
    const clientName = lead.nome?.split(' ')[0] || 'Cliente';
    const message = reminderType === 'urgent'
      ? CONTRACT_MESSAGES.urgent(clientName, signLink)
      : CONTRACT_MESSAGES.soft(clientName, signLink);

    // Send via Z-API
    const zapiConfig = await getZapiConfig(supabase);
    if (!zapiConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Z-API não configurada ou inativa' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const sendResult = await sendText(zapiConfig, lead.telefone, message);

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error, lead: { id: lead.id, nome: lead.nome } }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Save message, interaction, and event
    const cleanPhone = normalizePhone(lead.telefone);
    await Promise.all([
      supabase.from('manychat_mensagens').insert({
        subscriber_id: `zapi_${cleanPhone}`,
        lead_id: lead.id,
        conteudo: message,
        direcao: 'saida',
        tipo: 'text',
        subscriber_nome: 'Sistema',
        canal: 'whatsapp',
        metadata: { source: 'zapi', context: 'contract_reminder', message_id: sendResult.messageId }
      }),
      supabase.from('interacoes').insert({
        cliente_id: lead.id,
        tipo: 'WhatsApp',
        resumo: `Cobrança de assinatura enviada (${reminderType})`,
        detalhes: `Mensagem enviada via Z-API. Link: ${link}`,
        direcao: 'Saída',
      }),
      supabase.from('system_events').insert({
        tipo: 'contrato',
        acao: `reminder_${reminderType}_sent`,
        fonte: 'contract-reminder',
        lead_id: lead.id,
        dados: { document_key: documentKey, sent_via: 'zapi' }
      }),
    ]);

    return new Response(
      JSON.stringify({ success: true, message: 'Cobrança enviada com sucesso via WhatsApp', lead: { id: lead.id, nome: lead.nome } }),
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
