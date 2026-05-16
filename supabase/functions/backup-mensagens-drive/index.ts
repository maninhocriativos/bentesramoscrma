const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COLS = ['id', 'created_at', 'lead_id', 'subscriber_id', 'subscriber_nome', 'conteudo', 'direcao', 'tipo', 'canal'];
const PAGE_SIZE = 1000;
const CHUNK_SIZE = 20;

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

// ─── Drive helpers ─────────────────────────────────────────────────────────
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

async function createDriveFile(accessToken: string, folderId: string, fileName: string, content: string | Uint8Array, mimeType: string): Promise<string> {
  const boundary = '----Boundary9MA5ZWxkTrZu1gX';
  const meta = JSON.stringify({ name: fileName, parents: [folderId] });
  const isBytes = content instanceof Uint8Array;
  const bodyContent = isBytes ? btoa(String.fromCharCode(...content)) : content;
  const transferEncoding = isBytes ? 'Content-Transfer-Encoding: base64\r\n' : '';
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n${transferEncoding}\r\n${bodyContent}\r\n--${boundary}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(`Drive create error: ${JSON.stringify(result)}`);
  return result.id as string;
}

async function updateDriveFile(accessToken: string, fileId: string, content: string | Uint8Array, mimeType: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mimeType },
    body: content as unknown as BodyInit,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Drive update error: ${JSON.stringify(err)}`);
  }
}

async function upsertDriveFile(
  accessToken: string, folderId: string, fileName: string, content: string,
  mimeType: string, existingFiles: Map<string, string>,
): Promise<string> {
  const existingId = existingFiles.get(fileName);
  if (existingId) { await updateDriveFile(accessToken, existingId, content, mimeType); return existingId; }
  const newId = await createDriveFile(accessToken, folderId, fileName, content, mimeType);
  existingFiles.set(fileName, newId);
  return newId;
}

async function ensureSubfolder(accessToken: string, parentId: string, folderName: string, folderCache: Map<string, string>): Promise<string> {
  const cacheKey = `${parentId}::${folderName}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;
  const q = encodeURIComponent(`'${parentId}' in parents and name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.files?.length > 0) { folderCache.set(cacheKey, data.files[0].id); return data.files[0].id; }
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error(`Falha ao criar pasta "${folderName}": ${JSON.stringify(created)}`);
  folderCache.set(cacheKey, created.id);
  return created.id;
}

// ─── Helpers de texto ──────────────────────────────────────────────────────
function sanitizeNome(nome: string): string {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s_\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

function getNomeLead(lead: Record<string, unknown> | null, msgs: Record<string, unknown>[], leadId: string): string {
  const fromLead = String(lead?.nome || '').trim();
  if (fromLead) return fromLead;
  // Fallback: nome do contato nas mensagens de entrada
  const fromMsg = msgs.find(m => m.direcao === 'entrada' && m.subscriber_nome);
  if (fromMsg) return String(fromMsg.subscriber_nome).trim();
  return `Lead ${leadId.slice(0, 8)}`;
}

function getExtFromUrl(url: string, contentType: string): string {
  const extFromUrl = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mp3', 'ogg', 'pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extFromUrl)) return extFromUrl;
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('mp3') || contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('ogg')) return 'ogg';
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('msword')) return 'doc';
  if (contentType.includes('wordprocessingml')) return 'docx';
  return 'bin';
}

// ─── CSV ───────────────────────────────────────────────────────────────────
function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  return `"${String(val).replace(/"/g, '""')}"`;
}
function buildCsv(msgs: Record<string, unknown>[]): string {
  return [COLS.join(','), ...msgs.map(m => COLS.map(c => csvCell(m[c])).join(','))].join('\r\n');
}

// ─── TXT de conversa ──────────────────────────────────────────────────────
const TIPOS_MIDIA = ['image', 'video', 'audio', 'file', 'document', 'sticker'];

