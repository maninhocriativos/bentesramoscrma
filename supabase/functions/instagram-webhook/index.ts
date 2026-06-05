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

function descreverMensagem(message: any): { texto: string; tipo: string } {
  if (message?.text) return { texto: message.text, tipo: "text" };
  const att = message?.attachments?.[0];
  if (att) {
    const t = att.type || "anexo";
    const url = att.payload?.url || "";
    const rotulo: Record<string, string> = {
      image: "📷 Imagem", video: "🎥 Vídeo", audio: "🎵 Áudio",
      file: "📎 Arquivo", share: "🔗 Compartilhamento", story_mention: "📲 Menção em Story",
    };
    return { texto: url ? `${rotulo[t] || "📎 Anexo"}: ${url}` : (rotulo[t] || "📎 Anexo"), tipo: t };
  }
  if (message?.is_deleted) return { texto: "🚫 Mensagem apagada", tipo: "text" };
  return { texto: "[mensagem não suportada]", tipo: "text" };
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
          const { texto, tipo } = descreverMensagem(message);

          // Upsert do contato
          const { error: subErr } = await supabase.from("manychat_subscribers").upsert(
            { subscriber_id: subscriberId, nome, canal: "instagram", ultima_interacao: new Date().toISOString() },
            { onConflict: "subscriber_id", ignoreDuplicates: false },
          );
          if (subErr) erros.push(`subscriber: ${subErr.message}`);

          // Insere a mensagem
          const { error: msgErr } = await supabase.from("manychat_mensagens").insert({
            subscriber_id: subscriberId,
            subscriber_nome: isEcho ? "Atendente" : nome,
            conteudo: texto,
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
            },
          });

          if (msgErr) {
            erros.push(`mensagem: ${msgErr.message}`);
            console.error("[IG Webhook] Erro ao salvar mensagem:", msgErr);
          } else {
            salvas++;
            console.log(`[IG Webhook] ✅ ${isEcho ? "saída" : "entrada"} salva de ${nome}: ${texto.slice(0, 60)}`);
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
