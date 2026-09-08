import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TarefaRecorrente } from '@/types/tarefasRecorrentes';
import { useToast } from '@/hooks/use-toast';

export function useTarefasRecorrentes() {
  const [recorrentes, setRecorrentes] = useState<TarefaRecorrente[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRecorrentes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tarefas_recorrentes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar tarefas recorrentes', description: error.message, variant: 'destructive' });
    } else {
      setRecorrentes((data || []) as TarefaRecorrente[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchRecorrentes(); }, [fetchRecorrentes]);

  const createRecorrente = async (rec: Omit<TarefaRecorrente, 'id' | 'created_at' | 'updated_at' | 'ultima_geracao_em'>) => {
    const { data, error } = await supabase
      .from('tarefas_recorrentes')
      .insert({ ...rec, ultima_geracao_em: null })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar recorrência', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Tarefa recorrente criada!' });
    await fetchRecorrentes();
    return data;
  };

  const updateRecorrente = async (id: string, updates: Partial<TarefaRecorrente>) => {
    const { error } = await supabase.from('tarefas_recorrentes').update(updates).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar recorrência', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchRecorrentes();
    return true;
  };

  const toggleAtiva = async (id: string, ativa: boolean) => updateRecorrente(id, { ativa });

  const deleteRecorrente = async (id: string) => {
    const { error } = await supabase.from('tarefas_recorrentes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir recorrência', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Recorrência excluída' });
    await fetchRecorrentes();
    return true;
  };

  return { recorrentes, loading, fetchRecorrentes, createRecorrente, updateRecorrente, toggleAtiva, deleteRecorrente };
}
