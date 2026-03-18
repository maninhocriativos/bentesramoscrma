const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Helper: get Google credentials from app_settings
async function getGoogleCredentials(supabase: any) {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

  const settings = (data || []).reduce((acc: Record<string, string>, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  return {
    clientId: settings['GOOGLE_OAUTH_CLIENT_ID'] || null,
    clientSecret: settings['GOOGLE_OAUTH_CLIENT_SECRET'] || null,
  };
}

// Helper: refresh access token
async function refreshAccessToken(supabase: any, userId: string) {
  const { data: tokenRow } = await supabase
    .from('google_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenRow) throw new Error('Google Drive não conectado. Conecte primeiro em Documentos.');

  // Check if token is still valid
  const expiresAt = new Date(tokenRow.expires_at);
  if (expiresAt > new Date(Date.now() + 60000)) {
    return tokenRow.access_token;
  }

  // Refresh
  const { clientId, clientSecret } = await getGoogleCredentials(supabase);
  if (!clientId || !clientSecret) throw new Error('Credenciais Google não configuradas');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await res.json();
  if (!res.ok) throw new Error(`Erro ao renovar token: ${tokens.error}`);

  await supabase
    .from('google_drive_tokens')
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    })
    .eq('user_id', userId);

  return tokens.access_token;
}

// Helper: find or create folder
async function findOrCreateFolder(accessToken: string, name: string, parentId = 'root') {
  const q = `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(`Erro ao criar pasta: ${createData.error?.message}`);
  return createData.id;
}

// Helper: upload text file to Drive
async function uploadTextFile(accessToken: string, folderId: string, fileName: string, content: string, mimeType: string) {
  const boundary = '-------backup' + Date.now();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Upload falhou: ${data.error?.message}`);
  return data;
}

// Convert array of objects to CSV string
function toCSV(rows: any[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.map(k => `"${k}"`).join(',');
  const lines = rows.map(row =>
    keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    let userId = body.user_id;

    // If no user_id provided (cron job), find first user with Drive tokens
    if (!userId) {
      const { data: tokenRow } = await supabase
        .from('google_drive_tokens')
        .select('user_id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: 'Nenhum usuário com Google Drive conectado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = tokenRow.user_id;
    }

    console.log('[backup-chat-drive] Iniciando backup para user:', userId);

    // 1. Get valid access token
    const accessToken = await refreshAccessToken(supabase, userId);

    // 2. Create folder structure: Backups - CRM / Chat / YYYY-MM-DD
    const baseFolderId = await findOrCreateFolder(accessToken, 'Backups - CRM');
    const chatFolderId = await findOrCreateFolder(accessToken, 'Chat', baseFolderId);

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const backupFolderId = await findOrCreateFolder(accessToken, `${dateStr}_${timeStr}`, chatFolderId);

    // 3. Fetch all subscribers
    console.log('[backup-chat-drive] Buscando contatos...');
    const allSubscribers: any[] = [];
    let subscriberOffset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('manychat_subscribers')
        .select('*')
        .order('created_at', { ascending: true })
        .range(subscriberOffset, subscriberOffset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allSubscribers.push(...data);
      if (data.length < PAGE_SIZE) break;
      subscriberOffset += PAGE_SIZE;
    }

    console.log(`[backup-chat-drive] ${allSubscribers.length} contatos encontrados`);

    // 4. Fetch all messages (paginated)
    console.log('[backup-chat-drive] Buscando mensagens...');
    const allMessages: any[] = [];
    let messageOffset = 0;

    while (true) {
      const { data, error } = await supabase
        .from('manychat_mensagens')
        .select('*')
        .order('created_at', { ascending: true })
        .range(messageOffset, messageOffset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allMessages.push(...data);
      if (data.length < PAGE_SIZE) break;
      messageOffset += PAGE_SIZE;
    }

    console.log(`[backup-chat-drive] ${allMessages.length} mensagens encontradas`);

    // 5. Upload files
    const uploads: any[] = [];

    // Contatos JSON
    const subJson = JSON.stringify(allSubscribers, null, 2);
    const subJsonFile = await uploadTextFile(accessToken, backupFolderId, `contatos_${dateStr}.json`, subJson, 'application/json');
    uploads.push({ type: 'contatos_json', ...subJsonFile });

    // Contatos CSV
    const subCsv = toCSV(allSubscribers.map(s => ({
      subscriber_id: s.subscriber_id,
      nome: s.nome,
      telefone: s.telefone,
      email: s.email,
      canal: s.canal,
      lead_id: s.lead_id,
      empresa_tag: s.empresa_tag,
      linha_whatsapp: s.linha_whatsapp,
      instance_name: s.instance_name,
      atendimento_humano: s.atendimento_humano,
      ultima_interacao: s.ultima_interacao,
      created_at: s.created_at,
    })));
    const subCsvFile = await uploadTextFile(accessToken, backupFolderId, `contatos_${dateStr}.csv`, subCsv, 'text/csv');
    uploads.push({ type: 'contatos_csv', ...subCsvFile });

    // Mensagens JSON
    const msgJson = JSON.stringify(allMessages, null, 2);
    const msgJsonFile = await uploadTextFile(accessToken, backupFolderId, `mensagens_${dateStr}.json`, msgJson, 'application/json');
    uploads.push({ type: 'mensagens_json', ...msgJsonFile });

    // Mensagens CSV
    const msgCsv = toCSV(allMessages.map(m => ({
      id: m.id,
      subscriber_id: m.subscriber_id,
      subscriber_nome: m.subscriber_nome,
      conteudo: m.conteudo,
      direcao: m.direcao,
      tipo: m.tipo,
      canal: m.canal,
      lead_id: m.lead_id,
      created_at: m.created_at,
      metadata: m.metadata ? JSON.stringify(m.metadata) : '',
    })));
    const msgCsvFile = await uploadTextFile(accessToken, backupFolderId, `mensagens_${dateStr}.csv`, msgCsv, 'text/csv');
    uploads.push({ type: 'mensagens_csv', ...msgCsvFile });

    console.log('[backup-chat-drive] Backup concluído!', uploads.length, 'arquivos');

    return new Response(JSON.stringify({
      success: true,
      date: dateStr,
      subscribers_count: allSubscribers.length,
      messages_count: allMessages.length,
      files: uploads,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[backup-chat-drive] Erro:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
