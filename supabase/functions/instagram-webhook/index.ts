import { createClient } from "npm:@supabase/supabase-js@2";

// Webhook do Instagram Messaging (Meta) — recebe mensagens diretas (DMs) da
// conta Instagram Business e grava na mesma estrutura de chat do CRM
// (manychat_subscribers + manychat_mensagens, canal='instagram'), para
// aparecerem no mesmo inbox do WhatsApp. Independente da Z-API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("INSTAGRAM_VERIFY_TOKEN") || "";
const IG_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Busca nome/username do remetente via Graph API (se o token estiver configurado)
async function getIgProfile(igsid: string): Promise<{ name?: string; username?: string } | null> {
  if (!IG_TOKEN) return null;
  try {
    const resp = await fetch(
      `https://graph.instagram.com/${igsid}?fields=name,username&access_token=${IG_TOKEN}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

type Parte = { texto: string; tipo: string; mediaUrl: string };

// Extrai TODAS as partes de uma mensagem do Instagram: o texto e/ou CADA anexo.
// Antes só pegava o 1º anexo — então quando o cliente manda várias fotos numa
// mensagem só (ex.: o contrato em várias páginas), só vinha uma.
function extrairPartes(message: any): Parte[] {
  const rotulo: Record<string, string> = {
    image: "📷 Imagem", video: "🎥 Vídeo", audio: "🎵 Áudio",
    file: "📎 Arquivo", share: "🔗 Compartilhamento", story_mention: "📲 Menção em Story",
  };
  const atts: any[] = message?.attachments || [];
  if (atts.length > 0) {
    return atts.map((att) => {
      const t = att?.type || "anexo";
      return { texto: rotulo[t] || "📎 Anexo", tipo: t, mediaUrl: att?.payload?.url || "" };
    });
  }
  if (message?.text) return [{ texto: message.text, tipo: "text", mediaUrl: "" }];
  if (message?.is_deleted) return [{ texto: "🚫 Mensagem apagada", tipo: "text", mediaUrl: "" }];
  return [{ texto: "[mensagem não suportada]", tipo: "text", mediaUrl: "" }];
}

// Baixa a mídia do Instagram (URL temporária) e guarda no Storage público,
// devolvendo a URL permanente. As URLs de mídia do IG expiram, então persistimos
// na hora que o webhook chega (URL ainda válida). Em caso de falha, devolve a
// própria URL do IG (melhor que nada).
async function persistirMidia(rawUrl: string, tipo: string, mid: string): Promise<string> {
  try {
    const resp = await fetch(rawUrl, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) return rawUrl;
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const buf = new Uint8Array(await resp.arrayBuffer());
    let ext = ({ image: "jpg", video: "mp4", audio: "mp3", file: "bin" } as Record<string, string>)[tipo] || "bin";
    if (ct.includes("png")) ext = "png";
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
    else if (ct.includes("webp")) ext = "webp";
    else if (ct.includes("gif")) ext = "gif";
    else if (ct.includes("mp4")) ext = "mp4";
    else if (ct.includes("ogg") || ct.includes("opus")) ext = "ogg";
    else if (ct.includes("mpeg") || ct.includes("mp3")) ext = "mp3";
    const safe = (mid || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `instagram-media/${safe}.${ext}`;
    const { error } = await supabase.storage.from("documentos").upload(path, buf, {
      contentType: ct || "application/octet-stream",
      upsert: true,
    });
    if (error) {
      console.error("[IG Webhook] upload de mídia falhou:", error.message);
      return rawUrl;
    }
    // URL ASSINADA de longa duração (10 anos): o bucket 'documentos' é privado,
    // então a URL pública dá HTTP 400 e a imagem não carrega no chat. A assinada
    // funciona direto no <img>.
    const { data: signed } = await supabase.storage.from("documentos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return signed?.signedUrl || rawUrl;
  } catch (e) {
    console.error("[IG Webhook] persistirMidia erro:", e);
    return rawUrl;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── Verificação do webhook (Meta faz um GET ao salvar a URL de callback) ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      console.log("[IG Webhook] ✅ Verificação OK");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    console.warn("[IG Webhook] ❌ Verificação falhou (token não confere)");
    return new Response("Forbidden", { status: 403 });
  }

  // ── Recebimento de mensagens ──────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Só processa eventos de Instagram
      if (body.object !== "instagram") {
        return new Response("ignored", { status: 200, headers: corsHeaders });
      }

      let recebidas = 0;
      let salvas = 0;
      const erros: string[] = [];

      for (const entry of body.entry || []) {
        const eventos = entry.messaging || [];
        for (const ev of eventos) {
          const senderId = ev.sender?.id;
          const recipientId = ev.recipient?.id;
          const message = ev.message;
          if (!senderId || !message) continue;

          // Echo = mensagem enviada pela própria conta (respondida pelo app do IG).
          // Capturamos como saída para o histórico ficar completo.
          const isEcho = !!message.is_echo;
          const mid = message.mid;

          // Deduplicação por mid (Meta pode reenviar)
          if (mid) {
            const { data: existing } = await supabase
              .from("manychat_mensagens")
              .select("id")
              .eq("metadata->>mid", mid)
              .maybeSingle();
            if (existing) {
              console.log("[IG Webhook] Mensagem duplicada, ignorando:", mid);
              continue;
            }
          }

          // O contato é sempre o usuário do Instagram (não a conta do escritório)
          const contatoIgsid = isEcho ? recipientId : senderId;
          const subscriberId = `ig_${contatoIgsid}`;

          const profile = await getIgProfile(contatoIgsid);
          const nome = profile?.username
            ? `@${profile.username}`
            : profile?.name || "Instagram User";

          recebidas++;
          const partes = extrairPartes(message);

          // Upsert do contato (uma vez por evento)
          const { error: subErr } = await supabase.from("manychat_subscribers").upsert(
            { subscriber_id: subscriberId, nome, canal: "instagram", ultima_interacao: new Date().toISOString() },
            { onConflict: "subscriber_id", ignoreDuplicates: false },
          );
          if (subErr) erros.push(`subscriber: ${subErr.message}`);

          // Uma mensagem por parte: o texto e/ou CADA anexo (cobre várias fotos).
          for (let pi = 0; pi < partes.length; pi++) {
            const { texto, tipo, mediaUrl } = partes[pi];
            const ehMidia = ["image", "video", "audio", "file"].includes(tipo);
            let mediaPublica = "";
            let conteudoFinal = texto;
            if (mediaUrl) {
              if (ehMidia) {
                mediaPublica = await persistirMidia(mediaUrl, tipo, `${mid || crypto.randomUUID()}_${pi}`);
              } else {
                conteudoFinal = `${texto}: ${mediaUrl}`;
              }
            }

            const { error: msgErr } = await supabase.from("manychat_mensagens").insert({
              subscriber_id: subscriberId,
              subscriber_nome: isEcho ? "Atendente" : nome,
              conteudo: conteudoFinal,
              canal: "instagram",
              tipo,
              direcao: isEcho ? "saida" : "entrada",
              metadata: {
                mid,
                igsid: contatoIgsid,
                recipient_id: recipientId,
                sender_id: senderId,
                source: "instagram_webhook",
                is_echo: isEcho,
                ...(partes.length > 1 ? { attachment_index: pi } : {}),
                ...(mediaPublica ? { media_url: mediaPublica } : {}),
              },
            });

            if (msgErr) {
              erros.push(`mensagem: ${msgErr.message}`);
              console.error("[IG Webhook] Erro ao salvar mensagem:", msgErr);
            } else {
              salvas++;
              console.log(`[IG Webhook] ✅ ${isEcho ? "saída" : "entrada"} salva de ${nome}: ${conteudoFinal.slice(0, 60)}`);
            }
          }
        }
      }

      // Retorna diagnóstico no corpo (a Meta só exige status 200)
      return new Response(
        JSON.stringify({ status: "EVENT_RECEIVED", recebidas, salvas, erros }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      console.error("[IG Webhook] Erro:", e);
      // Responder 200 mesmo em erro evita reenvios em loop da Meta
      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