function buildConversaTxt(lead: Record<string, unknown> | null, msgs: Record<string, unknown>[], nome: string): string {
  const sep = '='.repeat(60);
  const lines = [
    `CONVERSA: ${nome}`,
    sep,
    `Lead ID:   ${lead?.id ?? '-'}`,
    `Telefone:  ${lead?.telefone ?? '-'}`,
    `Status:    ${lead?.status ?? '-'}`,
    `Tipo Ação: ${lead?.tipo_acao ?? '-'}`,
    `Mensagens: ${msgs.length}`,
    `Atualizado:${new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' })}`,
    sep,
    '',
  ];
  for (const msg of msgs) {
    const dt  = new Date(String(msg.created_at)).toLocaleString('pt-BR', { timeZone: 'America/Manaus' });
    const dir = msg.direcao === 'saida' ? '→' : '←';
    const rem = msg.direcao === 'saida' ? String(msg.subscriber_nome || 'Bot') : nome;
    const tipo = String(msg.tipo || 'text');
    const isMedia = TIPOS_MIDIA.includes(tipo);
    const conteudo = String(msg.conteudo || '');
    const txt = isMedia
      ? `[${tipo.toUpperCase()}] ${conteudo || '(sem URL)'}`
      : (conteudo || '[vazio]');
    lines.push(`[${dt}] ${dir} ${rem}`);
    lines.push(`   ${txt}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ─── Backup de mídias ─────────────────────────────────────────────────────
async function backupMediaFiles(
  accessToken: string, leadFolderId: string,
  msgs: Record<string, unknown>[],
  folderCache: Map<string, string>,
): Promise<{ saved: number; errors: number }> {
  const mediaMsgs = msgs.filter(m => {
    const tipo = String(m.tipo || '');
    const conteudo = String(m.conteudo || '');
    return TIPOS_MIDIA.includes(tipo) && conteudo.startsWith('http');
  });
  if (mediaMsgs.length === 0) return { saved: 0, errors: 0 };

  const mediaFolderId = await ensureSubfolder(accessToken, leadFolderId, 'Midias', folderCache);
  const existingMedia = await listDriveFiles(accessToken, mediaFolderId);

  let saved = 0;
  let errors = 0;

  for (const msg of mediaMsgs) {
    const url = String(msg.conteudo);
    const ts = String(msg.created_at || '').replace(/[:.]/g, '-').slice(0, 19);
    const tipo = String(msg.tipo || 'file');
    try {
      const mediaRes = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!mediaRes.ok) { errors++; continue; }
      const contentType = mediaRes.headers.get('content-type') || '';
      const ext = getExtFromUrl(url, contentType);
      const fileName = `${ts}_${tipo}.${ext}`;
      if (existingMedia.has(fileName)) { saved++; continue; } // já existe
      const bytes = new Uint8Array(await mediaRes.arrayBuffer());
      await createDriveFile(accessToken, mediaFolderId, fileName, bytes, contentType || 'application/octet-stream');
      existingMedia.set(fileName, 'new');
      saved++;
    } catch {
      errors++;
    }
  }
  return { saved, errors };
}

// ─── Backup de uma pasta de lead ──────────────────────────────────────────
async function backupLeadFolder(
  accessToken: string, rootFolderId: string,
  folderCache: Map<string, string>,
  leadId: string,
  lead: Record<string, unknown> | null,
  msgs: Record<string, unknown>[],
  includeMedia: boolean,
): Promise<{ criado: boolean; midias: { saved: number; errors: number } }> {
  if (msgs.length === 0) return { criado: false, midias: { saved: 0, errors: 0 } };

  const nome = getNomeLead(lead, msgs, leadId);
  const folderName = sanitizeNome(nome) || `Lead ${leadId.slice(0, 8)}`;

  const subFolderId = await ensureSubfolder(accessToken, rootFolderId, folderName, folderCache);
  const existingInFolder = await listDriveFiles(accessToken, subFolderId);

  const content = buildConversaTxt(lead, msgs, nome);
  const existingTxtId = existingInFolder.get('conversa.txt');
  let criado = false;
  if (existingTxtId) {
    await updateDriveFile(accessToken, existingTxtId, content, 'text/plain; charset=utf-8');
  } else {
    await createDriveFile(accessToken, subFolderId, 'conversa.txt', content, 'text/plain; charset=utf-8');
    criado = true;
  }

  let midias = { saved: 0, errors: 0 };
  if (includeMedia) {
    midias = await backupMediaFiles(accessToken, subFolderId, msgs, folderCache);
  }

  return { criado, midias };
}

// ─── Buscar mensagens paginado ─────────────────────────────────────────────
async function fetchMessages(supabase: ReturnType<typeof createClient>, from?: string, to?: string, leadIds?: string[]) {
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    let q = supabase
      .from('manychat_mensagens')
      .select('id, created_at, lead_id, subscriber_id, subscriber_nome, conteudo, direcao, tipo, canal')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (from)     q = q.gte('created_at', from);
    if (to)       q = q.lte('created_at', to);
    if (leadIds)  q = q.in('lead_id', leadIds);
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

// ─── Main ──────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase     = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim();
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')?.trim();
    const folderId     = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')?.trim();

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      return new Response(JSON.stringify({ error: 'Secrets do Google não configurados' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body        = await req.json().catch(() => ({})) as Record<string, unknown>;
    const fullBackup  = body.full_backup === true;
    const chunkBackup = body.chunk_backup === true;
    const chunkIndex  = Number(body.chunk_index ?? 0);
    const includeMedia = body.include_media !== false; // padrão: true
    const hoje        = new Date().toISOString().slice(0, 10);

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const folderCache = new Map<string, string>();

    // ════════════════════════════════════════════════════════════════
    // CHUNK BACKUP — 20 leads por chamada, processa histórico completo
    // ════════════════════════════════════════════════════════════════
    if (chunkBackup) {
      // Contar total de leads com mensagens
      const { count: totalLeads } = await supabase
        .from('leads_juridicos')
        .select('id', { count: 'exact', head: true });

      const total = totalLeads ?? 0;
      const totalChunks = Math.ceil(total / CHUNK_SIZE);
      const from = chunkIndex * CHUNK_SIZE;
      const to   = from + CHUNK_SIZE - 1;

      // Buscar página de leads
      const { data: leadsPage, error: leadsErr } = await supabase
        .from('leads_juridicos')
        .select('id, nome, telefone, status, tipo_acao')
        .order('id')
        .range(from, to);

      if (leadsErr) console.error('[Chunk] Erro ao buscar leads:', leadsErr);

      if (!leadsPage || leadsPage.length === 0) {
        return new Response(JSON.stringify({ success: true, done: true, total_leads: total }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const leadIds = leadsPage.map((l: Record<string, unknown>) => String(l.id));
      const leadsMap = new Map(leadsPage.map((l: Record<string, unknown>) => [String(l.id), l]));

      // Buscar todas as mensagens destes leads
      const msgs = await fetchMessages(supabase, undefined, undefined, leadIds);
      const msgsByLead = new Map<string, Record<string, unknown>[]>();
      for (const m of msgs) {
        if (!m.lead_id) continue;
        const lid = String(m.lead_id);
        if (!msgsByLead.has(lid)) msgsByLead.set(lid, []);
        msgsByLead.get(lid)!.push(m);
      }

      let criados = 0; let atualizados = 0; let midiasSalvas = 0; let midiasErros = 0;

      for (const leadId of leadIds) {
        try {
          const leadMsgs = msgsByLead.get(leadId) ?? [];
          const lead = leadsMap.get(leadId) as Record<string, unknown> | undefined ?? null;
          const result = await backupLeadFolder(accessToken, folderId, folderCache, leadId, lead, leadMsgs, includeMedia);
          if (result.criado) criados++; else if (leadMsgs.length > 0) atualizados++;
          midiasSalvas += result.midias.saved;
          midiasErros  += result.midias.errors;
        } catch (e) {
          console.error(`[Chunk] Erro lead ${leadId}:`, e);
        }
      }

      const isDone = (chunkIndex + 1) >= totalChunks;
      return new Response(JSON.stringify({
        success: true,
        chunk_index: chunkIndex,
        leads_processados: leadsPage.length,
        total_leads: total,
        total_chunks: totalChunks,
        next_chunk: isDone ? null : chunkIndex + 1,
        done: isDone,
        txt: { criados, atualizados },
        midias: { salvas: midiasSalvas, erros: midiasErros },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ════════════════════════════════════════════════════════════════
    // FULL BACKUP — pode dar timeout em bases grandes
    // ════════════════════════════════════════════════════════════════
    if (fullBackup) {
      console.log('[Backup] Iniciando exportação completa...');
      const todas  = await fetchMessages(supabase);
      const porMes = groupByMonth(todas);
      const existingFiles = await listDriveFiles(accessToken, folderId);
      const csvFiles: { fileName: string; total: number }[] = [];

      for (const [mes, msgs] of Array.from(porMes.entries()).sort()) {
        const fileName = `mensagens_${mes}.csv`;
        await upsertDriveFile(accessToken, folderId, fileName, buildCsv(msgs), 'text/csv; charset=utf-8', existingFiles);
        csvFiles.push({ fileName, total: msgs.length });
      }

      const msgsByLead = new Map<string, Record<string, unknown>[]>();
      for (const m of todas) {
        if (!m.lead_id) continue;
        const lid = String(m.lead_id);
        if (!msgsByLead.has(lid)) msgsByLead.set(lid, []);
        msgsByLead.get(lid)!.push(m);
      }

      const leadIds = [...msgsByLead.keys()];
      const leadsMap = new Map<string, Record<string, unknown>>();
      for (let i = 0; i < leadIds.length; i += 50) {
        const slice = leadIds.slice(i, i + 50);
        const { data } = await supabase.from('leads_juridicos').select('id, nome, telefone, status, tipo_acao').in('id', slice);
        for (const l of (data ?? []) as Record<string, unknown>[]) leadsMap.set(String(l.id), l);
      }

      let criados = 0; let atualizados = 0;
      for (let i = 0; i < leadIds.length; i += 5) {
        await Promise.all(leadIds.slice(i, i + 5).map(async (leadId) => {
          try {
            const lead = leadsMap.get(leadId) ?? null;
            const r = await backupLeadFolder(accessToken, folderId, folderCache, leadId, lead, msgsByLead.get(leadId) ?? [], false);
            if (r.criado) criados++; else atualizados++;
          } catch (e) { console.error(`[Full] Erro lead ${leadId}:`, e); }
        }));
      }

      return new Response(JSON.stringify({ success: true, full_backup: true, csv: csvFiles, txt: { criados, atualizados }, total_mensagens: todas.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ════════════════════════════════════════════════════════════════
    // BACKUP DIÁRIO — últimas 24h + atualiza TXTs dos leads ativos
    // ════════════════════════════════════════════════════════════════
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const msgs24h = await fetchMessages(supabase, desde);
    console.log(`[Backup] ${msgs24h.length} mensagens nas últimas 24h`);

    const existingFiles = await listDriveFiles(accessToken, folderId);
    const csvFileName = `mensagens_${hoje}.csv`;
    await upsertDriveFile(accessToken, folderId, csvFileName, buildCsv(msgs24h), 'text/csv; charset=utf-8', existingFiles);

    const leadsAtivos = [...new Set(msgs24h.filter(m => m.lead_id).map(m => String(m.lead_id)))];
    let criados = 0; let atualizados = 0; let midiasSalvas = 0;

    if (leadsAtivos.length > 0) {
      const todasMsgs = await fetchMessages(supabase, undefined, undefined, leadsAtivos);
      const msgsByLead = new Map<string, Record<string, unknown>[]>();
      for (const m of todasMsgs) {
        if (!m.lead_id) continue;
        const lid = String(m.lead_id);
        if (!msgsByLead.has(lid)) msgsByLead.set(lid, []);
        msgsByLead.get(lid)!.push(m);
      }

      const leadsMap = new Map<string, Record<string, unknown>>();
      for (let i = 0; i < leadsAtivos.length; i += 50) {
        const { data } = await supabase.from('leads_juridicos').select('id, nome, telefone, status, tipo_acao').in('id', leadsAtivos.slice(i, i + 50));
        for (const l of (data ?? []) as Record<string, unknown>[]) leadsMap.set(String(l.id), l);
      }

      for (let i = 0; i < leadsAtivos.length; i += 5) {
        await Promise.all(leadsAtivos.slice(i, i + 5).map(async (leadId) => {
          try {
            const lead = leadsMap.get(leadId) ?? null;
            const r = await backupLeadFolder(accessToken, folderId, folderCache, leadId, lead, msgsByLead.get(leadId) ?? [], includeMedia);
            if (r.criado) criados++; else atualizados++;
            midiasSalvas += r.midias.saved;
          } catch (e) { console.error(`[Diário] Erro lead ${leadId}:`, e); }
        }));
      }
    }

    return new Response(JSON.stringify({ success: true, csv: csvFileName, txt: { total: leadsAtivos.length, criados, atualizados }, midias: { salvas: midiasSalvas }, total_mensagens: msgs24h.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Backup] ❌', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
