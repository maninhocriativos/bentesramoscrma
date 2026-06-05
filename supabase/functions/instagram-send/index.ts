import { createClient } from "npm:@supabase/supabase-js@2";

// Envia mensagem (resposta do atendente) para um contato do Instagram via
// Graph API, e registra a saída em manychat_mensagens para o inbox.
// Body esperado: { subscriber_id: "ig_<igsid>", text: "..." }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IG_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!IG_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN não configurado");

    const { subscriber_id, text } = await req.json();
    if (!subscriber_id || !text) {
      throw new Error("subscriber_id e text são obrigatórios");
    }

    // subscriber_id no formato "ig_<igsid>"
    const igsid = String(subscriber_id).replace(/^ig_/, "");

    // Envia via Graph API do Instagram
    const resp = await fetch(
      `https://graph.instagram.com/v21.0/me/messages?access_token=${IG_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: igsid },
          message: { text },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      console.error("[IG Send] Erro Graph API:", msg);
      throw new Error(`Instagram: ${msg}`);
    }

    // Registra a saída no inbox
    await supabase.from("manychat_mensagens").insert({
      subscriber_id,
      subscriber_nome: "Atendente",
      conteudo: text,
      canal: "instagram",
      tipo: "text",
      direcao: "saida",
      metadata: {
        mid: data?.message_id || null,
        igsid,
        source: "instagram_send",
        sent_via: "crm",
      },
    });

    return new Response(JSON.stringify({ success: true, message_id: data?.message_id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[IG Send]", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
