import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compromisso } from '@/types/compromissos';
import { useToast } from '@/hooks/use-toast';

// Helper function to sync a single compromisso to Google Calendar
async function syncToGoogleCalendar(compromissoId: string): Promise<void> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user has Google Calendar connected
    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) return; // No Google Calendar connected

    // Check if token is expired and needs refresh
    let accessToken = tokenData.access_token;
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
    const isExpired = expiresAt && expiresAt < new Date();

    if (isExpired && tokenData.refresh_token) {
      const response = await supabase.functions.invoke('google-calendar-auth', {
        body: { 
          action: 'refresh',
          refresh_token: tokenData.refresh_token 
        }
      });

      if (response.data?.access_token) {
        accessToken = response.data.access_token;
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: response.data.access_token,
            expires_at: new Date(Date.now() + (response.data.expires_in || 3600) * 1000).toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        console.warn('Could not refresh Google token');
        return;
      }
    }

    // Push to Google Calendar
    await supabase.functions.invoke('calendar-sync', {
      body: {
        action: 'push_to_google',
        google_access_token: accessToken,
        compromisso_id: compromissoId,
      }
    });

    console.log('Compromisso synced to Google Calendar:', compromissoId);
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);
  }
}

export function useCompromissos() {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCompromissos = useCallback(async () => {
    const { data, error } = await supabase
      .from('compromissos')
      .select('*')
      .order('data_inicio', { ascending: true });

    if (error) {
      toast({
        title: 'Erro ao carregar compromissos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setCompromissos((data as Compromisso[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCompromissos();

    const channel = supabase
      .channel('compromissos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'compromissos' },
        () => {
          fetchCompromissos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCompromissos]);

  const createCompromisso = async (compromisso: Omit<Compromisso, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('compromissos')
      .insert(compromisso)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar compromisso',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Compromisso criado!' });

    // Auto-sync to Google Calendar (non-blocking)
    if (data?.id) {
      syncToGoogleCalendar(data.id);
    }

    return { data: data as Compromisso };
  };

  const updateCompromisso = async (id: string, updates: Partial<Compromisso>) => {
    const { error } = await supabase
      .from('compromissos')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar compromisso',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Compromisso atualizado!' });

    // Auto-sync to Google Calendar (non-blocking)
    syncToGoogleCalendar(id);

    return { error: null };
  };

  const deleteCompromisso = async (id: string) => {
    const { error } = await supabase
      .from('compromissos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir compromisso',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Compromisso excluído!' });
    return { error: null };
  };

  return {
    compromissos,
    loading,
    fetchCompromissos,
    createCompromisso,
    updateCompromisso,
    deleteCompromisso,
  };
}
