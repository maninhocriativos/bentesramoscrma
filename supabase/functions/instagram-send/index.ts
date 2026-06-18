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

    // Aceita texto OU mídia (imagem/vídeo/áudio) via media_url.
    const { subscriber_id, text, type, media_url } = await req.json();
    const ehMidia = ["image", "video", "audio"].includes(type) && !!media_url;
    if (!subscriber_id || (!text && !ehMidia)) {
      throw new Error("subscriber_id e (text ou media_url) são obrigatórios");
    }

    // subscriber_id no formato "ig_<igsid>"
    const igsid = String(subscriber_id).replace(/^ig_/, "");

    // Monta a mensagem: anexo (mídia) ou texto. A Graph API do Instagram busca
    // a URL da mídia no servidor, então precisa ser uma URL acessível (a URL
    // assinada do Storage funciona).
    const messagePayload = ehMidia
      ? { attachment: { type, payload: { url: media_url } } }
      : { text };

    // Envia via Graph API do Instagram
    const resp = await fetch(
      `https://graph.instagram.com/v21.0/me/messages?access_token=${IG_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: igsid },
          message: messagePayload,
        }),
        signal: AbortSignal.timeout(20000),
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
      conteudo: ehMidia ? (media_url as string) : (text as string),
      canal: "instagram",
      tipo: ehMidia ? type : "text",
      direcao: "saida",
      metadata: {
        mid: data?.message_id || null,
        igsid,
        source: "instagram_send",
        sent_via: "crm",
        ...(ehMidia ? { media_url } : {}),
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
