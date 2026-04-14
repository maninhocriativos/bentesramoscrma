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

  // ── Capturar tokens da URL após redirect do Google ───────────────────────────
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get('google_auth');
    if (!googleAuth) return;

    // Limpar URL imediatamente
    window.history.replaceState({}, document.title, window.location.pathname);

    if (googleAuth === 'error') {
      const reason = params.get('reason') || 'Erro desconhecido';
      toast.error(`Erro ao conectar Google Calendar: ${reason}`);
      return;
    }

    if (googleAuth === 'success') {
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const expiresIn    = parseInt(params.get('expires_in') || '3600', 10);

      if (!accessToken) { toast.error('Token não recebido'); return; }

      (async () => {
        try {
          const { error } = await supabase
            .from('google_calendar_tokens')
            .upsert({
              user_id:       user.id,
              access_token:  accessToken,
              refresh_token: refreshToken || null,
              expires_at:    new Date(Date.now() + expiresIn * 1000).toISOString(),
            }, { onConflict: 'user_id' });

          if (error) throw error;
          setIsConnected(true);
          toast.success('Google Calendar conectado! Sincronizando...');
          setTimeout(() => syncFull(), 1500);
        } catch (err) {
          console.error(err);
          toast.error('Erro ao salvar conexão com Google Calendar');
        }
      })();
    }
  }, [user]);

  const connect = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=get_auth_url`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      const result = await res.json();
      if (result.error) { toast.error(result.error); return; }
      if (result.authUrl) window.location.href = result.authUrl;
    } catch {
      toast.error('Erro ao iniciar autenticação com Google');
    }
  };

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

  const syncToGoogle = async () => {
    if (!user || !isConnected) { toast.error('Conecte o Google Calendar primeiro'); return; }
    setIsSyncing(true);
    try {
      const { data: comps } = await supabase
        .from('compromissos').select('id').is('google_event_id', null).is('origem', null);
      if (!comps?.length) { toast.info('Todos os eventos já sincronizados'); return; }
      let synced = 0, errors = 0;
      for (let i = 0; i < comps.length; i += 5) {
        await Promise.all(comps.slice(i, i + 5).map(async (c) => {
          const { data, error } = await supabase.functions.invoke('calendar-sync', {
            body: { action: 'push_to_google', user_id: user.id, compromisso_id: c.id }
          });
          if (error || data?.error) errors++; else synced++;
        }));
      }
      if (synced > 0) toast.success(`${synced} eventos enviados ao Google Calendar`);
      if (errors > 0) toast.warning(`${errors} eventos não sincronizados`);
      setLastSync(new Date());
    } catch { toast.error('Erro ao sincronizar'); } finally { setIsSyncing(false); }
  };

  const syncFromGoogle = async () => {
    if (!user || !isConnected) { toast.error('Conecte o Google Calendar primeiro'); return; }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { action: 'pull_from_google', user_id: user.id }
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (data.novos_importados > 0) toast.success(`${data.novos_importados} eventos importados`);
      else toast.info('Nenhum evento novo no Google Calendar');
      setLastSync(new Date());
    } catch (err: any) { toast.error(`Erro: ${err.message}`); } finally { setIsSyncing(false); }
  };

  const syncFull = async () => {
    if (!user || !isConnected) { toast.error('Conecte o Google Calendar primeiro'); return; }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { action: 'sync_full', user_id: user.id }
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(data.mensagem || 'Sincronização completa!');
      setLastSync(new Date());
    } catch (err: any) { toast.error(`Erro: ${err.message}`); } finally { setIsSyncing(false); }
  };

  const deleteFromGoogle = async (googleEventId: string) => {
    if (!user || !isConnected || !googleEventId) return;
    try {
      await supabase.functions.invoke('calendar-sync', {
        body: { action: 'delete_from_google', user_id: user.id, google_event_id: googleEventId }
      });
    } catch (err) { console.warn('Delete Google (não crítico):', err); }
  };

  return {
    isConnected, isLoading, isSyncing, lastSync,
    connect, disconnect, syncToGoogle, syncFromGoogle, syncFull, deleteFromGoogle, checkConnection,
  };
}
