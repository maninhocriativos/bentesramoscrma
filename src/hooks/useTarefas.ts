import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tarefa, Timesheet } from '@/types/tarefas';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';

export function useTarefas(processoId?: string) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const channelName = useRef(`tarefas-realtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const fetchTarefas = useCallback(async () => {
    setLoading(true);

    // Paginado — sem isso, um único .select('*') fica sujeito ao teto padrão
    // de 1000 linhas por requisição do PostgREST: passando desse número, a
    // tabela corta silenciosamente (sem erro) e a página de Tarefas + os
    // widgets do Dashboard que usam este hook passam a mostrar dados
    // incompletos sem nenhum aviso. Mesmo bug já corrigido em useLeads/
    // useProcessos — aqui pagina do mesmo jeito, em paralelo.
    const { data, error } = await fetchAllPaginated<Tarefa>((from, to) => {
      // Ordena por data_limite + id como desempate: data_limite sozinho não é
      // único (muitas tarefas podem compartilhar a mesma data), e paginação
      // por .range() só é confiável com uma ordem totalmente determinística —
      // sem desempate, linhas podem repetir ou faltar entre páginas buscadas
      // em paralelo.
      let query = supabase
        .from('tarefas')
        .select('*')
        .order('data_limite', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (processoId) query = query.eq('processo_id', processoId);
      return query;
    });

    if (error) {
      toast({ title: 'Erro ao carregar tarefas', description: error.message, variant: 'destructive' });
    } else {
      setTarefas(data);
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
    await fetchTarefas();
    return data;
  };

  const updateTarefa = async (id: string, updates: Partial<Tarefa>) => {
    const enriched: Partial<Tarefa> = { ...updates };
    if (updates.status === 'Em Andamento') {
      const existing = tarefas.find(t => t.id === id);
      if (existing && !existing.started_at) enriched.started_at = new Date().toISOString();
    }
    if (updates.status === 'Concluída' && !updates.data_conclusao) {
      enriched.data_conclusao = new Date().toISOString().slice(0, 10);
    }
    const { error } = await supabase
      .from('tarefas')
      .update(enriched)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar tarefa', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Tarefa atualizada!' });
    await fetchTarefas();
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
    await fetchTarefas();
    return true;
  };

  // Initial fetch
  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase.channel(channelName.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tarefas' }, (payload) => {
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
        const updated = payload.new as Tarefa;
        setTarefas(prev => prev.map(t => t.id === updated.id ? updated : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tarefas' }, (payload) => {
        const deleted = payload.old as { id: string };
        setTarefas(prev => prev.filter(t => t.id !== deleted.id));
      })
      .subscribe();

    return () => {
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
