import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check if user has connected Google Calendar
  const checkConnection = useCallback(async () => {
    if (!user) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setIsConnected(!!data);
    } catch (error) {
      console.error('Error checking Google Calendar connection:', error);
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
      if (event.data?.type === 'google-oauth-success' && user) {
        const tokens = event.data.tokens as GoogleTokens;
        
        try {
          // Calculate expires_at
          const expiresAt = tokens.expires_at 
            ? new Date(tokens.expires_at).toISOString()
            : new Date(Date.now() + 3600 * 1000).toISOString();

          const { error } = await supabase
            .from('google_calendar_tokens')
            .upsert({
              user_id: user.id,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              expires_at: expiresAt,
            }, { onConflict: 'user_id' });

          if (error) throw error;

          setIsConnected(true);
          toast.success('Google Calendar conectado com sucesso!');
        } catch (error) {
          console.error('Error saving Google tokens:', error);
          toast.error('Erro ao salvar conexão com Google Calendar');
        }
      } else if (event.data?.type === 'google-oauth-error') {
        toast.error(`Erro na autenticação: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // Start OAuth flow
  const connect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {},
        method: 'GET',
      });

      // Try getting auth URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://qgenaltkjtlvwfgykpxq.supabase.co'}/functions/v1/google-calendar-auth?action=get_auth_url`
      );
      
      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.authUrl) {
        // Open popup for OAuth
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        window.open(
          result.authUrl,
          'Google Calendar Auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      toast.error('Erro ao iniciar autenticação com Google');
    }
  };

  // Disconnect Google Calendar
  const disconnect = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsConnected(false);
      toast.success('Google Calendar desconectado');
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      toast.error('Erro ao desconectar Google Calendar');
    }
  };

  // Get valid access token (refresh if needed)
  const getAccessToken = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      // Check if token is expired
      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      const isExpired = expiresAt && expiresAt < new Date();

      if (isExpired && data.refresh_token) {
        // Refresh the token
        const response = await supabase.functions.invoke('google-calendar-auth', {
          body: { 
            action: 'refresh',
            refresh_token: data.refresh_token 
          }
        });

        if (response.data?.access_token) {
          // Update stored token
          await supabase
            .from('google_calendar_tokens')
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

  // Sync local events to Google Calendar
  const syncToGoogle = async () => {
    if (!user || !isConnected) {
      toast.error('Conecte sua conta do Google primeiro');
      return;
    }

    setIsSyncing(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error('Token expirado. Reconecte sua conta do Google.');
        setIsConnected(false);
        return;
      }

      // Get local compromissos that are not from external sources
      const { data: compromissos, error } = await supabase
        .from('compromissos')
        .select('*')
        .or('origem.is.null,origem.eq.local')
        .order('data_inicio', { ascending: true });

      if (error) throw error;

      let synced = 0;
      let errors = 0;

      for (const compromisso of compromissos || []) {
        try {
          const { data, error: syncError } = await supabase.functions.invoke('calendar-sync', {
            body: {
              action: 'push_to_google',
              google_access_token: accessToken,
              compromisso_id: compromisso.id,
            }
          });

          if (syncError || data?.error) {
            console.error('Error syncing to Google:', syncError || data?.error);
            errors++;
          } else {
            synced++;
          }
        } catch (e) {
          console.error('Error syncing event:', e);
          errors++;
        }
      }

      if (synced > 0) {
        toast.success(`${synced} eventos sincronizados com Google Calendar`);
      }
      if (errors > 0) {
        toast.warning(`${errors} eventos não puderam ser sincronizados`);
      }
      if (synced === 0 && errors === 0) {
        toast.info('Nenhum evento local para sincronizar');
      }
    } catch (error) {
      console.error('Error syncing to Google:', error);
      toast.error('Erro ao sincronizar com Google Calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isConnected,
    isLoading,
    isSyncing,
    connect,
    disconnect,
    syncToGoogle,
    checkConnection,
  };
}
