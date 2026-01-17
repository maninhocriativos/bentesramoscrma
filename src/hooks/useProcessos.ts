import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Processo, ProcessoStatus } from '@/types/processos';
import { useToast } from '@/hooks/use-toast';
import { usePerfil } from './usePerfil';
import { useAuth } from './useAuth';

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { perfil, isAdvogado } = usePerfil();
  const { user } = useAuth();

  const fetchProcessos = async () => {
    setLoading(true);
    
    let query = supabase
      .from('processos')
      .select('*')
      .order('created_at', { ascending: false });

    // Advogados see only their processes
    if (isAdvogado && perfil?.nome) {
      query = query.eq('advogado_responsavel', perfil.nome);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: 'Erro ao carregar processos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setProcessos((data as Processo[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchProcessos();
    }
  }, [user, isAdvogado, perfil?.nome]);

  // Separate effect for realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('processos-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'processos' },
        (payload) => {
          console.log('🟢 Processo INSERT:', payload.new);
          setProcessos(prev => {
            if (prev.some(p => p.id === (payload.new as Processo).id)) return prev;
            return [payload.new as Processo, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'processos' },
        (payload) => {
          console.log('🟡 Processo UPDATE:', payload.new);
          setProcessos(prev => 
            prev.map(p => 
              p.id === (payload.new as Processo).id ? (payload.new as Processo) : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'processos' },
        (payload) => {
          console.log('🔴 Processo DELETE:', payload.old);
          setProcessos(prev => prev.filter(p => p.id !== (payload.old as Processo).id));
        }
      )
      .subscribe((status) => {
        console.log('📡 Processos realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createProcesso = async (processo: Partial<Omit<Processo, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase
      .from('processos')
      .insert(processo)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar processo',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Processo criado com sucesso!' });
    return { data: data as Processo };
  };

  const updateProcesso = async (id: string, updates: Partial<Processo>) => {
    const { error } = await supabase
      .from('processos')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar processo',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Processo atualizado!' });
    return { error: null };
  };

  const deleteProcesso = async (id: string) => {
    const { error } = await supabase
      .from('processos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir processo',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({ title: 'Processo excluído!' });
    return { error: null };
  };

  return {
    processos,
    loading,
    fetchProcessos,
    createProcesso,
    updateProcesso,
    deleteProcesso,
  };
}
