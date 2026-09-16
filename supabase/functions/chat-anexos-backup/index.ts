// Backup em background dos anexos do chat (documento/foto/áudio/vídeo) pro
// armazenamento secundário (Cloudflare R2, Worker chat-storage) — pedido do
// usuário por redundância, sem trocar o que o chat lê hoje. NUNCA toca no
// caminho ao vivo de enviar/receber mensagem: só varre `manychat_mensagens`
// em lotes pequenos e copia o que ainda não tem `r2_backup_key`. Se o R2/
// Worker estiver fora do ar, essa função falha sozinha — zero impacto no
// resto do chat. Disparada por pg_cron (ver migration
// 20260916161900_cron_chat_anexos_backup.sql), a cada 15min.
const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CHAT_STORAGE_URL = Deno.env.get('CHAT_STORAGE_URL');
const CHAT_STORAGE_SECRET = Deno.env.get('CHAT_STORAGE_SECRET');

// Lote pequeno por rodada — cada item é 1 download + 1 upload; não vale a
// pena arriscar estourar o tempo de execução da function nem sobrecarregar
// o Worker. Com 16,7 mil mensagens de mídia represadas no histórico e cron
// a cada 15min, dá pra zerar o backlog em poucos dias sem pressa nenhuma.
const LOTE = 50;

function extensaoPorContentType(ct: string): string {
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('ogg') || ct.includes('opus')) return 'ogg';
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3';
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('wordprocessingml') || ct.includes('msword')) return 'docx';
  if (ct.includes('spreadsheetml') || ct.includes('ms-excel')) return 'xlsx';
  if (ct.includes('presentationml') || ct.includes('ms-powerpoint')) return 'pptx';
  if (ct.includes('aac')) return 'aac';
  if (ct.includes('m4a') || ct.includes('x-m4a')) return 'm4a';
  return 'bin';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!CHAT_STORAGE_URL || !CHAT_STORAGE_SECRET) {
    return new Response(JSON.stringify({ error: 'CHAT_STORAGE_URL/CHAT_STORAGE_SECRET não configurados.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: pendentes, error: selectError } = await supabase
      .from('manychat_mensagens')
      .select('id, conteudo, tipo, message_id_key')
      .is('r2_backup_key', null)
      .in('tipo', ['image', 'audio', 'document', 'video'])
      .order('created_at', { ascending: true })
      .limit(LOTE);

    if (selectError) throw selectError;

    let sucesso = 0;
    let falhas = 0;

    for (const msg of pendentes || []) {
      try {
        const urlAtual = (msg.conteudo || '').trim();
        if (!urlAtual || !/^https?:\/\//i.test(urlAtual)) { falhas++; continue; }

        const resp = await fetch(urlAtual, { signal: AbortSignal.timeout(20000) });
        if (!resp.ok) { falhas++; continue; }

        const contentType = resp.headers.get('content-type') || 'application/octet-stream';
        const bytes = await resp.arrayBuffer();
        const ext = extensaoPorContentType(contentType.toLowerCase());
        const safe = (msg.message_id_key || msg.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        const key = `manychat/${safe}.${ext}`;

        const uploadResp = await fetch(`${CHAT_STORAGE_URL}/upload`, {
          method: 'POST',
          headers: {
            'X-Chat-Storage-Secret': CHAT_STORAGE_SECRET,
            'X-File-Key': key,
            'Content-Type': contentType,
          },
          body: bytes,
          signal: AbortSignal.timeout(20000),
        });

        if (!uploadResp.ok) { falhas++; continue; }

        await supabase.from('manychat_mensagens').update({ r2_backup_key: key }).eq('id', msg.id);
        sucesso++;
      } catch (e) {
        console.error('[chat-anexos-backup] erro processando mensagem', msg.id, e);
        falhas++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processados: (pendentes || []).length,
      sucesso,
      falhas,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[chat-anexos-backup] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
