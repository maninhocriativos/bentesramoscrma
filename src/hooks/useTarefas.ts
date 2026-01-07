import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tarefa, Timesheet } from '@/types/tarefas';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useTarefas(processoId?: string) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tarefas')
      .select('*')
      .order('data_limite', { ascending: true });

    if (processoId) {
      query = query.eq('processo_id', processoId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar tarefas', description: error.message, variant: 'destructive' });
    } else {
      setTarefas(data as Tarefa[]);
    }
    setLoading(false);
  }, [processoId, toast]);

  const createTarefa = async (tarefa: Omit<Tarefa, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('tarefas')
      .insert(tarefa)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar tarefa', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Tarefa criada!' });
    return data;
  };

  const updateTarefa = async (id: string, updates: Partial<Tarefa>) => {
    const { error } = await supabase
      .from('tarefas')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar tarefa', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Tarefa atualizada!' });
    return true;
  };

  const deleteTarefa = async (id: string) => {
    const { error } = await supabase
      .from('tarefas')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir tarefa', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Tarefa excluída!' });
    return true;
  };

  // Initial fetch
  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  // Realtime subscriptions
  useEffect(() => {
    console.log('🔔 Tarefas: Configurando realtime...');
    
    const channel = supabase.channel('tarefas-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tarefas' }, (payload) => {
        console.log('🆕 Tarefa inserida:', payload.new);
        const newTarefa = payload.new as Tarefa;
        if (!processoId || newTarefa.processo_id === processoId) {
          setTarefas(prev => {
            if (prev.some(t => t.id === newTarefa.id)) return prev;
            return [...prev, newTarefa].sort((a, b) => {
              if (!a.data_limite) return 1;
              if (!b.data_limite) return -1;
              return new Date(a.data_limite).getTime() - new Date(b.data_limite).getTime();
            });
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tarefas' }, (payload) => {
        console.log('✏️ Tarefa atualizada:', payload.new);
        const updated = payload.new as Tarefa;
        setTarefas(prev => prev.map(t => t.id === updated.id ? updated : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tarefas' }, (payload) => {
        console.log('🗑️ Tarefa deletada:', payload.old);
        const deleted = payload.old as { id: string };
        setTarefas(prev => prev.filter(t => t.id !== deleted.id));
      })
      .subscribe((status) => {
        console.log('📡 Tarefas channel status:', status);
      });

    return () => {
      console.log('🔕 Tarefas: Removendo canal realtime');
      supabase.removeChannel(channel);
    };
  }, [processoId]);

  return { tarefas, loading, fetchTarefas, createTarefa, updateTarefa, deleteTarefa };
}

export function useTimesheet() {
  const [registros, setRegistros] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchRegistros = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('timesheet')
      .select('*')
      .order('data_atividade', { ascending: false })
      .order('hora_inicio', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar registros', description: error.message, variant: 'destructive' });
    } else {
      setRegistros(data as Timesheet[]);
    }
    setLoading(false);
  };

  const createRegistro = async (registro: Omit<Timesheet, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('timesheet')
      .insert({ ...registro, usuario_id: user?.id })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao registrar horas', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Horas registradas!' });
    await fetchRegistros();
    return data;
  };

  const updateRegistro = async (id: string, updates: Partial<Timesheet>) => {
    const { error } = await supabase
      .from('timesheet')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar registro', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Registro atualizado!' });
    await fetchRegistros();
    return true;
  };

  const deleteRegistro = async (id: string) => {
    const { error } = await supabase
      .from('timesheet')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir registro', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Registro excluído!' });
    await fetchRegistros();
    return true;
  };

  useEffect(() => {
    fetchRegistros();
  }, []);

  return { registros, loading, fetchRegistros, createRegistro, updateRegistro, deleteRegistro };
}
