import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getZapiConfig, sendText, normalizePhone } from "../_shared/zapi-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mensagens para lembrete de assinatura Zapsign
const MESSAGES = {
  soft: (clientName: string, signUrl: string) =>
    `Oi ${clientName}! 👋\n\n` +
    `Passando para lembrar que seu contrato ainda aguarda sua assinatura digital.\n\n` +
    `✍️ *Assinar agora é simples e rápido:*\n` +
    `${signUrl}\n\n` +
    `Leva menos de 2 minutos! 😊\n\n` +
    `*Bentes & Ramos Advocacia*`,

  urgent: (clientName: string, signUrl: string) =>
    `${clientName}, seu contrato precisa de atenção! ⚠️\n\n` +
    `Percebemos que o contrato ainda *não foi assinado*. ` +
    `Para darmos continuidade ao seu processo, é essencial assinar hoje.\n\n` +
    `✍️ *Assine agora:*\n` +
    `${signUrl}\n\n` +
    `Sem a assinatura não conseguimos iniciar os trabalhos. Por favor, priorize isso! 📝\n\n` +
    `*Bentes & Ramos Advocacia*`,

  expiring: (clientName: string, signUrl: string, hoursLeft: number) =>
    `${clientName}, atenção! ⏰\n\n` +
    `Seu contrato *expira em ${hoursLeft} horas*. Após esse prazo, precisaremos gerar um novo documento.\n\n` +
    `✍️ *Assine agora para não perder:*\n` +
    `${signUrl}\n\n` +
    `*Bentes & Ramos Advocacia*`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      documentId,
      documentName,
      reminderType = "soft",
      signUrl,
      leadId,
      hoursLeft,
      // Dados do signatário vindos da tela (cobrem contratos criados direto no
      // painel do ZapSign, que NÃO têm registro local).
      signerPhone,
      signerName,
    } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ success: false, error: "documentId é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar contrato local (pode não existir se foi criado direto no ZapSign)
    const { data: contract } = await supabase
      .from("contract_reminders_zapsign")
      .select("*")
      .eq("document_id", documentId)
      .maybeSingle();

    // 2. Buscar lead pelo lead_id do contrato ou pelo leadId informado
    const targetLeadId = leadId || contract?.lead_id;
    let lead: any = null;

    if (targetLeadId) {
      const { data } = await supabase
        .from("leads_juridicos")
        .select("id, nome, telefone, email")
        .eq("id", targetLeadId)
        .maybeSingle();
      lead = data;
    }

    // Fallback: buscar pelo telefone do signatário (local ou da tela)
    const phoneParaBusca = contract?.signer_phone || signerPhone;
    if (!lead && phoneParaBusca) {
      const normalized = normalizePhone(phoneParaBusca);
      if (normalized.length >= 10) {
        const { data } = await supabase
          .from("leads_juridicos")
          .select("id, nome, telefone, email")
          .or(`telefone.ilike.%${normalized.slice(-8)}%`)
          .limit(1)
          .maybeSingle();
        lead = data;
      }
    }

    // Determinar telefone de destino: do lead, do registro local ou da tela
    const telefoneDestino = lead?.telefone || contract?.signer_phone || signerPhone;

    if (!telefoneDestino) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum telefone encontrado para envio. Verifique se o cliente tem telefone cadastrado." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 3. Resolver URL de assinatura
    const resolvedSignUrl = signUrl || contract?.contract_link || "https://zapsign.com.br";

    // 4. Montar mensagem
    const clientName = (lead?.nome || contract?.signer_name || signerName || "Cliente").split(" ")[0];
    let message: string;

    if (reminderType === "urgent") {
      message = MESSAGES.urgent(clientName, resolvedSignUrl);
    } else if (reminderType === "expiring") {
      message = MESSAGES.expiring(clientName, resolvedSignUrl, hoursLeft || 24);
    } else {
      message = MESSAGES.soft(clientName, resolvedSignUrl);
    }

    // 5. Buscar config ZAPI e enviar
    const zapiConfig = await getZapiConfig(supabase);
    if (!zapiConfig) {
      return new Response(
        JSON.stringify({ success: false, error: "Z-API não configurada ou inativa" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const sendResult = await sendText(zapiConfig, telefoneDestino, message);

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 6. Registrar histórico
    const cleanPhone = normalizePhone(telefoneDestino);
    const effectiveLeadId = lead?.id || contract?.lead_id;

    await Promise.all([
      // Mensagem no histórico do chat
      supabase.from("manychat_mensagens").insert({
        subscriber_id: `zapi_${cleanPhone}`,
        lead_id: effectiveLeadId,
        conteudo: message,
        direcao: "saida",
        tipo: "text",
        subscriber_nome: "Sistema",
        canal: "whatsapp",
        metadata: {
          source: "zapi",
          context: "zapsign_reminder",
          reminder_type: reminderType,
          document_id: documentId,
          message_id: sendResult.messageId,
        },
      }),
      // Interação no lead
      ...(effectiveLeadId ? [
        supabase.from("interacoes").insert({
          cliente_id: effectiveLeadId,
          tipo: "WhatsApp",
          resumo: `Lembrete Zapsign enviado (${reminderType})`,
          detalhes: `Mensagem enviada via Z-API para assinatura do documento "${documentName || documentId}".`,
          direcao: "Saída",
        }),
      ] : []),
      // Evento de sistema
      supabase.from("system_events").insert({
        tipo: "contrato",
        acao: `zapsign_reminder_${reminderType}_sent`,
        fonte: "zapsign-reminder",
        lead_id: effectiveLeadId,
        dados: {
          document_id: documentId,
          sent_via: "zapi",
          phone: cleanPhone,
        },
      }),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lembrete enviado via WhatsApp",
        lead: lead ? { id: lead.id, nome: lead.nome } : null,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[Zapsign Reminder] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
