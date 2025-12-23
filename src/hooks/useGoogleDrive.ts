import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface GoogleDriveTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
}

export function useGoogleDrive() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperating, setIsOperating] = useState(false);

  // Check if user has connected Google Drive
  const checkConnection = useCallback(async () => {
    if (!user) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('google_drive_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setIsConnected(!!data);
    } catch (error) {
      console.error('Error checking Google Drive connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Handle OAuth callback message
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-drive-oauth-success' && user) {
        const tokens = event.data.tokens as GoogleDriveTokens;
        
        try {
          const expiresAt = tokens.expires_at 
            ? new Date(tokens.expires_at).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString();

          const { error } = await (supabase as any)
            .from('google_drive_tokens')
            .upsert({
              user_id: user.id,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              expires_at: expiresAt,
            }, { onConflict: 'user_id' });

          if (error) throw error;

          setIsConnected(true);
          toast.success('Google Drive conectado com sucesso!');
        } catch (error) {
          console.error('Error saving Google Drive tokens:', error);
          toast.error('Erro ao salvar conexão com Google Drive');
        }
      } else if (event.data?.type === 'google-drive-oauth-error') {
        toast.error(`Erro na autenticação: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // Start OAuth flow
  const connect = async () => {
    try {
      const response = await fetch(
        'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/google-drive?action=get_auth_url',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        window.open(
          result.authUrl,
          'Google Drive Auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      toast.error('Erro ao iniciar autenticação com Google');
    }
  };

  // Disconnect Google Drive
  const disconnect = async () => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('google_drive_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsConnected(false);
      toast.success('Google Drive desconectado');
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error);
      toast.error('Erro ao desconectar Google Drive');
    }
  };

  // Get valid access token (refresh if needed)
  const getAccessToken = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await (supabase as any)
        .from('google_drive_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      const isExpired = expiresAt && expiresAt < new Date();

      if (isExpired && data.refresh_token) {
        const response = await supabase.functions.invoke('google-drive', {
          body: { 
            action: 'refresh',
            refresh_token: data.refresh_token 
          }
        });

        if (response.data?.access_token) {
          await (supabase as any)
            .from('google_drive_tokens')
            .update({
              access_token: response.data.access_token,
              expires_at: new Date(Date.now() + (response.data.expires_in || 3600) * 1000).toISOString(),
            })
            .eq('user_id', user.id);

          return response.data.access_token;
        }
        return null;
      }

      return data.access_token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  // List files in a folder
  const listFiles = async (folderId?: string, query?: string): Promise<DriveFile[]> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      toast.error('Reconecte sua conta do Google Drive');
      setIsConnected(false);
      return [];
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'list_files',
          access_token: accessToken,
          folder_id: folderId,
          query,
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Erro ao listar arquivos');
      }

      return data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  };

  // Find or create client folder
  const findOrCreateClientFolder = async (clientName: string, clientId: string): Promise<{ folderId: string; folderName: string } | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      toast.error('Reconecte sua conta do Google Drive');
      setIsConnected(false);
      return null;
    }

    setIsOperating(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'find_or_create_client_folder',
          access_token: accessToken,
          client_name: clientName,
          client_id: clientId,
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Erro ao criar pasta do cliente');
      }

      return {
        folderId: data.folder_id,
        folderName: data.folder_name,
      };
    } catch (error) {
      console.error('Error finding/creating client folder:', error);
      toast.error('Erro ao acessar pasta do cliente no Drive');
      return null;
    } finally {
      setIsOperating(false);
    }
  };

  // Upload file to folder
  const uploadFile = async (
    folderId: string, 
    fileName: string, 
    fileContent: string, // Base64
    mimeType: string
  ): Promise<DriveFile | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      toast.error('Reconecte sua conta do Google Drive');
      setIsConnected(false);
      return null;
    }

    setIsOperating(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'upload_file',
          access_token: accessToken,
          folder_id: folderId,
          file_name: fileName,
          file_content: fileContent,
          mime_type: mimeType,
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Erro ao fazer upload');
      }

      toast.success('Arquivo enviado para o Google Drive!');
      return data;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao enviar arquivo para o Drive');
      return null;
    } finally {
      setIsOperating(false);
    }
  };

  // Download file
  const downloadFile = async (fileId: string): Promise<{ name: string; content: string; mimeType: string } | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      toast.error('Reconecte sua conta do Google Drive');
      setIsConnected(false);
      return null;
    }

    setIsOperating(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'download_file',
          access_token: accessToken,
          file_id: fileId,
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Erro ao baixar arquivo');
      }

      return {
        name: data.name,
        content: data.content,
        mimeType: data.mimeType,
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Erro ao baixar arquivo do Drive');
      return null;
    } finally {
      setIsOperating(false);
    }
  };

  return {
    isConnected,
    isLoading,
    isOperating,
    connect,
    disconnect,
    checkConnection,
    listFiles,
    findOrCreateClientFolder,
    uploadFile,
    downloadFile,
    getAccessToken,
  };
}
