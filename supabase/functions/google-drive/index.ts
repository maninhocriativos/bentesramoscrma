import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log('Google Drive - Action:', action);

    // Get authorization URL for OAuth flow (Drive scope)
    if (action === 'get_auth_url') {
      if (!GOOGLE_CLIENT_ID) {
        return new Response(JSON.stringify({ 
          error: 'Google OAuth não configurado. Configure GOOGLE_CLIENT_ID.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/google-drive?action=callback`;
      const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
      ].join(' ');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle OAuth callback
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: '${error}' }, '*');
      window.close();
    </script>
    <p>Erro na autenticação. Esta janela pode ser fechada.</p>
  </body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      if (!code) {
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: 'Código não encontrado' }, '*');
      window.close();
    </script>
    <p>Código de autorização não encontrado. Esta janela pode ser fechada.</p>
  </body>
</html>`, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/google-drive?action=callback`;
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      console.log('Token exchange result:', tokenResponse.ok ? 'success' : 'failed');

      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokens);
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-drive-oauth-error', error: 'Falha ao obter tokens' }, '*');
      window.close();
    </script>
    <p>Falha ao obter tokens. Esta janela pode ser fechada.</p>
  </body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Sucesso</title></head>
  <body>
    <script>
      window.opener?.postMessage({ 
        type: 'google-drive-oauth-success', 
        tokens: ${JSON.stringify(tokens)}
      }, '*');
      window.close();
    </script>
    <p>Google Drive conectado com sucesso! Esta janela pode ser fechada.</p>
  </body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Refresh token
    if (action === 'refresh') {
      const { refresh_token } = await req.json();

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
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

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
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

        return new Response(JSON.stringify({ 
          folder_id: createClientData.id,
          folder_name: createClientData.name,
          base_folder_id: baseFolderId,
          already_existed: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upload file to folder
      if (postAction === 'upload_file') {
        const folderId = body.folder_id;
        const fileName = body.file_name;
        const fileContent = body.file_content; // Base64 encoded
        const mimeType = body.mime_type || 'application/octet-stream';

        if (!folderId || !fileName || !fileContent) {
          return new Response(JSON.stringify({ error: 'Dados incompletos para upload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create file metadata
        const metadata = {
          name: fileName,
          parents: [folderId],
        };

        // Convert base64 to blob
        const binaryString = atob(fileContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Use multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const closeDelimiter = "\r\n--" + boundary + "--";

        const multipartBody = 
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: ' + mimeType + '\r\n' +
          'Content-Transfer-Encoding: base64\r\n\r\n' +
          fileContent +
          closeDelimiter;

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary="${boundary}"`,
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
        const metaResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        const metaData = await metaResponse.json();

        if (!metaResponse.ok) {
          return new Response(JSON.stringify({ error: metaData.error?.message || 'Erro ao obter metadados' }), {
            status: metaResponse.status,
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
          return new Response(JSON.stringify({ error: 'Erro ao baixar arquivo' }), {
            status: contentResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const arrayBuffer = await contentResponse.arrayBuffer();
        const base64Content = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        return new Response(JSON.stringify({
          ...metaData,
          content: base64Content,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
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
