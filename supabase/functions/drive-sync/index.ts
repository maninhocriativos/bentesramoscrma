import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get valid access token, refreshing if needed
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: tokenData, error } = await supabase
    .from('google_drive_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !tokenData) {
    console.error('No tokens found for user:', userId);
    return null;
  }

  const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
  const isExpired = expiresAt && expiresAt < new Date();

  if (isExpired && tokenData.refresh_token) {
    console.log('Token expired, refreshing...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();
    
    if (tokens.access_token) {
      await supabase
        .from('google_drive_tokens')
        .update({
          access_token: tokens.access_token,
          expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        })
        .eq('user_id', userId);

      return tokens.access_token;
    }
    return null;
  }

  return tokenData.access_token;
}

// Find or create the base folder for the law firm
async function findOrCreateBaseFolder(accessToken: string): Promise<string | null> {
  const folderName = 'Clientes - Bentes & Ramos';
  
  const searchQuery = `name = '${folderName}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const searchData = await searchResponse.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    }),
  });

  const createData = await createResponse.json();
  return createData.id || null;
}

// Find or create client folder
async function findOrCreateClientFolder(accessToken: string, baseFolderId: string, clientName: string): Promise<string | null> {
  const sanitizedName = clientName.replace(/[<>:"/\\|?*]/g, '_');
  
  const searchQuery = `name = '${sanitizedName}' and '${baseFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  const searchData = await searchResponse.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: sanitizedName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [baseFolderId],
    }),
  });

  const createData = await createResponse.json();
  return createData.id || null;
}

// Upload file to Google Drive
async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileContent: ArrayBuffer,
  mimeType: string
): Promise<{ id: string; webViewLink: string } | null> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(fileContent);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Content = btoa(binary);

  const multipartBody = 
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + mimeType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
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
    console.error('Error uploading to Drive:', data);
    return null;
  }

  return { id: data.id, webViewLink: data.webViewLink };
}

// Download file from Supabase Storage
async function downloadFromStorage(bucket: string, path: string): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    console.error('Error downloading from storage:', error);
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return { data: arrayBuffer, mimeType: data.type };
}

