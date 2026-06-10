const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

// Restaura contatos e mensagens do chat a partir de um backup no Google Drive
// (gerado por backup-chat-drive). Faz UPSERT — nunca apaga: repõe registros
// perdidos e mantém os atuais (mensagens mais novas que o backup não são tocadas).
// Body: { backup?: "2026-06-07_03h00" (default: mais recente), user_id?, dry_run? }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getGoogleCredentials(supabase: any) {
  const { data } = await supabase.from('app_settings').select('key, value')
    .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  const s = (data || []).reduce((acc: Record<string, string>, i: any) => { acc[i.key] = i.value; return acc; }, {});
  return { clientId: s['GOOGLE_OAUTH_CLIENT_ID'] || null, clientSecret: s['GOOGLE_OAUTH_CLIENT_SECRET'] || null };
}

async function refreshAccessToken(supabase: any, userId: string) {
  const { data: tokenRow } = await supabase.from('google_drive_tokens').select('*').eq('user_id', userId).single();
  if (!tokenRow) throw new Error('Google Drive não conectado.');
  if (new Date(tokenRow.expires_at) > new Date(Date.now() + 60000)) return tokenRow.access_token;
  const { clientId, clientSecret } = await getGoogleCredentials(supabase);
  if (!clientId || !clientSecret) throw new Error('Credenciais Google não configuradas');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: tokenRow.refresh_token, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error(`Erro ao renovar token: ${tokens.error}`);
  await supabase.from('google_drive_tokens').update({ access_token: tokens.access_token, expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString() }).eq('user_id', userId);
  return tokens.access_token;
}

async function findFolder(accessToken: string, name: string, parentId: string) {
  const q = `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

async function listChildren(accessToken: string, parentId: string, foldersOnly = false) {
  const mime = foldersOnly ? " and mimeType = 'application/vnd.google-apps.folder'" : '';
  const q = `'${parentId}' in parents and trashed = false${mime}`;
  const out: { id: string; name: string }[] = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'nextPageToken,files(id,name)');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const data = await res.json();
    out.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function downloadJson(accessToken: string, fileId: string): Promise<any> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Erro ao baixar arquivo ${fileId}`);
  return await res.json();
}

async function upsertEmLotes(supabase: any, tabela: string, registros: any[], onConflict: string): Promise<number> {
  let total = 0;
  const LOTE = 500;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE);
    const { error } = await supabase.from(tabela).upsert(lote, { onConflict, ignoreDuplicates: false });
    if (error) {
      console.error(`[restore] Erro no lote de ${tabela}:`, error.message);
      throw new Error(`Falha ao restaurar ${tabela}: ${error.message}`);
    }
    total += lote.length;
  }
  return total;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const body = await req.json().catch(() => ({}));
    let userId = body.user_id;
    const dryRun = !!body.dry_run;

    if (!userId) {
      const { data: tokenRow } = await supabase.from('google_drive_tokens').select('user_id').order('updated_at', { ascending: false }).limit(1).single();
      if (!tokenRow) throw new Error('Nenhum usuário com Google Drive conectado');
      userId = tokenRow.user_id;
    }

    const accessToken = await refreshAccessToken(supabase, userId);

    // Localiza a pasta do backup: Backups - CRM / Chat / <backup>
    const baseFolderId = await findFolder(accessToken, 'Backups - CRM', 'root');
    if (!baseFolderId) throw new Error('Pasta "Backups - CRM" não encontrada no Drive');
    const chatFolderId = await findFolder(accessToken, 'Chat', baseFolderId);
    if (!chatFolderId) throw new Error('Pasta "Chat" não encontrada no Drive');

    const subpastas = await listChildren(accessToken, chatFolderId, true);
    if (subpastas.length === 0) throw new Error('Nenhum backup encontrado na pasta Chat');

    // Backup escolhido (ou o mais recente pelo nome YYYY-MM-DD_HHhMM)
    let alvo = body.backup
      ? subpastas.find(p => p.name === body.backup)
      : [...subpastas].sort((a, b) => b.name.localeCompare(a.name))[0];
    if (!alvo) throw new Error(`Backup "${body.backup}" não encontrado. Disponíveis: ${subpastas.map(p => p.name).join(', ')}`);

    // Acha os JSONs dentro da pasta do backup
    const arquivos = await listChildren(accessToken, alvo.id);
    const contatosFile = arquivos.find(f => f.name.startsWith('contatos_') && f.name.endsWith('.json'));
    const mensagensFile = arquivos.find(f => f.name.startsWith('mensagens_') && f.name.endsWith('.json'));
    if (!mensagensFile) throw new Error(`Arquivo de mensagens não encontrado no backup "${alvo.name}"`);

    const contatos = contatosFile ? await downloadJson(accessToken, contatosFile.id) : [];
    const mensagens = await downloadJson(accessToken, mensagensFile.id);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true, dry_run: true, backup: alvo.name,
        contatos: contatos.length, mensagens: mensagens.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // UPSERT (nunca apaga): contatos por subscriber_id, mensagens por id
    const contatosRestaurados = contatos.length ? await upsertEmLotes(supabase, 'manychat_subscribers', contatos, 'subscriber_id') : 0;
    const mensagensRestauradas = mensagens.length ? await upsertEmLotes(supabase, 'manychat_mensagens', mensagens, 'id') : 0;

    return new Response(JSON.stringify({
      success: true, backup: alvo.name,
      contatos_restaurados: contatosRestaurados,
      mensagens_restauradas: mensagensRestauradas,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro desconhecido';
    console.error('[restore-chat-drive]', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
