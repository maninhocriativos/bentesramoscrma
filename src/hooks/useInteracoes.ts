import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Interacao } from '@/types/interacoes';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useInteracoes(clienteId?: string) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchInteracoes = async () => {
    setLoading(true);
    let query = supabase
      .from('interacoes')
      .select('*')
      .order('data_interacao', { ascending: false });

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar interações', description: error.message, variant: 'destructive' });
    } else {
      setInteracoes(data as Interacao[]);
    }
    setLoading(false);
  };

  const createInteracao = async (interacao: Omit<Interacao, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('interacoes')
      .insert({ ...interacao, responsavel_id: user?.id })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao registrar interação', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Interação registrada!' });
    await fetchInteracoes();
    return data;
  };

  const updateInteracao = async (id: string, updates: Partial<Interacao>) => {
    const { error } = await supabase
      .from('interacoes')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar interação', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Interação atualizada!' });
    await fetchInteracoes();
    return true;
  };

  const deleteInteracao = async (id: string) => {
    const { error } = await supabase
      .from('interacoes')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir interação', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Interação excluída!' });
    await fetchInteracoes();
    return true;
  };

  useEffect(() => {
    fetchInteracoes();
  }, [clienteId]);

  return { interacoes, loading, fetchInteracoes, createInteracao, updateInteracao, deleteInteracao };
}
