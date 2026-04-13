import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // ── Verificar conexão ────────────────────────────────────────────────────────
  const checkConnection = useCallback(async () => {
    if (!user) { setIsConnected(false); setIsLoading(false); return; }
    try {
      const { data } = await supabase
        .from('google_calendar_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();
      setIsConnected(!!data);
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  // ── Ouvir callback OAuth ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-success' && user) {
        try {
          const tokens = event.data.tokens;
          const expiresAt = tokens.expires_at
            ? new Date(tokens.expires_at).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString();

          const { error } = await supabase
            .from('google_calendar_tokens')
            .upsert({
              user_id:       user.id,
              access_token:  tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              expires_at:    expiresAt,
            }, { onConflict: 'user_id' });

          if (error) throw error;
          setIsConnected(true);
          toast.success('Google Calendar conectado! Sincronizando eventos...');

          // Sync automático ao conectar
          setTimeout(() => syncFull(), 1000);
        } catch (err) {
          console.error('Erro ao salvar tokens Google:', err);
          toast.error('Erro ao salvar conexão com Google Calendar');
        }
      } else if (event.data?.type === 'google-oauth-error') {
        toast.error(`Erro na autenticação: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // ── Iniciar OAuth ────────────────────────────────────────────────────────────
  const connect = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=get_auth_url`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      const result = await response.json();

      if (result.error) { toast.error(result.error); return; }

      if (result.authUrl) {
        const w = 600, h = 700;
        window.open(
          result.authUrl,
          'Google Calendar Auth',
          `width=${w},height=${h},left=${window.screen.width/2 - w/2},top=${window.screen.height/2 - h/2}`
        );
      }
    } catch (err) {
      console.error('Erro ao iniciar OAuth:', err);
      toast.error('Erro ao iniciar autenticação com Google');
    }
  };

  // ── Desconectar ──────────────────────────────────────────────────────────────
  const disconnect = async () => {
    if (!user) return;
    try {
      await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
      setIsConnected(false);
      toast.success('Google Calendar desconectado');
    } catch {
      toast.error('Erro ao desconectar Google Calendar');
    }
  };

  // ── Exportar CRM → Google ────────────────────────────────────────────────────
  const syncToGoogle = async () => {
    if (!user || !isConnected) { toast.error('Conecte o Google Calendar primeiro'); return; }
    setIsSyncing(true);
    try {
      // Buscar compromissos locais que não foram sincronizados ainda
      const { data: comps } = await supabase
        .from('compromissos')
        .select('id')
        .is('google_event_id', null)
        .is('origem', null);

      if (!comps || comps.length === 0) {
        toast.info('Todos os eventos já estão sincronizados');
        return;
      }

      let synced = 0, errors = 0;

      // Processar em lotes de 5 para não sobrecarregar
      for (let i = 0; i < comps.length; i += 5) {
        const batch = comps.slice(i, i + 5);
        await Promise.all(batch.map(async (c) => {
          const { data, error } = await supabase.functions.invoke('calendar-sync', {
            body: { action: 'push_to_google', user_id: user.id, compromisso_id: c.id }
          });
          if (error || data?.error) errors++;
          else synced++;
        }));
      }

      if (synced > 0) toast.success(`${synced} eventos enviados ao Google Calendar`);
      if (errors > 0) toast.warning(`${errors} eventos não puderam ser sincronizados`);
      setLastSync(new Date());
    } catch (err) {
      toast.error('Erro ao sincronizar com Google Calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Importar Google → CRM ────────────────────────────────────────────────────
  const syncFromGoogle = async () => {
    if (!user || !isConnected) { toast.error('Conecte o Google Calendar primeiro'); return; }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { action: 'pull_from_google', user_id: user.id }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      if (data.novos_importados > 0) {
        toast.success(`${data.novos_importados} eventos importados do Google Calendar`);
      } else {
        toast.info('Nenhum evento novo no Google Calendar');
      }
      setLastSync(new Date());
    } catch (err: any) {
      toast.error(`Erro ao importar do Google: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Sync bidirecional completo ───────────────────────────────────────────────
  const syncFull = async () => {
    if (!user || !isConnected) { toast.error('Conecte o Google Calendar primeiro'); return; }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { action: 'sync_full', user_id: user.id }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      toast.success(data.mensagem || 'Sincronização completa realizada!');
      setLastSync(new Date());
    } catch (err: any) {
      toast.error(`Erro na sincronização: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Deletar evento do Google quando deletado no CRM ──────────────────────────
  const deleteFromGoogle = async (googleEventId: string) => {
    if (!user || !isConnected || !googleEventId) return;
    try {
      await supabase.functions.invoke('calendar-sync', {
        body: { action: 'delete_from_google', user_id: user.id, google_event_id: googleEventId }
      });
    } catch (err) {
      console.warn('Erro ao deletar evento do Google (não crítico):', err);
    }
  };

  return {
    isConnected,
    isLoading,
    isSyncing,
    lastSync,
    connect,
    disconnect,
    syncToGoogle,
    syncFromGoogle,
    syncFull,
    deleteFromGoogle,
    checkConnection,
  };
}
