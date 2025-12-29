import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Force HTML rendering in OAuth popup windows (some browsers/proxies behave better with canonical casing)
const htmlHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// IMPORTANT: The redirect_uri MUST match exactly what's registered in Google Cloud Console
// Register this URL in Google Cloud Console: https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/google-drive/callback
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-drive/callback`;

// Helper function to get Google credentials from app_settings
async function getGoogleCredentials(supabase: any): Promise<{ clientId: string | null; clientSecret: string | null }> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

  if (error) {
    console.error('Error fetching Google credentials:', error);
    return { clientId: null, clientSecret: null };
  }

  const settings = data.reduce((acc: Record<string, string>, item: { key: string; value: string }) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  return {
    clientId: settings['GOOGLE_OAUTH_CLIENT_ID'] || null,
    clientSecret: settings['GOOGLE_OAUTH_CLIENT_SECRET'] || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const action = url.searchParams.get('action');

    console.log('Google Drive - Path:', pathname, 'Action:', action);

    // Get credentials from database
    const { clientId, clientSecret } = await getGoogleCredentials(supabase);

    // Handle OAuth callback via path (Google redirects here)
    // Path: /functions/v1/google-drive/callback
    if (pathname.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      console.log('OAuth callback - code:', code ? 'present' : 'missing', 'error:', error);

      if (error) {
        console.error('OAuth error:', error);
        return new Response(
          `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: '${error}' }, '*');
      window.close();
    </script>
    <p>Erro na autenticação. Esta janela pode ser fechada.</p>
  </body>
</html>`,
          { headers: htmlHeaders },
        );
      }

      if (!code) {
        return new Response(
          `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: 'Código não encontrado' }, '*');
      window.close();
    </script>
    <p>Código de autorização não encontrado. Esta janela pode ser fechada.</p>
  </body>
</html>`,
          { status: 400, headers: htmlHeaders },
        );
      }

      if (!clientId || !clientSecret) {
        return new Response(
          `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: 'Credenciais não configuradas' }, '*');
      window.close();
    </script>
    <p>Credenciais não configuradas. Esta janela pode ser fechada.</p>
  </body>
</html>`,
          { status: 400, headers: htmlHeaders },
        );
      }

      // Exchange code for tokens - MUST use exact same redirect_uri
      console.log('Exchanging code for tokens with redirect_uri:', REDIRECT_URI);

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      console.log('Token exchange result:', tokenResponse.ok ? 'success' : 'failed', tokens.error || '');

      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokens);
        return new Response(
          `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: 'Falha ao obter tokens: ${tokens.error_description || tokens.error || 'unknown'}' }, '*');
      window.close();
    </script>
    <p>Falha ao obter tokens. Esta janela pode ser fechada.</p>
  </body>
