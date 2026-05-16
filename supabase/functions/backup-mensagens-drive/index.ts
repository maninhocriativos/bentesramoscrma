const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COLS = ['id', 'created_at', 'lead_id', 'subscriber_id', 'subscriber_nome', 'conteudo', 'direcao', 'tipo', 'canal'];
const PAGE_SIZE = 1000;

// ─── OAuth com refresh token (conta real Google) ───────────────────────────
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Upload multipart para Google Drive ───────────────────────────────────
async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
): Promise<string> {
  const boundary = '----FormBoundary7MA4YWxkTrZu0gW';
  const metaJson = JSON.stringify({ name: fileName, parents: [folderId] });
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metaJson}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/csv; charset=utf-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const result = await res.json();
  if (!res.ok) throw new Error(`Drive upload error: ${JSON.stringify(result)}`);
  return result.id as string;
}

// ─── Escapar campo CSV ─────────────────────────────────────────────────────
function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

// ─── Buscar mensagens paginado ─────────────────────────────────────────────
async function fetchAllMessages(supabase: ReturnType<typeof createClient>, from?: string, to?: string) {
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    let q = supabase
      .from('manychat_mensagens')
      .select('id, created_at, lead_id, subscriber_id, subscriber_nome, conteudo, direcao, tipo, canal')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

// ─── Agrupar por mês ───────────────────────────────────────────────────────
function groupByMonth(msgs: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const m of msgs) {
    const month = String(m.created_at ?? '').slice(0, 7); // YYYY-MM
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(m);
  }
  return map;
}

// ─── Montar CSV ────────────────────────────────────────────────────────────
function buildCsv(msgs: Record<string, unknown>[]): string {
  const rows = [COLS.join(',')];
  for (const msg of msgs) {
    rows.push(COLS.map(c => csvCell(msg[c])).join(','));
  }
  return rows.join('\r\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim();
    const folderId     = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')?.trim();

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      return new Response(
        JSON.stringify({ error: 'Variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN e GOOGLE_DRIVE_FOLDER_ID são obrigatórias' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const fullBackup = body.full_backup === true;
    const hoje = new Date().toISOString().slice(0, 10);

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const arquivos: { fileName: string; fileId: string; total: number }[] = [];

    if (fullBackup) {
      // ── Exportação completa: um arquivo por mês ──────────────────────────
      console.log('[Backup] Iniciando exportação completa por mês...');
      const todas = await fetchAllMessages(supabase);
      const porMes = groupByMonth(todas);

      for (const [mes, msgs] of Array.from(porMes.entries()).sort()) {
        const fileName = `mensagens_${mes}.csv`;
        const csv = buildCsv(msgs);
        const fileId = await uploadToDrive(accessToken, folderId, fileName, csv);
        arquivos.push({ fileName, fileId, total: msgs.length });
        console.log(`[Backup] ✅ ${fileName} — ${msgs.length} mensagens`);
      }

      const totalGeral = arquivos.reduce((s, a) => s + a.total, 0);
      console.log(`[Backup] Exportação completa concluída: ${totalGeral} mensagens em ${arquivos.length} arquivos`);

      return new Response(
        JSON.stringify({ success: true, full_backup: true, arquivos, total: totalGeral }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } else {
      // ── Backup diário: últimas 24h ───────────────────────────────────────
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const msgs = await fetchAllMessages(supabase, desde);
      console.log(`[Backup] ${msgs.length} mensagens desde ${desde}`);

      const csv = buildCsv(msgs);
      const fileName = `mensagens_${hoje}.csv`;
      const fileId = await uploadToDrive(accessToken, folderId, fileName, csv);
      console.log(`[Backup] ✅ ${fileName} (id=${fileId})`);

      return new Response(
        JSON.stringify({ success: true, fileId, fileName, total: msgs.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Backup] ❌', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
