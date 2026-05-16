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

  // ── Ouvir postMessage do popup /google-auth-callback ────────────────────────
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-calendar-connected') {
        // Tokens já salvos no banco pelo servidor — só recarregar estado
        await checkConnection();
        toast.success('Google Calendar conectado! Sincronizando...');
        setTimeout(() => syncFull(), 1500);
      } else if (event.data?.type === 'google-oauth-error') {
        toast.error(`Erro ao conectar: ${event.data.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkConnection]);

  // ── Iniciar OAuth — abre popup ───────────────────────────────────────────────
  const connect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth?action=get_auth_url`,
        { method: 'GET', headers }
      );
      const result = await res.json();
      if (result.error) { toast.error(result.error); return; }
      if (result.authUrl) {
        const w = 600, h = 700;
        const popup = window.open(
          result.authUrl,
          'Google Calendar Auth',
          `width=${w},height=${h},left=${window.screen.width/2 - w/2},top=${window.screen.height/2 - h/2}`
        );
        if (!popup) toast.warning('Popup bloqueado! Autorize popups para este site.');
      }
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
    if (!user || !isConnected) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { action: 'sync_full', user_id: user.id }
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(data.mensagem || 'Sincronização completa!');
      setLastSync(new Date());
    } catch (err: any) { console.warn('syncFull:', err.message); } finally { setIsSyncing(false); }
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
