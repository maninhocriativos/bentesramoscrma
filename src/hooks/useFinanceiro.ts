import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Honorario, Parcela, Despesa } from '@/types/financeiro';
import { useToast } from '@/hooks/use-toast';

export interface ProcessoFinanceiro {
  id: string;
  nome_cliente: string | null;
  numero_processo: string | null;
  advogado_responsavel: string | null;
  status: string | null;
  valor_causa: number | null;
  valor_provisionado: number | null;
  probabilidade: string | null;
}

export function useProcessosFinanceiro() {
  const [processos, setProcessos] = useState<ProcessoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('processos')
      .select('id,nome_cliente,numero_processo,advogado_responsavel,status,valor_causa,valor_provisionado,probabilidade')
      .not('status', 'in', '("Arquivado","Perdido")')
      .or('valor_causa.not.is.null,valor_provisionado.not.is.null')
      .order('valor_causa', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        setProcessos((data || []) as ProcessoFinanceiro[]);
        setLoading(false);
      });
  }, []);

  const totalEmCausa      = processos.reduce((s, p) => s + (p.valor_causa || 0), 0);
  const totalProvisionado = processos.reduce((s, p) => s + (p.valor_provisionado || 0), 0);

  return { processos, loading, totalEmCausa, totalProvisionado };
}

export function useHonorarios() {
  const [honorarios, setHonorarios] = useState<Honorario[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHonorarios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('honorarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar honorários', description: error.message, variant: 'destructive' });
    } else {
      setHonorarios(data as Honorario[]);
    }
    setLoading(false);
  };

  const createHonorario = async (honorario: Omit<Honorario, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('honorarios')
      .insert(honorario)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar honorário', description: error.message, variant: 'destructive' });
      return null;
    }
    
    toast({ title: 'Honorário criado com sucesso!' });
    await fetchHonorarios();
    return data;
  };

  const updateHonorario = async (id: string, updates: Partial<Honorario>) => {
    const { error } = await supabase
      .from('honorarios')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar honorário', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Honorário atualizado!' });
    await fetchHonorarios();
    return true;
  };

  const deleteHonorario = async (id: string) => {
    const { error } = await supabase
      .from('honorarios')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir honorário', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Honorário excluído!' });
    await fetchHonorarios();
    return true;
  };

  useEffect(() => {
    fetchHonorarios();
  }, []);

  return { honorarios, loading, fetchHonorarios, createHonorario, updateHonorario, deleteHonorario };
}

export function useParcelas(honorarioId?: string) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchParcelas = async () => {
    setLoading(true);
    let query = supabase
      .from('parcelas')
      .select('*')
      .order('data_vencimento', { ascending: true });

    if (honorarioId) {
      query = query.eq('honorario_id', honorarioId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar parcelas', description: error.message, variant: 'destructive' });
    } else {
      setParcelas(data as Parcela[]);
    }
    setLoading(false);
  };

  const updateParcela = async (id: string, updates: Partial<Parcela>) => {
    const { error } = await supabase
      .from('parcelas')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar parcela', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Parcela atualizada!' });
    await fetchParcelas();
    return true;
  };

  useEffect(() => {
    fetchParcelas();
  }, [honorarioId]);

  return { parcelas, loading, fetchParcelas, updateParcela };
}

export function useDespesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDespesas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('despesas')
      .select('*')
      .order('data_despesa', { ascending: false, nullsFirst: false });

    if (error) {
      toast({ title: 'Erro ao carregar despesas', description: error.message, variant: 'destructive' });
    } else {
      setDespesas(data as Despesa[]);
    }
    setLoading(false);
  };

  const createDespesa = async (despesa: Omit<Despesa, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('despesas')
      .insert(despesa)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar despesa', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Despesa registrada!' });
    await fetchDespesas();
    return data;
  };

  const updateDespesa = async (id: string, updates: Partial<Despesa>) => {
    const { error } = await supabase
      .from('despesas')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar despesa', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Despesa atualizada!' });
    await fetchDespesas();
    return true;
  };

  const deleteDespesa = async (id: string) => {
    const { error } = await supabase
      .from('despesas')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir despesa', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Despesa excluída!' });
    await fetchDespesas();
    return true;
  };

  useEffect(() => {
    fetchDespesas();
  }, []);

  return { despesas, loading, fetchDespesas, createDespesa, updateDespesa, deleteDespesa };
}