// Sync a single document to Google Drive
async function syncDocumentToDrive(docId: string, userId: string): Promise<boolean> {
  console.log(`Syncing document ${docId} for user ${userId}`);
  
  // Get document info
  const { data: doc, error: docError } = await supabase
    .from('documentos')
    .select('*, leads_juridicos:cliente_id(nome)')
    .eq('id', docId)
    .maybeSingle();

  if (docError || !doc) {
    console.error('Document not found:', docError);
    return false;
  }

  // Skip if already synced
  if (doc.drive_file_id && doc.sync_status === 'synced') {
    console.log('Document already synced');
    return true;
  }

  // Update status to syncing
  await supabase
    .from('documentos')
    .update({ sync_status: 'syncing' })
    .eq('id', docId);

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    console.error('No valid access token');
    await supabase
      .from('documentos')
      .update({ sync_status: 'error' })
      .eq('id', docId);
    return false;
  }

  try {
    // Get base folder
    const baseFolderId = await findOrCreateBaseFolder(accessToken);
    if (!baseFolderId) {
      throw new Error('Could not create base folder');
    }

    // Determine target folder
    let targetFolderId = baseFolderId;
    const clientName = (doc.leads_juridicos as any)?.nome;
    
    if (clientName) {
      const clientFolderId = await findOrCreateClientFolder(accessToken, baseFolderId, clientName);
      if (clientFolderId) {
        targetFolderId = clientFolderId;
      }
    }

    // Download from Supabase Storage
    // arquivo_url might be a full URL or just a path
    let storagePath = doc.arquivo_url;
    if (storagePath.includes('/storage/v1/object/')) {
      // Extract path from full URL
      const parts = storagePath.split('/documentos/');
      if (parts.length > 1) {
        storagePath = parts[1];
      }
    }

    const fileData = await downloadFromStorage('documentos', storagePath);
    if (!fileData) {
      throw new Error('Could not download file from storage');
    }

    // Upload to Google Drive
    const driveResult = await uploadFileToDrive(
      accessToken,
      targetFolderId,
      doc.arquivo_nome,
      fileData.data,
      fileData.mimeType
    );

    if (!driveResult) {
      throw new Error('Could not upload to Google Drive');
    }

    // Update document with Drive info
    await supabase
      .from('documentos')
      .update({
        drive_file_id: driveResult.id,
        drive_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('id', docId);

    console.log(`Document ${docId} synced successfully to Drive`);
    return true;
  } catch (error) {
    console.error('Sync error:', error);
    await supabase
      .from('documentos')
      .update({ sync_status: 'error' })
      .eq('id', docId);
    return false;
  }
}

// Import file from Google Drive to Supabase Storage
async function importFromDrive(
  userId: string,
  driveFileId: string,
  clienteId?: string
): Promise<{ success: boolean; documentId?: string }> {
  console.log(`Importing Drive file ${driveFileId} for user ${userId}`);

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { success: false };
  }

  try {
    // Get file metadata
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType,size`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const metadata = await metaResponse.json();
    
    if (!metaResponse.ok) {
      console.error('Error getting Drive file metadata:', metadata);
      return { success: false };
    }

    // Download file content
    const contentResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!contentResponse.ok) {
      console.error('Error downloading Drive file');
      return { success: false };
    }

    const arrayBuffer = await contentResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const filePath = `${Date.now()}_${metadata.name}`;
    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, bytes, {
        contentType: metadata.mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      return { success: false };
    }

    // Create document record
    const { data: newDoc, error: insertError } = await supabase
      .from('documentos')
      .insert({
        nome: metadata.name,
        arquivo_nome: metadata.name,
        arquivo_url: filePath,
        arquivo_tamanho: metadata.size ? parseInt(metadata.size) : null,
        tipo: 'Importado do Drive',
        cliente_id: clienteId || null,
        uploaded_by: userId,
        drive_file_id: driveFileId,
        drive_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating document record:', insertError);
      return { success: false };
    }

    console.log(`Drive file imported successfully: ${newDoc.id}`);
    return { success: true, documentId: newDoc.id };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false };
  }
}

// Sync all pending documents for a user
async function syncAllPending(userId: string): Promise<{ synced: number; errors: number }> {
  const { data: pendingDocs, error } = await supabase
    .from('documentos')
    .select('id')
    .in('sync_status', ['pending', 'error'])
    .is('drive_file_id', null);

  if (error || !pendingDocs) {
    console.error('Error fetching pending docs:', error);
    return { synced: 0, errors: 0 };
  }

  let synced = 0;
  let errors = 0;

  for (const doc of pendingDocs) {
    const success = await syncDocumentToDrive(doc.id, userId);
    if (success) {
      synced++;
    } else {
      errors++;
    }
  }

  return { synced, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, user_id, document_id, drive_file_id, cliente_id } = body;

    console.log('Drive Sync - Action:', action, 'User:', user_id);

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync single document to Drive
    if (action === 'sync_to_drive') {
      if (!document_id) {
        return new Response(JSON.stringify({ error: 'document_id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const success = await syncDocumentToDrive(document_id, user_id);
      return new Response(JSON.stringify({ success }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Import from Drive to Supabase
    if (action === 'import_from_drive') {
      if (!drive_file_id) {
        return new Response(JSON.stringify({ error: 'drive_file_id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await importFromDrive(user_id, drive_file_id, cliente_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync all pending documents
    if (action === 'sync_all') {
      const result = await syncAllPending(user_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get sync status for documents
    if (action === 'get_status') {
      const { data: docs, error } = await supabase
        .from('documentos')
        .select('id, nome, sync_status, drive_file_id, drive_synced_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stats = {
        total: docs?.length || 0,
        synced: docs?.filter(d => d.sync_status === 'synced').length || 0,
        pending: docs?.filter(d => d.sync_status === 'pending').length || 0,
        syncing: docs?.filter(d => d.sync_status === 'syncing').length || 0,
        error: docs?.filter(d => d.sync_status === 'error').length || 0,
      };

      return new Response(JSON.stringify({ docs, stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Drive sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
