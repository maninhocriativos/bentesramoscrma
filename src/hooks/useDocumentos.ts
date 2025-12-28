import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Documento } from '@/types/documentos';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// Helper para sincronizar com Google Drive em background
async function syncToGoogleDrive(
  userId: string,
  clienteId: string,
  clienteNome: string,
  file: File,
  fileName: string
) {
  try {
    // Verificar se usuário tem conexão com Google Drive
    const { data: tokenData } = await supabase
      .from('google_drive_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!tokenData) {
      console.log('Google Drive não conectado, pulando sincronização');
      return { synced: false, reason: 'not_connected' };
    }

    // Verificar se token expirou e renovar se necessário
    let accessToken = tokenData.access_token;
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    const isExpired = expiresAt && expiresAt < new Date();

    if (isExpired && tokenData.refresh_token) {
      const { data: refreshData } = await supabase.functions.invoke('google-drive', {
        body: { 
          action: 'refresh',
          refresh_token: tokenData.refresh_token 
        }
      });

      if (refreshData?.access_token) {
        accessToken = refreshData.access_token;
        await supabase
          .from('google_drive_tokens')
          .update({
            access_token: refreshData.access_token,
            expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
          })
          .eq('user_id', userId);
      } else {
        console.log('Falha ao renovar token do Google Drive');
        return { synced: false, reason: 'token_refresh_failed' };
      }
    }

    // Encontrar ou criar pasta do cliente
    const { data: folderData, error: folderError } = await supabase.functions.invoke('google-drive', {
      body: {
        action: 'find_or_create_client_folder',
        access_token: accessToken,
        client_name: clienteNome,
        client_id: clienteId,
      }
    });

    if (folderError || !folderData?.folder_id) {
      console.error('Erro ao criar/encontrar pasta do cliente:', folderError);
      return { synced: false, reason: 'folder_error' };
    }

    // Converter arquivo para base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Upload do arquivo para o Google Drive
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke('google-drive', {
      body: {
        action: 'upload_file',
        access_token: accessToken,
        folder_id: folderData.folder_id,
        file_name: fileName,
        file_content: base64,
        mime_type: file.type || 'application/octet-stream',
      }
    });

    if (uploadError || uploadData?.error) {
      console.error('Erro ao fazer upload para Google Drive:', uploadError || uploadData?.error);
      return { synced: false, reason: 'upload_error' };
    }

    console.log('Documento sincronizado com Google Drive:', uploadData);
    return { synced: true, driveFileId: uploadData?.id };
  } catch (error) {
    console.error('Erro na sincronização com Google Drive:', error);
    return { synced: false, reason: 'exception' };
  }
}

export function useDocumentos(processoId?: string, clienteId?: string) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchDocumentos = async () => {
    setLoading(true);
    let query = supabase
      .from('documentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (processoId) {
      query = query.eq('processo_id', processoId);
    }
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar documentos', description: error.message, variant: 'destructive' });
    } else {
      setDocumentos(data as Documento[]);
    }
    setLoading(false);
  };

  const uploadDocumento = async (
    file: File,
    metadata: {
      nome: string;
      tipo: Documento['tipo'];
      descricao?: string;
      processo_id?: string;
      cliente_id?: string;
    }
  ) => {
    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Erro ao fazer upload', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return null;
    }

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        nome: metadata.nome,
        tipo: metadata.tipo,
        descricao: metadata.descricao || null,
        processo_id: metadata.processo_id || null,
        cliente_id: metadata.cliente_id || null,
        // Bucket é privado: salvar o PATH e gerar signed URL na hora de abrir/baixar
        arquivo_url: filePath,
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        uploaded_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao salvar documento', description: error.message, variant: 'destructive' });
      setUploading(false);
      return null;
    }

    toast({ title: 'Documento enviado com sucesso!' });
    
    // Sincronização com Google Drive em background (não bloqueia)
    if (metadata.cliente_id && user?.id) {
      // Buscar nome do cliente
      const { data: clienteData } = await supabase
        .from('leads_juridicos')
        .select('nome')
        .eq('id', metadata.cliente_id)
        .maybeSingle();

      if (clienteData?.nome) {
        // Executar em background
        syncToGoogleDrive(user.id, metadata.cliente_id, clienteData.nome, file, file.name)
          .then((result) => {
            if (result.synced) {
              toast({ 
                title: 'Sincronizado com Google Drive',
                description: `Documento enviado para pasta "${clienteData.nome}"`,
              });
            }
          })
          .catch((err) => {
            console.error('Erro na sincronização em background:', err);
          });
      }
    }

    await fetchDocumentos();
    setUploading(false);
    return data;
  };

  const deleteDocumento = async (id: string, arquivoUrl: string) => {
    const getStoragePath = (value: string) => {
      if (!value) return '';
      // suporta tanto URL antiga quanto path (novo padrão)
      if (value.includes('/documentos/')) return value.split('/documentos/')[1].split('?')[0];
      return value.split('?')[0];
    };

    const filePath = getStoragePath(arquivoUrl);
    if (filePath) {
      await supabase.storage.from('documentos').remove([filePath]);
    }

    const { error } = await supabase
      .from('documentos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir documento', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Documento excluído!' });
    await fetchDocumentos();
    return true;
  };

  useEffect(() => {
    fetchDocumentos();
  }, [processoId, clienteId]);

  return { documentos, loading, uploading, fetchDocumentos, uploadDocumento, deleteDocumento };
}
