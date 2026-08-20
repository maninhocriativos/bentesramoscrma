import { createClient } from "npm:@supabase/supabase-js@2";

// Busca histórico completo do Instagram Direct (todas as conversas) e grava o
// que ainda não está no banco — cobre o período em que o INSTAGRAM_ACCESS_TOKEN
// esteve expirado (o webhook em tempo real não perde mensagem por token, mas
// mídia que dependa do token pra baixar/perfil pode ter ficado incompleta, e
// qualquer lacuna de entrega da Meta fica coberta por esta varredura).
// Rodar sob demanda (não é cron): POST sem corpo, ou { since: "2026-08-01" }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IG_TOKEN = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TIME_BUDGET_MS = 110_000; // margem de segurança abaixo do limite de execução da function
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

function normalizarTipo(t: string): string {
  return t === "file" ? "document" : t;
}

// A API de leitura de conversas devolve os anexos num formato diferente do
// webhook em tempo real (que manda att.type + att.payload.url): aqui cada tipo
// tem sua própria chave (image_data, video_data, etc.), confirmado testando
// contra uma mensagem real de imagem. Tenta todas as chaves conhecidas.
function extrairAnexo(att: any): { tipo: string; url: string } | null {
  if (!att) return null;
  if (att.image_data?.url) return { tipo: "image", url: att.image_data.url };
  if (att.video_data?.url) return { tipo: "video", url: att.video_data.url };
  if (att.audio_data?.url) return { tipo: "audio", url: att.audio_data.url };
  if (att.file_url) return { tipo: normalizarTipo(att.type || "document"), url: att.file_url };
  if (att.sticker_url) return { tipo: "image", url: att.sticker_url };
  return null;
}

