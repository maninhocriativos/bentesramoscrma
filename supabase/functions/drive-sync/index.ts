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

// Create a sync job
async function createJob(userId: string, direction: string, kind: string, documentId?: string, driveFileId?: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('drive_sync_jobs')
    .insert({
      user_id: userId,
      direction,
      kind,
      document_id: documentId || null,
      drive_file_id: driveFileId || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating job:', error);
    return null;
  }
  return data.id;
}

// Update job status
async function updateJob(jobId: string, status: string, lastError?: string) {
  const updates: Record<string, unknown> = { status };
  if (status === 'processing') {
    updates.started_at = new Date().toISOString();
  }
  if (status === 'success' || status === 'error') {
    updates.finished_at = new Date().toISOString();
  }
  if (lastError !== undefined) {
    updates.last_error = lastError;
  }

  await supabase
    .from('drive_sync_jobs')
    .update(updates)
    .eq('id', jobId);
}

// Increment job attempts
async function incrementJobAttempts(jobId: string) {
  // Get current attempts first
  const { data } = await supabase
    .from('drive_sync_jobs')
    .select('attempts')
    .eq('id', jobId)
    .single();

  const newAttempts = (data?.attempts || 0) + 1;
  await supabase
    .from('drive_sync_jobs')
    .update({ attempts: newAttempts })
    .eq('id', jobId);
}

// Sync a single document to Google Drive
async function syncDocumentToDrive(docId: string, userId: string, jobId?: string): Promise<boolean> {
  console.log(`Syncing document ${docId} for user ${userId}`);
  
  // Get document info
  const { data: doc, error: docError } = await supabase
    .from('documentos')
    .select('*, leads_juridicos:cliente_id(nome)')
    .eq('id', docId)
    .maybeSingle();

  if (docError || !doc) {
    console.error('Document not found:', docError);
    if (jobId) await updateJob(jobId, 'error', 'Documento não encontrado');
    return false;
  }

  // Skip if already synced
  if (doc.drive_file_id && doc.sync_status === 'synced') {
    console.log('Document already synced');
    if (jobId) await updateJob(jobId, 'success');
    return true;
  }

  // Update status to syncing
  await supabase
    .from('documentos')
    .update({ sync_status: 'syncing', sync_last_attempt_at: new Date().toISOString() })
    .eq('id', docId);

  if (jobId) {
    await updateJob(jobId, 'processing');
    await incrementJobAttempts(jobId);
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    const errMsg = 'Token de acesso inválido';
    console.error(errMsg);
    await supabase
      .from('documentos')
      .update({ sync_status: 'error', sync_last_error: errMsg, sync_retry_count: (doc.sync_retry_count || 0) + 1 })
      .eq('id', docId);
    if (jobId) await updateJob(jobId, 'error', errMsg);
    return false;
  }

  try {
    // Get base folder
    const baseFolderId = await findOrCreateBaseFolder(accessToken);
    if (!baseFolderId) {
      throw new Error('Não foi possível criar pasta base');
    }

    // Determine target folder
    let targetFolderId = baseFolderId;
    const clientName = (doc.leads_juridicos as Record<string, unknown>)?.nome as string | undefined;
    
    if (clientName) {
      const clientFolderId = await findOrCreateClientFolder(accessToken, baseFolderId, clientName);
      if (clientFolderId) {
        targetFolderId = clientFolderId;
      }
    }

    // Download from Supabase Storage
    let storagePath = doc.arquivo_url;
    if (storagePath.includes('/storage/v1/object/')) {
      const parts = storagePath.split('/documentos/');
      if (parts.length > 1) {
        storagePath = parts[1];
      }
    }

    const fileData = await downloadFromStorage('documentos', storagePath);
    if (!fileData) {
      throw new Error('Não foi possível baixar arquivo do storage');
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
      throw new Error('Não foi possível fazer upload para o Drive');
    }

    // Update document with Drive info
    await supabase
      .from('documentos')
      .update({
        drive_file_id: driveResult.id,
        drive_synced_at: new Date().toISOString(),
        sync_status: 'synced',
        sync_last_error: null,
      })
      .eq('id', docId);

    if (jobId) await updateJob(jobId, 'success');
    console.log(`Document ${docId} synced successfully to Drive`);
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Sync error:', errMsg);
    await supabase
      .from('documentos')
      .update({ 
        sync_status: 'error', 
        sync_last_error: errMsg,
        sync_retry_count: (doc.sync_retry_count || 0) + 1 
      })
      .eq('id', docId);
    if (jobId) await updateJob(jobId, 'error', errMsg);
    return false;
  }
}

// Import file from Google Drive to Supabase Storage
async function importFromDrive(
  userId: string,
  driveFileId: string,
  clienteId?: string,
  jobId?: string
): Promise<{ success: boolean; documentId?: string }> {
  console.log(`Importing Drive file ${driveFileId} for user ${userId}`);

  if (jobId) {
    await updateJob(jobId, 'processing');
    await incrementJobAttempts(jobId);
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    if (jobId) await updateJob(jobId, 'error', 'Token de acesso inválido');
    return { success: false };
  }

  try {
    // Check if already imported
    const { data: existing } = await supabase
      .from('documentos')
      .select('id')
      .eq('drive_file_id', driveFileId)
      .maybeSingle();

    if (existing) {
      console.log('File already imported:', existing.id);
      if (jobId) await updateJob(jobId, 'success');
      return { success: true, documentId: existing.id };
    }

    // Get file metadata
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType,size`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const metadata = await metaResponse.json();
    
    if (!metaResponse.ok) {
      throw new Error(metadata.error?.message || 'Erro ao obter metadados');
    }

    // Download file content
    const contentResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!contentResponse.ok) {
      throw new Error('Erro ao baixar arquivo do Drive');
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
      throw new Error(uploadError.message);
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
      throw new Error(insertError.message);
    }

    if (jobId) await updateJob(jobId, 'success');
    console.log(`Drive file imported successfully: ${newDoc.id}`);
    return { success: true, documentId: newDoc.id };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Import error:', errMsg);
    if (jobId) await updateJob(jobId, 'error', errMsg);
    return { success: false };
  }
}

// Scan Google Drive for files and import them
async function scanDrive(userId: string): Promise<{ found: number; imported: number }> {
  console.log(`Scanning Drive for user ${userId}`);

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    console.error('No valid access token for scan');
    return { found: 0, imported: 0 };
  }

  // Find base folder
  const baseFolderId = await findOrCreateBaseFolder(accessToken);
  if (!baseFolderId) {
    console.error('Could not find/create base folder');
    return { found: 0, imported: 0 };
  }

  // List all files in the base folder and subfolders
  const allFiles: Array<{ id: string; name: string; mimeType: string }> = [];

  async function listFilesInFolder(folderId: string) {
    const searchQuery = `'${folderId}' in parents and trashed = false`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType)&pageSize=100`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const data = await response.json();
    
    if (data.files) {
      for (const file of data.files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Recurse into subfolder
          await listFilesInFolder(file.id);
        } else {
          allFiles.push(file);
        }
      }
    }
  }

  await listFilesInFolder(baseFolderId);
  console.log(`Found ${allFiles.length} files in Drive`);

  // Check which files are not yet imported
  let imported = 0;
  for (const file of allFiles) {
    const { data: existing } = await supabase
      .from('documentos')
      .select('id')
      .eq('drive_file_id', file.id)
      .maybeSingle();

    if (!existing) {
      // Create import job
      const jobId = await createJob(userId, 'pull', 'import_from_drive', undefined, file.id);
      if (jobId) {
        const result = await importFromDrive(userId, file.id, undefined, jobId);
        if (result.success) imported++;
      }
    }
  }

  return { found: allFiles.length, imported };
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
    // Create job for tracking
    const jobId = await createJob(userId, 'push', 'sync_to_drive', doc.id);
    const success = await syncDocumentToDrive(doc.id, userId, jobId || undefined);
    if (success) {
      synced++;
    } else {
      errors++;
    }
  }

  return { synced, errors };
}

