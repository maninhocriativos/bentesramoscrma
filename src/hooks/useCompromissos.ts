import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compromisso } from '@/types/compromissos';
import { useToast } from '@/hooks/use-toast';

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