async function persistirMidia(rawUrl: string, tipo: string, mid: string): Promise<string> {
  try {
    const resp = await fetch(rawUrl, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) return rawUrl;
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const buf = new Uint8Array(await resp.arrayBuffer());
    let ext = ({ image: "jpg", video: "mp4", audio: "mp3", document: "bin" } as Record<string, string>)[tipo] || "bin";
    if (ct.includes("png")) ext = "png";
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
    else if (ct.includes("webp")) ext = "webp";
    else if (ct.includes("gif")) ext = "gif";
    else if (ct.includes("mp4")) ext = "mp4";
    else if (ct.includes("ogg") || ct.includes("opus")) ext = "ogg";
    else if (ct.includes("mpeg") || ct.includes("mp3")) ext = "mp3";
    else if (ct.includes("pdf")) ext = "pdf";
    else if (ct.includes("wordprocessingml") || ct.includes("msword")) ext = "docx";
    else if (ct.includes("spreadsheetml") || ct.includes("ms-excel")) ext = "xlsx";
    else if (ct.includes("presentationml") || ct.includes("ms-powerpoint")) ext = "pptx";
    else if (ct.includes("csv")) ext = "csv";
    else if (ct.includes("plain")) ext = "txt";
    else if (ct.includes("zip")) ext = "zip";
    else if (ct.includes("aac")) ext = "aac";
    else if (ct.includes("m4a") || ct.includes("x-m4a")) ext = "m4a";
    const safe = (mid || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `instagram-media/${safe}.${ext}`;
    const { error } = await supabase.storage.from("documentos").upload(path, buf, {
      contentType: ct || "application/octet-stream",
      upsert: true,
    });
    if (error) return rawUrl;
    const { data: signed } = await supabase.storage.from("documentos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return signed?.signedUrl || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function graphGet(url: string, params: Record<string, string>): Promise<any> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const resp = await fetch(u.toString(), { signal: AbortSignal.timeout(25000) });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Graph API erro ${resp.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  if (!IG_TOKEN) {
    return new Response(JSON.stringify({ success: false, error: "INSTAGRAM_ACCESS_TOKEN não configurado" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const since: string | null = body?.since || null; // ISO date opcional, ex "2026-08-01"
  const sinceMs = since ? new Date(since).getTime() : 0;

  // Estado persistido (supabase/migrations/20260820230000_instagram_backfill_state.sql):
  // enquanto a varredura completa do histórico não terminou, cada execução do
  // cron retoma sozinha de onde a anterior parou. Depois de completa, cada
  // execução só revisa a 1ª página (atividade recente) — rede de segurança
  // leve, sem reprocessar todo o histórico de novo a cada 20 min.
  const { data: stateRow } = await supabase.from("instagram_backfill_state").select("*").limit(1).maybeSingle();
  const resumeUrl: string | null = body?.resumeUrl ?? stateRow?.resume_url ?? null;
  const fullySyncedBefore: boolean = !body?.resumeUrl && !!stateRow?.fully_synced;
  const maxPages = fullySyncedBefore ? 1 : Infinity;
  let paginasProcessadas = 0;

  let conversasProcessadas = 0;
  let mensagensEncontradas = 0;
  let mensagensSalvas = 0;
  let mensagensDuplicadas = 0;
  const erros: string[] = [];
  let paginaIncompleta = false;

  try {
    const me = await graphGet("https://graph.instagram.com/v21.0/me", { fields: "id", access_token: IG_TOKEN });
    const businessId = me.id;

    let conversationsUrl = resumeUrl || "https://graph.instagram.com/v21.0/me/conversations";
    let conversationsParams: Record<string, string> = resumeUrl
      ? {}
      : { platform: "instagram", access_token: IG_TOKEN, limit: "50" };

    let paradaSoPorLimiteDePaginas = false;
    conversationsLoop:
    while (conversationsUrl) {
      if (outOfTime()) { paginaIncompleta = true; break; }
      if (paginasProcessadas >= maxPages) { paradaSoPorLimiteDePaginas = true; break; }
      const convPage = await graphGet(conversationsUrl, conversationsParams);
      paginasProcessadas++;
      const conversations: any[] = convPage.data || [];

      for (const conv of conversations) {
        if (outOfTime()) { paginaIncompleta = true; break conversationsLoop; }
        conversasProcessadas++;
        // Pequena pausa entre conversas — a Meta aplica rate limit por app e
        // uma varredura de todo o histórico sem respiro estoura ele rápido.
        if (conversasProcessadas > 1) await new Promise((r) => setTimeout(r, 350));

        try {
          let msgUrl = `https://graph.instagram.com/v21.0/${conv.id}`;
          let msgParams: Record<string, string> = {
            fields: "messages.limit(100){id,created_time,from,to,message,attachments}",
            access_token: IG_TOKEN,
          };
          let nextMsgUrl: string | null = null;
          let firstFetch = true;

          do {
            const page = firstFetch
              ? await graphGet(msgUrl, msgParams)
              : await graphGet(nextMsgUrl!, {});
            firstFetch = false;

            const msgs: any[] = page.messages?.data ?? page.data ?? [];
            nextMsgUrl = page.messages?.paging?.next ?? page.paging?.next ?? null;

            let paginaTemAntigo = false;
            for (const m of msgs) {
              const createdMs = new Date(m.created_time).getTime();
              if (sinceMs && createdMs < sinceMs) { paginaTemAntigo = true; continue; }
              mensagensEncontradas++;

              const mid = m.id;
              const { data: existing } = await supabase
                .from("manychat_mensagens")
                .select("id")
                .eq("metadata->>mid", mid)
                .maybeSingle();
              if (existing) { mensagensDuplicadas++; continue; }

              const fromId = m.from?.id;
              const isEcho = fromId === businessId;
              const contatoIgsid = isEcho ? m.to?.data?.[0]?.id : fromId;
              if (!contatoIgsid) continue;
              const subscriberId = `ig_${contatoIgsid}`;
              const nomeContato = isEcho
                ? (m.to?.data?.[0]?.username ? `@${m.to.data[0].username}` : "Instagram User")
                : (m.from?.username ? `@${m.from.username}` : "Instagram User");

              await supabase.from("manychat_subscribers").upsert(
                { subscriber_id: subscriberId, nome: nomeContato, canal: "instagram", ultima_interacao: m.created_time },
                { onConflict: "subscriber_id", ignoreDuplicates: false },
              );

              const anexos = (m.attachments?.data || []).map(extrairAnexo).filter(Boolean) as { tipo: string; url: string }[];

              if (anexos.length === 0) {
                const conteudo = m.message || "[mensagem não suportada]";
                const { error: msgErr } = await supabase.from("manychat_mensagens").insert({
                  subscriber_id: subscriberId,
                  subscriber_nome: isEcho ? "Atendente" : nomeContato,
                  conteudo,
                  canal: "instagram",
                  tipo: "text",
                  direcao: isEcho ? "saida" : "entrada",
                  created_at: m.created_time,
                  metadata: { mid, igsid: contatoIgsid, source: "instagram_backfill", is_echo: isEcho },
                });
                if (msgErr) erros.push(`msg ${mid}: ${msgErr.message}`); else mensagensSalvas++;
              } else {
                for (let ai = 0; ai < anexos.length; ai++) {
                  const { tipo, url } = anexos[ai];
                  const mediaPublica = await persistirMidia(url, tipo, `${mid}_${ai}`);
                  const { error: msgErr } = await supabase.from("manychat_mensagens").insert({
                    subscriber_id: subscriberId,
                    subscriber_nome: isEcho ? "Atendente" : nomeContato,
                    conteudo: mediaPublica,
                    canal: "instagram",
                    tipo,
                    direcao: isEcho ? "saida" : "entrada",
                    created_at: m.created_time,
                    metadata: {
                      mid, igsid: contatoIgsid, source: "instagram_backfill", is_echo: isEcho,
                      ...(anexos.length > 1 ? { attachment_index: ai } : {}),
                      media_url: mediaPublica,
                    },
                  });
                  if (msgErr) erros.push(`msg ${mid}: ${msgErr.message}`); else mensagensSalvas++;
                }
              }
            }

            // Se já chegamos em mensagens anteriores ao "since", não precisa
            // paginar mais fundo nesta conversa (mensagens vêm mais recentes
            // primeiro).
            if (sinceMs && paginaTemAntigo) { nextMsgUrl = null; }
            if (outOfTime()) { paginaIncompleta = true; break; }
          } while (nextMsgUrl);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          erros.push(`conversa ${conv.id}: ${msg}`);
          // Circuit breaker: se a Meta já está limitando, parar o resto do lote
          // e devolver resumeUrl em vez de insistir e acumular só mais do mesmo
          // erro (a próxima chamada, mais tarde, tenta de novo daqui).
          if (/request limit reached/i.test(msg)) { paginaIncompleta = true; break conversationsLoop; }
        }
      }

      conversationsUrl = convPage.paging?.next || "";
      conversationsParams = {};
      if (!conversationsUrl) break;
    }

    // Persiste o estado pro cron continuar sozinho na próxima execução:
    // - Chegou ao fim de verdade (sem mais páginas) → marca sincronizado.
    // - Parou só pelo limite de 1 página (checagem de manutenção, já estava
    //   sincronizado) → mantém sincronizado, sem cursor.
    // - Parou por tempo/rate-limit no meio da varredura → guarda onde parar.
    const chegouAoFim = !paginaIncompleta && !paradaSoPorLimiteDePaginas;
    const novoFullySynced = chegouAoFim || fullySyncedBefore;
    const novoResumeUrl = (paginaIncompleta && !chegouAoFim) ? (conversationsUrl || null) : null;
    if (stateRow?.id) {
      await supabase.from("instagram_backfill_state").update({
        resume_url: novoResumeUrl,
        fully_synced: novoFullySynced,
        updated_at: new Date().toISOString(),
      }).eq("id", stateRow.id);
    }

    return new Response(JSON.stringify({
      success: true,
      conversasProcessadas,
      mensagensEncontradas,
      mensagensSalvas,
      mensagensDuplicadas,
      paginaIncompleta,
      fullySynced: novoFullySynced,
      resumeUrl: novoResumeUrl,
      erros: erros.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[IG Backfill] erro fatal:", message);
    return new Response(JSON.stringify({
      success: false, error: message,
      conversasProcessadas, mensagensEncontradas, mensagensSalvas, mensagensDuplicadas, erros,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