// Retry a specific job
async function retryJob(userId: string, jobId: string): Promise<boolean> {
  const { data: job, error } = await supabase
    .from('drive_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();

  if (error || !job) {
    console.error('Job not found:', error);
    return false;
  }

  if (job.status !== 'error' || job.attempts >= job.max_attempts) {
    console.log('Job cannot be retried');
    return false;
  }

  // Reset job status
  await supabase
    .from('drive_sync_jobs')
    .update({ status: 'pending', last_error: null })
    .eq('id', jobId);

  // Execute based on kind
  if (job.kind === 'sync_to_drive' && job.document_id) {
    return await syncDocumentToDrive(job.document_id, userId, jobId);
  } else if (job.kind === 'import_from_drive' && job.drive_file_id) {
    const result = await importFromDrive(userId, job.drive_file_id, undefined, jobId);
    return result.success;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, user_id, document_id, drive_file_id, cliente_id, job_id } = body;

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

      const jobId = await createJob(user_id, 'push', 'sync_to_drive', document_id);
      const success = await syncDocumentToDrive(document_id, user_id, jobId || undefined);
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

      const jobId = await createJob(user_id, 'pull', 'import_from_drive', undefined, drive_file_id);
      const result = await importFromDrive(user_id, drive_file_id, cliente_id, jobId || undefined);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Scan Drive for new files
    if (action === 'scan_drive') {
      const result = await scanDrive(user_id);
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

    // Retry a job
    if (action === 'retry_job') {
      if (!job_id) {
        return new Response(JSON.stringify({ error: 'job_id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const success = await retryJob(user_id, job_id);
      return new Response(JSON.stringify({ success }), {
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

    return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Drive sync error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