</html>`,
          { status: 400, headers: htmlHeaders },
        );
      }

      const successHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Google Drive Conectado</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; }
      .container { text-align: center; padding: 2rem; }
      .icon { font-size: 4rem; margin-bottom: 1rem; }
      h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
      p { color: #94a3b8; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon">✓</div>
      <h1>Google Drive Conectado!</h1>
      <p>Esta janela será fechada automaticamente...</p>
    </div>
    <script>
      (function() {
        try {
          if (window.opener) {
            window.opener.postMessage({
              type: 'google-drive-oauth-success',
              tokens: ${JSON.stringify(tokens)}
            }, '*');
          }
        } catch (e) {
          console.error('PostMessage error:', e);
        }
        setTimeout(function() { window.close(); }, 1500);
      })();
    </script>
  </body>
</html>`;

      return new Response(successHtml, {
        status: 200,
        headers: htmlHeaders,
      });
    }

    // Get authorization URL for OAuth flow (Drive scope)
    if (action === 'get_auth_url') {
      if (!clientId) {
        return new Response(JSON.stringify({ 
          error: 'Google OAuth não configurado. Configure as credenciais em Configurações > Integrações.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
      ].join(' ');
      
      console.log('Generating auth URL with redirect_uri:', REDIRECT_URI);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent`;

      return new Response(JSON.stringify({ authUrl, redirect_uri: REDIRECT_URI }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token (GET for backwards compatibility)
    if (action === 'refresh') {
      const { refresh_token } = await req.json();

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await tokenResponse.json();

      return new Response(JSON.stringify(tokens), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle other actions via POST
    if (req.method === 'POST') {
      const body = await req.json();
      const postAction = body.action;

      console.log('Google Drive POST Action:', postAction);

      // Refresh token (POST) - usado pelo app via supabase.functions.invoke
      if (postAction === 'refresh') {
        const refreshToken = body.refresh_token;

        if (!refreshToken) {
          return new Response(JSON.stringify({ error: 'refresh_token não fornecido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
          }),
        });

        const tokens = await tokenResponse.json();

        return new Response(JSON.stringify(tokens), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = body.access_token;

      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Token de acesso não fornecido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // List files in root or specific folder
      if (postAction === 'list_files') {
        const folderId = body.folder_id || 'root';
        const query = body.query || '';
        
        let searchQuery = `'${folderId}' in parents and trashed = false`;
        if (query) {
          searchQuery += ` and name contains '${query}'`;
        }

        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents)&orderBy=name`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        const data = await response.json();
        
        if (!response.ok) {
          console.error('Error listing files:', data);
          return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao listar arquivos' }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create folder
      if (postAction === 'create_folder') {
        const folderName = body.folder_name;
        const parentId = body.parent_id || 'root';

        if (!folderName) {
          return new Response(JSON.stringify({ error: 'Nome da pasta não fornecido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // First check if folder already exists
        const searchQuery = `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        const searchData = await searchResponse.json();
        
        if (searchData.files && searchData.files.length > 0) {
          // Folder already exists, return it
          return new Response(JSON.stringify({ 
            id: searchData.files[0].id,
            name: searchData.files[0].name,
            already_existed: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create new folder
        const response = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          console.error('Error creating folder:', data);
          return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao criar pasta' }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find or create client folder
      if (postAction === 'find_or_create_client_folder') {
        const clientName = body.client_name;
        const clientId = body.client_id;
        const baseFolderName = body.base_folder_name || 'Clientes - Bentes & Ramos';

        if (!clientName) {
          return new Response(JSON.stringify({ error: 'Nome do cliente não fornecido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // First, find or create the base folder
        let baseFolderId: string;
        
        const baseSearchQuery = `name = '${baseFolderName}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const baseSearchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(baseSearchQuery)}&fields=files(id,name)`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        const baseSearchData = await baseSearchResponse.json();
        
        if (baseSearchData.files && baseSearchData.files.length > 0) {
          baseFolderId = baseSearchData.files[0].id;
        } else {
          // Create base folder
          const createBaseResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: baseFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: ['root'],
            }),
          });

          const createBaseData = await createBaseResponse.json();
          baseFolderId = createBaseData.id;
        }

        // Now find or create client folder
        const sanitizedClientName = clientName.replace(/[<>:"/\\|?*]/g, '_');
        const clientSearchQuery = `name = '${sanitizedClientName}' and '${baseFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const clientSearchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(clientSearchQuery)}&fields=files(id,name)`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        const clientSearchData = await clientSearchResponse.json();
        
        if (clientSearchData.files && clientSearchData.files.length > 0) {
          return new Response(JSON.stringify({ 
            folder_id: clientSearchData.files[0].id,
            folder_name: clientSearchData.files[0].name,
            base_folder_id: baseFolderId,
            already_existed: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create client folder
        const createClientResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: sanitizedClientName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [baseFolderId],
          }),
        });

        const createClientData = await createClientResponse.json();
        
        if (!createClientResponse.ok) {
          console.error('Error creating client folder:', createClientData);
          return new Response(JSON.stringify({ error: createClientData.error?.message || 'Erro ao criar pasta' }), {
            status: createClientResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          folder_id: createClientData.id,
          folder_name: sanitizedClientName,
          base_folder_id: baseFolderId,
          already_existed: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upload file
      if (postAction === 'upload_file') {
        const folderId = body.folder_id;
        const fileName = body.file_name;
        const fileContent = body.file_content; // Base64
        const mimeType = body.mime_type || 'application/octet-stream';

        if (!folderId || !fileName || !fileContent) {
          return new Response(JSON.stringify({ error: 'Parâmetros incompletos para upload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Decode base64 content
        const binaryContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

        // Create metadata
        const metadata = {
          name: fileName,
          parents: [folderId],
        };

        // Create multipart body
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadataPart = delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata);

        const mediaPart = delimiter +
          `Content-Type: ${mimeType}\r\n` +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          fileContent;

        const multipartBody = metadataPart + mediaPart + closeDelimiter;

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        const data = await response.json();
        
        if (!response.ok) {
          console.error('Error uploading file:', data);
          return new Response(JSON.stringify({ error: data.error?.message || 'Erro ao fazer upload' }), {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Download file
      if (postAction === 'download_file') {
        const fileId = body.file_id;

        if (!fileId) {
          return new Response(JSON.stringify({ error: 'ID do arquivo não fornecido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get file metadata first
        const metadataResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        const metadata = await metadataResponse.json();

        if (!metadataResponse.ok) {
          return new Response(JSON.stringify({ error: metadata.error?.message || 'Erro ao obter metadados' }), {
            status: metadataResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Download file content
        const contentResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (!contentResponse.ok) {
          const errorData = await contentResponse.json();
          return new Response(JSON.stringify({ error: errorData.error?.message || 'Erro ao baixar arquivo' }), {
            status: contentResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const arrayBuffer = await contentResponse.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        return new Response(JSON.stringify({
          name: metadata.name,
          mimeType: metadata.mimeType,
          content: base64Content,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Método não suportado' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-drive:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});