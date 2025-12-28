import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SyncStats {
  total: number;
  synced: number;
  pending: number;
  syncing: number;
  error: number;
}

interface DocumentSyncStatus {
  id: string;
  nome: string;
  sync_status: string;
  drive_file_id: string | null;
  drive_synced_at: string | null;
}

export function useDriveSync() {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);

  // Sync a single document to Google Drive
  const syncDocument = useCallback(async (documentId: string): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado para sincronizar');
      return false;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: {
          action: 'sync_to_drive',
          user_id: user.id,
          document_id: documentId,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Documento sincronizado com o Google Drive!');
        return true;
      } else {
        toast.error('Falha ao sincronizar documento');
        return false;
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar com o Google Drive');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Import a file from Google Drive to Supabase
  const importFromDrive = useCallback(async (
    driveFileId: string,
    clienteId?: string
  ): Promise<{ success: boolean; documentId?: string }> => {
    if (!user) {
      toast.error('Você precisa estar logado para importar');
      return { success: false };
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: {
          action: 'import_from_drive',
          user_id: user.id,
          drive_file_id: driveFileId,
          cliente_id: clienteId,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Arquivo importado do Google Drive!');
        return { success: true, documentId: data.documentId };
      } else {
        toast.error('Falha ao importar arquivo');
        return { success: false };
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar do Google Drive');
      return { success: false };
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Sync all pending documents
  const syncAll = useCallback(async (): Promise<{ synced: number; errors: number }> => {
    if (!user) {
      toast.error('Você precisa estar logado para sincronizar');
      return { synced: 0, errors: 0 };
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: {
          action: 'sync_all',
          user_id: user.id,
        }
      });

      if (error) throw error;

      const result = { synced: data?.synced || 0, errors: data?.errors || 0 };
      
      if (result.synced > 0) {
        toast.success(`${result.synced} documento(s) sincronizado(s) com sucesso!`);
      }
      if (result.errors > 0) {
        toast.error(`${result.errors} documento(s) com erro na sincronização`);
      }
      if (result.synced === 0 && result.errors === 0) {
        toast.info('Nenhum documento pendente para sincronizar');
      }

      return result;
    } catch (error) {
      console.error('Sync all error:', error);
      toast.error('Erro ao sincronizar documentos');
      return { synced: 0, errors: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Get sync status for all documents
  const getSyncStatus = useCallback(async (): Promise<DocumentSyncStatus[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase.functions.invoke('drive-sync', {
        body: {
          action: 'get_status',
          user_id: user.id,
        }
      });

      if (error) throw error;

      if (data?.stats) {
        setSyncStats(data.stats);
      }

      return data?.docs || [];
    } catch (error) {
      console.error('Get status error:', error);
      return [];
    }
  }, [user]);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    await getSyncStatus();
  }, [getSyncStatus]);

  return {
    isSyncing,
    syncStats,
    syncDocument,
    importFromDrive,
    syncAll,
    getSyncStatus,
    refreshStats,
  };
}
