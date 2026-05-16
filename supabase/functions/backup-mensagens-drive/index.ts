const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COLS = ['id', 'created_at', 'lead_id', 'subscriber_id', 'subscriber_nome', 'conteudo', 'direcao', 'tipo', 'canal'];
const PAGE_SIZE = 1000;

// ─── OAuth ─────────────────────────────────────────────────────────────────
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }).toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Listar arquivos na pasta do Drive ────────────────────────────────────
async function listDriveFiles(accessToken: string, folderId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
    url.searchParams.set('fields', 'nextPageToken,files(id,name)');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const data = await res.json();
    for (const f of data.files ?? []) map.set(f.name, f.id);
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return map;
}

// ─── Criar arquivo no Drive ────────────────────────────────────────────────
async function createDriveFile(accessToken: string, folderId: string, fileName: string, content: string, mimeType: string): Promise<string> {
  const boundary = '----Boundary9MA5ZWxkTrZu1gX';
  const meta = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(`Drive create error: ${JSON.stringify(result)}`);
  return result.id as string;
}

// ─── Atualizar arquivo existente no Drive (sobrescreve) ───────────────────
async function updateDriveFile(accessToken: string, fileId: string, content: string, mimeType: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mimeType },
    body: content,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Drive update error: ${JSON.stringify(err)}`);
  }
}

// ─── Criar ou sobrescrever arquivo ────────────────────────────────────────
async function upsertDriveFile(
  accessToken: string, folderId: string, fileName: string, content: string,
  mimeType: string, existingFiles: Map<string, string>,
): Promise<string> {
  const existingId = existingFiles.get(fileName);
  if (existingId) {
    await updateDriveFile(accessToken, existingId, content, mimeType);
    return existingId;
  }
  const newId = await createDriveFile(accessToken, folderId, fileName, content, mimeType);
  existingFiles.set(fileName, newId);
  return newId;
}

// ─── CSV ───────────────────────────────────────────────────────────────────
function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}
function buildCsv(msgs: Record<string, unknown>[]): string {
  return [COLS.join(','), ...msgs.map(m => COLS.map(c => csvCell(m[c])).join(','))].join('\r\n');
}

// ─── TXT de conversa por lead ─────────────────────────────────────────────
function buildConversaTxt(lead: Record<string, unknown> | null, msgs: Record<string, unknown>[]): string {
  const nome = String(lead?.nome || 'Lead Sem Nome');
  const sep  = '='.repeat(60);
  const lines = [
    `CONVERSA: ${nome}`,
    sep,
    `Lead ID:   ${lead?.id ?? '-'}`,
    `Telefone:  ${lead?.telefone ?? '-'}`,
    `Status:    ${lead?.status ?? '-'}`,
    `Área:      ${lead?.area_juridica ?? '-'}`,
    `Mensagens: ${msgs.length}`,
    `Atualizado:${new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' })}`,
    sep,
    '',
  ];
  for (const msg of msgs) {
    const dt  = new Date(String(msg.created_at)).toLocaleString('pt-BR', { timeZone: 'America/Manaus' });
    const dir = msg.direcao === 'saida' ? '→' : '←';
    const rem = msg.direcao === 'saida' ? String(msg.subscriber_nome || 'Bot') : nome;
    const txt = String(msg.conteudo || '[mídia]');
    lines.push(`[${dt}] ${dir} ${rem}`);
    lines.push(`   ${txt}`);
    lines.push('');
  }
  return lines.join('\n');
}

