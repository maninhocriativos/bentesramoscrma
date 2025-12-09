import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tarefa, Timesheet } from '@/types/tarefas';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useTarefas(processoId?: string) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTarefas = async () => {
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
  };

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
    const { error } = await supabase
      .from('tarefas')
      .update(updates)
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

  useEffect(() => {
    fetchTarefas();
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
