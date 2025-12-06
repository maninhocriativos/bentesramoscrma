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

    // Real-time subscription
    const channel = supabase
      .channel('processos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'processos' },
        () => {
          fetchProcessos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdvogado, perfil?.nome]);

  const createProcesso = async (processo: Omit<Processo, 'id' | 'created_at'>) => {
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