function sanitizeNome(nome: string): string {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

// ─── Buscar mensagens paginado ─────────────────────────────────────────────
async function fetchMessages(supabase: ReturnType<typeof createClient>, from?: string, to?: string, leadId?: string) {
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    let q = supabase
      .from('manychat_mensagens')
      .select('id, created_at, lead_id, subscriber_id, subscriber_nome, conteudo, direcao, tipo, canal')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (from)   q = q.gte('created_at', from);
    if (to)     q = q.lte('created_at', to);
    if (leadId) q = q.eq('lead_id', leadId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

function groupByMonth(msgs: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const m of msgs) {
    const month = String(m.created_at ?? '').slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(m);
  }
  return map;
}

// ─── Backup de TXT dos leads ──────────────────────────────────────────────
async function backupLeadTxts(
  supabase: ReturnType<typeof createClient>,
  accessToken: string, folderId: string,
  existingFiles: Map<string, string>,
  onlyLeadIds?: string[],
): Promise<{ total: number; criados: number; atualizados: number }> {
  // Determinar quais leads processar
  let leadIds: string[];
  if (onlyLeadIds) {
    leadIds = onlyLeadIds;
  } else {
    const { data } = await supabase
      .from('manychat_mensagens')
      .select('lead_id')
      .not('lead_id', 'is', null);
    leadIds = [...new Set(((data ?? []) as Record<string, unknown>[]).map(r => String(r.lead_id)))];
  }

  let criados = 0;
  let atualizados = 0;

  for (const leadId of leadIds) {
    try {
      const { data: lead } = await supabase.from('leads_juridicos').select('id, nome, telefone, status, area_juridica').eq('id', leadId).maybeSingle();
      const msgs = await fetchMessages(supabase, undefined, undefined, leadId);
      if (msgs.length === 0) continue;

      const nome = String((lead as Record<string, unknown>)?.nome || 'Lead_Sem_Nome');
      const fileName = `lead_${leadId}_${sanitizeNome(nome)}.txt`;
      const content  = buildConversaTxt(lead as Record<string, unknown>, msgs);

      const wasExisting = existingFiles.has(fileName);
      await upsertDriveFile(accessToken, folderId, fileName, content, 'text/plain; charset=utf-8', existingFiles);
      if (wasExisting) atualizados++; else criados++;
    } catch (e) {
      console.error(`[Backup] Erro no lead ${leadId}:`, e);
    }
  }

  return { total: leadIds.length, criados, atualizados };
}

// ─── Main ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim();
    const folderId     = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')?.trim();

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      return new Response(JSON.stringify({ error: 'Secrets do Google não configurados' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body       = await req.json().catch(() => ({})) as Record<string, unknown>;
    const fullBackup = body.full_backup === true;
    const hoje       = new Date().toISOString().slice(0, 10);

    const accessToken   = await getAccessToken(clientId, clientSecret, refreshToken);
    const existingFiles = await listDriveFiles(accessToken, folderId);

    if (fullBackup) {
      // ── Exportação completa: CSV por mês + TXT por lead ──────────────────
      console.log('[Backup] Iniciando exportação completa...');
      const todas   = await fetchMessages(supabase);
      const porMes  = groupByMonth(todas);
      const csvFiles: { fileName: string; total: number }[] = [];

      for (const [mes, msgs] of Array.from(porMes.entries()).sort()) {
        const fileName = `mensagens_${mes}.csv`;
        await upsertDriveFile(accessToken, folderId, fileName, buildCsv(msgs), 'text/csv; charset=utf-8', existingFiles);
        csvFiles.push({ fileName, total: msgs.length });
        console.log(`[Backup] CSV ${fileName} — ${msgs.length} msgs`);
      }

      const txtStats = await backupLeadTxts(supabase, accessToken, folderId, existingFiles);
      console.log(`[Backup] TXTs: ${txtStats.criados} criados, ${txtStats.atualizados} atualizados`);

      return new Response(
        JSON.stringify({ success: true, full_backup: true, csv: csvFiles, txt: txtStats, total_mensagens: todas.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } else {
      // ── Backup diário: CSV 24h + TXT dos leads com atividade recente ─────
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const msgs  = await fetchMessages(supabase, desde);
      console.log(`[Backup] ${msgs.length} mensagens nas últimas 24h`);

      // CSV diário
      const csvFileName = `mensagens_${hoje}.csv`;
      await upsertDriveFile(accessToken, folderId, csvFileName, buildCsv(msgs), 'text/csv; charset=utf-8', existingFiles);

      // TXT apenas dos leads com atividade nas últimas 24h
      const leadsAtivos = [...new Set(msgs.filter(m => m.lead_id).map(m => String(m.lead_id)))];
      const txtStats = await backupLeadTxts(supabase, accessToken, folderId, existingFiles, leadsAtivos);
      console.log(`[Backup] ✅ CSV diário + ${txtStats.criados} TXTs criados, ${txtStats.atualizados} atualizados`);

      return new Response(
        JSON.stringify({ success: true, csv: csvFileName, txt: txtStats, total_mensagens: msgs.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Backup] ❌', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
