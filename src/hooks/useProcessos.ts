import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Processo, ProcessoStatus } from '@/types/processos';
import { useToast } from '@/hooks/use-toast';
import { usePerfil } from './usePerfil';
import { useAuth } from './useAuth';

// Only select columns actually needed in listings/dashboard
const PROCESSOS_SELECT = 'id,numero_processo,titulo_acao,status,advogado_responsavel,cliente_id,created_at,tribunal,vara_comarca,assunto,valor_causa,data_ajuizamento,data_ultima_atualizacao,orgao_julgador,grau,classe_cnj,status_detalhado,origem_cliente,ultima_consulta_api_at,frequencia_notificacao_dias,notificacao_ativa,ultima_notificacao_at,partes_json,movimentos_json';

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { perfil, isAdvogado } = usePerfil();
  const { user } = useAuth();

  const fetchProcessos = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('processos')
      .select(PROCESSOS_SELECT)
      .order('created_at', { ascending: false });

    if (isAdvogado && perfil?.nome) {
      query = query.eq('advogado_responsavel', perfil.nome);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar processos', description: error.message, variant: 'destructive' });
    } else {
      setProcessos((data as Processo[]) || []);
    }
    setLoading(false);
  }, [isAdvogado, perfil?.nome, toast]);

  useEffect(() => {
    if (user) {
      fetchProcessos();
    }
  }, [user, fetchProcessos]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('processos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'processos' },
        (payload) => {
          const next = payload.new as Processo;
          if (isAdvogado && perfil?.nome && next.advogado_responsavel !== perfil.nome) return;
          setProcessos((prev) => {
            if (prev.some((p) => p.id === next.id)) return prev;
            return [next, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'processos' },
        (payload) => {
          const next = payload.new as Processo;
          if (isAdvogado && perfil?.nome && next.advogado_responsavel !== perfil.nome) return;
          setProcessos((prev) => {
            const exists = prev.some((p) => p.id === next.id);
            if (!exists) return [next, ...prev];
            return prev.map((p) => (p.id === next.id ? next : p));
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'processos' },
        (payload) => {
          setProcessos((prev) => prev.filter((p) => p.id !== (payload.old as Processo).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdvogado, perfil?.nome]);

  const createProcesso = async (processo: Partial<Omit<Processo, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase
      .from('processos')
      .insert(processo)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar processo', description: error.message, variant: 'destructive' });
      return { error };
    }

    toast({ title: 'Processo criado com sucesso!' });
    // Realtime will handle the state update — no need to refetch
    return { data: data as Processo };
  };

  const updateProcesso = async (id: string, updates: Partial<Processo>) => {
    const { error } = await supabase
      .from('processos')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar processo', description: error.message, variant: 'destructive' });
      return { error };
    }

    toast({ title: 'Processo atualizado!' });
    // Realtime will handle the state update — no need to refetch
    return { error: null };
  };

  const deleteProcesso = async (id: string) => {
    const { error } = await supabase
      .from('processos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir processo', description: error.message, variant: 'destructive' });
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
