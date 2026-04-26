import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compromisso } from '@/types/compromissos';
import { useToast } from '@/hooks/use-toast';

// ─── Sync automático ao criar/editar ─────────────────────────────────────────
async function autoSyncToGoogle(compromissoId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) return; // Google não conectado

    await supabase.functions.invoke('calendar-sync', {
      body: {
        action: 'push_to_google',
        user_id: user.id,
        compromisso_id: compromissoId,
      }
    });

    console.log('[useCompromissos] Auto-sync OK:', compromissoId);
  } catch (err) {
    console.warn('[useCompromissos] Auto-sync falhou (não crítico):', err);
  }
}

// ─── Deletar do Google ao deletar do CRM ─────────────────────────────────────
async function autoDeleteFromGoogle(googleEventId: string): Promise<void> {
  if (!googleEventId) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tokenData } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenData) return;

    await supabase.functions.invoke('calendar-sync', {
      body: {
        action: 'delete_from_google',
        user_id: user.id,
        google_event_id: googleEventId,
      }
    });
  } catch (err) {
    console.warn('[useCompromissos] Delete do Google falhou (não crítico):', err);
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
      toast({ title: 'Erro ao carregar compromissos', description: error.message, variant: 'destructive' });
    } else {
      setCompromissos((data as Compromisso[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      setLoading(false);
    } else {
      fetchCompromissos();
    }

    const channel = supabase
      .channel('compromissos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compromissos' }, () => {
        fetchCompromissos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCompromissos]);

  const createCompromisso = async (compromisso: Omit<Compromisso, 'id' | 'created_at' | 'updated_at'>) => {
    console.log('[useCompromissos] createCompromisso payload:', compromisso);

    const { data, error } = await supabase
      .from('compromissos')
      .insert(compromisso)
      .select()
      .single();

    if (error) {
      console.error('[useCompromissos] Erro no INSERT:', error);
      toast({ title: 'Erro ao criar compromisso', description: error.message, variant: 'destructive' });
      return { error };
    }

    console.log('[useCompromissos] INSERT OK:', data);
    toast({ title: 'Compromisso criado!' });

    if (data?.id) {
      // Auto-sync Google Calendar (non-blocking)
      autoSyncToGoogle(data.id);

      // Confirmação WhatsApp se tem lead vinculado
      if (compromisso.lead_id) {
        supabase.functions.invoke('isa-scheduler', {
          body: { task: 'confirmacao_imediata', compromissoId: data.id }
        }).catch(err => console.log('Confirmação WhatsApp:', err));
      }
    }

    return { data: data as Compromisso };
  };

  const updateCompromisso = async (id: string, updates: Partial<Compromisso>) => {
    console.log('[useCompromissos] updateCompromisso:', id, updates);

    const { error } = await supabase
      .from('compromissos')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[useCompromissos] Erro no UPDATE:', error);
      toast({ title: 'Erro ao atualizar compromisso', description: error.message, variant: 'destructive' });
      return { error };
    }

    toast({ title: 'Compromisso atualizado!' });

    // Auto-sync Google Calendar (non-blocking)
    autoSyncToGoogle(id);

    return { error: null };
  };

  const deleteCompromisso = async (id: string) => {
    // Buscar google_event_id antes de deletar
    const comp = compromissos.find(c => c.id === id);
    const googleEventId = (comp as any)?.google_event_id;

    const { error } = await supabase
      .from('compromissos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir compromisso', description: error.message, variant: 'destructive' });
      return { error };
    }

    toast({ title: 'Compromisso excluído!' });

    // Deletar do Google também (non-blocking)
    if (googleEventId) autoDeleteFromGoogle(googleEventId);

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
