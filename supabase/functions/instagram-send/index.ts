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
const CLOUDCONVERT_API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// A Graph API do Instagram só aceita áudio em aac/m4a/wav/mp4 — o CRM grava o
// áudio direto em Ogg/Opus no navegador (rápido, ótimo pro WhatsApp), mas o
// Instagram rejeita/não reproduz esse formato. Converte para M4A (AAC) via
// CloudConvert antes de enviar, e reidrata num signed URL novo no Storage
// (a URL de export do CloudConvert é temporária, e a Graph API busca a mídia
// de forma assíncrona — melhor apontar pra algo de longa duração).
async function converterAudioParaInstagram(mediaUrl: string): Promise<string> {
  if (!CLOUDCONVERT_API_KEY) return mediaUrl;
  try {
    const headers = { Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`, "Content-Type": "application/json" };
    const jobResp = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        tasks: {
          imp: { operation: "import/url", url: mediaUrl },
          conv: { operation: "convert", input: "imp", output_format: "m4a", engine: "ffmpeg", audio_codec: "aac" },
          exp: { operation: "export/url", input: "conv" },
        },
      }),
    });
    const jobData = await jobResp.json();
    const jobId = jobData?.data?.id;
    if (!jobResp.ok || !jobId) {
      console.error("[IG Send] CloudConvert: falha ao criar job", jobData);
      return mediaUrl;
    }

    const waitResp = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}/wait`, {
      headers, signal: AbortSignal.timeout(45000),
    });
    const waitData = await waitResp.json();
    const exp = (waitData?.data?.tasks || []).find((t: any) => t.operation === "export/url" && t.status === "finished");
    const convertedUrl = exp?.result?.files?.[0]?.url;
    if (!convertedUrl) {
      console.error("[IG Send] CloudConvert: export não finalizou", waitData);
      return mediaUrl;
    }

    const convertedResp = await fetch(convertedUrl, { signal: AbortSignal.timeout(30000) });
    if (!convertedResp.ok) return mediaUrl;
    const buf = new Uint8Array(await convertedResp.arrayBuffer());

    const path = `instagram-media-outbound/${crypto.randomUUID()}.m4a`;
    const { error: uploadError } = await supabase.storage.from("documentos").upload(path, buf, {
      contentType: "audio/mp4",
      upsert: true,
    });
    if (uploadError) {
      console.error("[IG Send] upload do áudio convertido falhou:", uploadError.message);
      return mediaUrl;
    }
    const { data: signed } = await supabase.storage.from("documentos")
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    return signed?.signedUrl || mediaUrl;
  } catch (e) {
    console.error("[IG Send] conversão de áudio falhou, tentando original:", e);
    return mediaUrl;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!IG_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN não configurado");

    // Aceita texto OU mídia (imagem/vídeo/áudio/documento) via media_url.
    const { subscriber_id, text, type, media_url } = await req.json();
    const ehMidia = ["image", "video", "audio", "document"].includes(type) && !!media_url;
    if (!subscriber_id || (!text && !ehMidia)) {
      throw new Error("subscriber_id e (text ou media_url) são obrigatórios");
    }

    // subscriber_id no formato "ig_<igsid>"
    const igsid = String(subscriber_id).replace(/^ig_/, "");

    // Áudio grava em Ogg/Opus (formato do WhatsApp) — Instagram só aceita
    // aac/m4a/wav/mp4, então converte antes de montar o payload.
    const mediaUrlFinal = (ehMidia && type === "audio")
      ? await converterAudioParaInstagram(media_url)
      : media_url;

    // A Graph API do Instagram usa "file" como attachment.type pra documentos
    // (a Meta também manda "file" no lado de recebimento — normalizarTipo no
    // instagram-webhook já converte isso pra "document", nosso vocabulário
    // interno). Aqui é o caminho inverso, só no envio.
    const attachmentType = type === "document" ? "file" : type;

    // Monta a mensagem: anexo (mídia) ou texto. A Graph API do Instagram busca
    // a URL da mídia no servidor, então precisa ser uma URL acessível (a URL
    // assinada do Storage funciona).
    const messagePayload = ehMidia
      ? { attachment: { type: attachmentType, payload: { url: mediaUrlFinal } } }
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

    // Registra a saída no inbox (com a URL convertida, quando houve conversão,
    // pra reprodução no CRM usar o mesmo arquivo que foi de fato entregue)
    await supabase.from("manychat_mensagens").insert({
      subscriber_id,
      subscriber_nome: "Atendente",
      conteudo: ehMidia ? (mediaUrlFinal as string) : (text as string),
      canal: "instagram",
      tipo: ehMidia ? type : "text",
      direcao: "saida",
      metadata: {
        mid: data?.message_id || null,
        igsid,
        source: "instagram_send",
        sent_via: "crm",
        ...(ehMidia ? { media_url: mediaUrlFinal } : {}),
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
