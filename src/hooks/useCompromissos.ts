import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compromisso } from '@/types/compromissos';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// SYNC AUTOMÁTICO COM GOOGLE CALENDAR (não-bloqueante)
// =============================================================================

async function autoSyncToGoogle(compromissoId: string): Promise<void> {
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
        action: 'push_to_google',
        user_id: user.id,
        compromisso_id: compromissoId,
      },
    });
  } catch (err) {
    console.warn('[useCompromissos] Google sync failed (non-critical):', err);
  }
}

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
      },
    });
  } catch (err) {
    console.warn('[useCompromissos] Google delete failed (non-critical):', err);
  }
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

export function useCompromissos() {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const channelRef = useRef<any>(null);

  // ─── Buscar todos os compromissos (paginado — supera o limite de 1000 do PostgREST) ──
  const fetchCompromissos = useCallback(async () => {

    const PAGE = 1000;
    const all: Compromisso[] = [];
    let page = 0;

    while (true) {
      const { data, error } = await supabase
        .from('compromissos')
        .select('*')
        .order('data_inicio', { ascending: true })
        .range(page * PAGE, (page + 1) * PAGE - 1);

      if (error) {
        toast({
          title: 'Erro ao carregar compromissos',
          description: error.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const chunk = (data as Compromisso[]) || [];
      all.push(...chunk);
      if (chunk.length < PAGE) break;
      page++;
    }

    setCompromissos(all);
    setLoading(false);
  }, [toast]);

  // ─── Inicializa: fetch + realtime ───────────────────────────────────────────
  useEffect(() => {
    fetchCompromissos();

    // Cleanup canal anterior (defensivo)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Subscreve realtime
    const channel = supabase
      .channel(`compromissos-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compromissos' }, () => {
        fetchCompromissos();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchCompromissos]);

  // ─── Criar compromisso ──────────────────────────────────────────────────────
  const createCompromisso = async (
    payload: Omit<Compromisso, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data?: Compromisso; error?: any }> => {
    // Tentar pegar o usuário atual e setar como responsável (caso esteja vazio)
    let finalPayload: any = { ...payload };
    if (!finalPayload.responsavel_id) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) finalPayload.responsavel_id = user.id;
      } catch {}
    }

    const { data, error } = await supabase
      .from('compromissos')
      .insert(finalPayload)
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

    // ✅ FIX importante: ATUALIZA o estado local imediatamente
    // Não espera o realtime — adiciona direto na lista
    if (data) {
      const newComp = data as Compromisso;
      setCompromissos(prev => {
        // Evita duplicatas (caso realtime chegue antes)
        if (prev.some(c => c.id === newComp.id)) return prev;
        return [...prev, newComp].sort(
          (a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
        );
      });
    }

    toast({ title: '✅ Compromisso criado!' });

    if (data?.id) {
      // Sync com Google (não bloqueia)
      autoSyncToGoogle(data.id);

      // WhatsApp confirmação se tem lead
      if (payload.lead_id) {
        supabase.functions.invoke('isa-scheduler', {
          body: { task: 'confirmacao_imediata', compromissoId: data.id },
        }).catch(() => {});
      }
    }

    return { data: data as Compromisso };
  };

  // ─── Atualizar compromisso ──────────────────────────────────────────────────
  const updateCompromisso = async (
    id: string,
    updates: Partial<Compromisso>
  ): Promise<{ error: any }> => {
    const { data, error } = await supabase
      .from('compromissos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao atualizar compromisso',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    // ✅ Atualiza estado local imediatamente
    if (data) {
      const updated = data as Compromisso;
      setCompromissos(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updated } : c))
          .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
      );
    }

    toast({ title: '✅ Compromisso atualizado!' });
    autoSyncToGoogle(id);

    return { error: null };
  };

  // ─── Deletar compromisso ────────────────────────────────────────────────────
  const deleteCompromisso = async (id: string): Promise<{ error: any }> => {
    const comp = compromissos.find(c => c.id === id);
    const googleEventId = (comp as any)?.google_event_id;

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

    // ✅ Remove do estado imediatamente
    setCompromissos(prev => prev.filter(c => c.id !== id));

    toast({ title: '🗑️ Compromisso excluído!' });

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
