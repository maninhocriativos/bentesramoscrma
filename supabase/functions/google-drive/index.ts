const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const htmlHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-drive/callback`;

async function getGoogleCredentials(supabase: any) {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
  const settings = (data || []).reduce((acc: any, item: any) => { acc[item.key] = item.value; return acc; }, {});
  return { clientId: settings['GOOGLE_OAUTH_CLIENT_ID'] || null, clientSecret: settings['GOOGLE_OAUTH_CLIENT_SECRET'] || null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const action = url.searchParams.get('action');
    const { clientId, clientSecret } = await getGoogleCredentials(supabase);

    // ── OAuth Callback ──────────────────────────────────────────────────────
    if (pathname.endsWith('/callback')) {
      const code  = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const state = url.searchParams.get('state'); // user_id passed via state

      if (error || !code) {
        return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
          <script>window.opener?.postMessage({type:'google-drive-oauth-error',error:'${error || 'no_code'}'},'*');window.close();</script>
          <p>Erro na autenticação.</p></body></html>`, { headers: htmlHeaders });
      }

      if (!clientId || !clientSecret) {
        return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
          <script>window.opener?.postMessage({type:'google-drive-oauth-error',error:'Credenciais não configuradas'},'*');window.close();</script>
          <p>Credenciais não configuradas.</p></body></html>`, { headers: htmlHeaders });
      }

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
      });

      const tokens = await tokenRes.json();

      if (!tokenRes.ok) {
        return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
          <script>window.opener?.postMessage({type:'google-drive-oauth-error',error:'Falha ao obter tokens'},'*');window.close();</script>
          <p>Falha ao obter tokens.</p></body></html>`, { headers: htmlHeaders });
      }

      // ── SAVE TOKEN DIRECTLY IN SUPABASE (no postMessage needed) ──────────
      let savedOk = false;
      if (state) {
        // state = user_id
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
        const { error: dbErr } = await supabase
          .from('google_drive_tokens')
          .upsert({
            user_id: state,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at: expiresAt,
          }, { onConflict: 'user_id' });

        if (!dbErr) savedOk = true;
        else console.error('Error saving token:', dbErr);
      }

      const successHtml = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Google Drive Conectado</title>
  <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff}.container{text-align:center;padding:2rem}.icon{font-size:4rem;margin-bottom:1rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#94a3b8;font-size:.875rem}</style>
  </head>
  <body><div class="container">
    <div class="icon">✓</div>
    <h1>Google Drive Conectado!</h1>
    <p>Esta janela será fechada automaticamente...</p>
  </div>
  <script>
    (function(){
      try {
        if(window.opener){
          window.opener.postMessage({type:'google-drive-oauth-success',saved:${savedOk},tokens:${JSON.stringify(tokens)}},'*');
        }
      } catch(e){}
      setTimeout(function(){window.close();},1500);
    })();
  </script>
  </body>
</html>`;

      return new Response(successHtml, { status: 200, headers: htmlHeaders });
    }

    // ── Get Auth URL ────────────────────────────────────────────────────────
    if (action === 'get_auth_url') {
      if (!clientId) {
        return new Response(JSON.stringify({ error: 'Google OAuth não configurado.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user_id from Authorization header to pass as state
      const authHeader = req.headers.get('Authorization');
      let userId = '';
      if (authHeader) {
        try {
          const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const jwt = authHeader.replace('Bearer ', '');
          const { data } = await userClient.auth.getUser(jwt);
          userId = data.user?.id || '';
        } catch {}
      }

      const scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'].join(' ');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${userId}`;

      return new Response(JSON.stringify({ authUrl, redirect_uri: REDIRECT_URI }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── POST Actions ────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json();
      const postAction = body.action;

      // Refresh token
      if (postAction === 'refresh') {
        const refreshToken = body.refresh_token;
        if (!refreshToken || !clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
        });
        const tokens = await tokenRes.json();
        return new Response(JSON.stringify(tokens), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const accessToken = body.access_token;
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Token de acesso não fornecido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List files
      if (postAction === 'list_files') {
        const folderId = body.folder_id || 'root';
        const query = body.query || '';
        let searchQuery = `'${folderId}' in parents and trashed = false`;
        if (query) searchQuery += ` and name contains '${query}'`;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents)&orderBy=name`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!res.ok) return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao listar arquivos' }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create folder
      if (postAction === 'create_folder') {
        const { folder_name: folderName, parent_id: parentId = 'root' } = body;
        if (!folderName) return new Response(JSON.stringify({ error: 'Nome da pasta não fornecido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const searchQuery = `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const searchData = await searchRes.json();
        if (searchData.files?.length > 0) return new Response(JSON.stringify({ id: searchData.files[0].id, name: searchData.files[0].name, already_existed: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
        });
        const data = await res.json();
        if (!res.ok) return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao criar pasta' }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Find or create client folder with year/month structure
      if (postAction === 'find_or_create_client_folder') {
        const { client_name: clientName, base_folder_name: baseFolderName = 'Bentes Ramos - Clientes' } = body;
        if (!clientName) return new Response(JSON.stringify({ error: 'Nome do cliente não fornecido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const now = new Date();
        const year = now.getFullYear().toString();
        const month = now.toLocaleString('pt-BR', { month: 'long', timeZone: 'America/Manaus' });
        const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
        const yearMonth = `${year}/${monthCapitalized}`;

        // Helper: find or create folder
        const findOrCreate = async (name: string, parentId: string): Promise<string> => {
          const q = `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
          const sr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
          const sd = await sr.json();
          if (sd.files?.length > 0) return sd.files[0].id;
          const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
          });
          const cd = await cr.json();
          return cd.id;
        };

        // Create: Bentes Ramos - Clientes / 2025 / Abril / Nome do Cliente
        const baseId  = await findOrCreate(baseFolderName, 'root');
        const yearId  = await findOrCreate(year, baseId);
        const monthId = await findOrCreate(monthCapitalized, yearId);
        const sanitizedName = clientName.replace(/[<>:"/\\|?*]/g, '_');
        const clientId2 = await findOrCreate(sanitizedName, monthId);

        return new Response(JSON.stringify({
          folder_id: clientId2,
          folder_name: sanitizedName,
          base_folder_id: baseId,
          path: `${baseFolderName}/${year}/${monthCapitalized}/${sanitizedName}`,
          already_existed: false,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Upload file
      if (postAction === 'upload_file') {
        const { folder_id: folderId, file_name: fileName, file_content: fileContent, mime_type: mimeType = 'application/octet-stream' } = body;
        if (!folderId || !fileName || !fileContent) return new Response(JSON.stringify({ error: 'Parâmetros incompletos para upload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const boundary = '-------314159265358979323846';
        const multipartBody = `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: fileName, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileContent}\r\n--${boundary}--`;
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipartBody,
        });
        const data = await res.json();
        if (!res.ok) return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao fazer upload' }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Download file
      if (postAction === 'download_file') {
        const { file_id: fileId } = body;
        if (!fileId) return new Response(JSON.stringify({ error: 'ID do arquivo não fornecido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const meta = await metaRes.json();
        if (!metaRes.ok) return new Response(JSON.stringify({ error: meta.error?.message || 'Erro ao obter metadados' }), { status: metaRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!contentRes.ok) return new Response(JSON.stringify({ error: 'Erro ao baixar arquivo' }), { status: contentRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const buffer = await contentRes.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return new Response(JSON.stringify({ name: meta.name, mimeType: meta.mimeType, content: base64 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in google-drive:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
