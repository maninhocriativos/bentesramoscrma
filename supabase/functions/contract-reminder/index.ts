import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MANYCHAT_API_URL = 'https://api.manychat.com';

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

async function sendManyChatMessage(
  subscriberId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
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
            messages: [
              {
                type: 'text',
                text: message,
              },
            ],
          },
        },
      }),
    });

    const result = await response.json();
    console.log('[Contract Reminder] ManyChat response:', result);
    
    if (result.status === 'success') {
      return { success: true };
    } else {
      return { success: false, error: result.message || 'Erro ao enviar mensagem' };
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

    if (!documentName) {
      return new Response(
        JSON.stringify({ success: false, error: 'documentName é obrigatório' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find lead and subscriber
    const result = await findLeadByDocumentName(supabase, documentName);

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
    const link = contractLink || `https://app.clicksign.com/sign/${documentKey}`;

    // Generate message based on reminder type
    const message = reminderType === 'urgent' 
      ? CONTRACT_MESSAGES.urgent(clientName, link)
      : CONTRACT_MESSAGES.soft(clientName, link);

    // Send via ManyChat
    const sendResult = await sendManyChatMessage(subscriber.subscriber_id, message);

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: sendResult.error,
          lead: { id: lead.id, nome: lead.nome }
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
