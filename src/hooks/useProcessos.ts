import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Processo } from '@/types/processos';
import { useToast } from '@/hooks/use-toast';
import { usePerfil } from './usePerfil';
import { useAuth } from './useAuth';

const PROCESSOS_LIST_SELECT = 'id,numero_processo,numero_complementar,titulo_acao,status,advogado_responsavel,cliente_id,cpf_cliente,nome_cliente,created_at,tribunal,vara_comarca,assunto,valor_causa,data_ajuizamento,data_ultima_atualizacao,orgao_julgador,grau,classe_cnj,status_detalhado,origem_cliente,ultima_consulta_api_at,frequencia_notificacao_dias,notificacao_ativa,ultima_notificacao_at,descricao,marcadores,area,fase,assunto_cnj,segredo_justica,data_distribuicao,data_citacao,data_recebimento,data_arquivamento,data_encerramento,valor_provisionado,probabilidade,monitorar_push,tipo_orgao_julgador,sistema_judicial,complemento_enderecamento';

// ✅ Normaliza CNJ para uso como chave de deduplicação
function normalizarCNJ(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const digits = numero.replace(/[^\d]/g, '');
  return digits.length === 20 ? digits : null;
}

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { perfil, isAdvogado } = usePerfil();
  const { user } = useAuth();
  const initialLoadDone = useRef(false);

  const isAdvogadoRef = useRef(isAdvogado);
  const perfilNomeRef = useRef(perfil?.nome);

  useEffect(() => { isAdvogadoRef.current = isAdvogado; }, [isAdvogado]);
  useEffect(() => { perfilNomeRef.current = perfil?.nome; }, [perfil?.nome]);

  const fetchProcessos = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);

    let query = supabase
      .from('processos')
      .select(PROCESSOS_LIST_SELECT)
      .order('created_at', { ascending: false });

    if (isAdvogado && perfil?.nome) {
      query = query.eq('advogado_responsavel', perfil.nome);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar processos', description: error.message, variant: 'destructive' });
    } else {
      setProcessos((data as unknown as Processo[]) || []);
    }

    initialLoadDone.current = true;
    setLoading(false);
  }, [isAdvogado, perfil?.nome, toast]);

  useEffect(() => {
    if (!user) return;
    fetchProcessos();
  }, [user, fetchProcessos]);

  // Realtime — canal criado UMA vez com []
  useEffect(() => {
    const channel = supabase
      .channel('processos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'processos' }, (payload) => {
        const next = payload.new as Processo;
        if (isAdvogadoRef.current && perfilNomeRef.current && next.advogado_responsavel !== perfilNomeRef.current) return;
        setProcessos((prev) => {
          if (prev.some((p) => p.id === next.id)) return prev;
          return [next, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'processos' }, (payload) => {
        const next = payload.new as Processo;
        if (isAdvogadoRef.current && perfilNomeRef.current && next.advogado_responsavel !== perfilNomeRef.current) return;
        setProcessos((prev) => {
          const exists = prev.some((p) => p.id === next.id);
          if (!exists) return [next, ...prev];
          return prev.map((p) => (p.id === next.id ? next : p));
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'processos' }, (payload) => {
        setProcessos((prev) => prev.filter((p) => p.id !== (payload.old as Processo).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const createProcesso = async (processo: Partial<Omit<Processo, 'id' | 'created_at'>>) => {
    // ✅ Sempre preenche cnj_normalizado ao criar
    const cnj = normalizarCNJ(processo.numero_processo);
    if (cnj) (processo as any).cnj_normalizado = cnj;

    // ✅ Verifica duplicata ANTES de tentar inserir — evita erro de unique constraint
    if (cnj) {
      const { data: existing } = await supabase
        .from('processos')
        .select('id, numero_processo')
        .eq('cnj_normalizado', cnj)
        .maybeSingle();

      if (existing) {
        toast({
          title: 'Processo já cadastrado',
          description: `O processo ${existing.numero_processo} já existe no sistema.`,
          variant: 'destructive',
        });
        return { error: { message: 'Processo já cadastrado', code: '23505' } };
      }
    }

    const { data, error } = await supabase
      .from('processos')
      .insert(processo)
      .select()
      .single();

    if (error) {
      // ✅ Tratamento específico para unique violation (número duplicado)
      if (error.code === '23505') {
        toast({
          title: 'Processo já cadastrado',
          description: 'Já existe um processo com este número no sistema.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Erro ao criar processo', description: error.message, variant: 'destructive' });
      }
      return { error };
    }

    toast({ title: 'Processo criado com sucesso!' });
    return { data: data as Processo };
  };

  const updateProcesso = async (id: string, updates: Partial<Processo>) => {
    // ✅ Atualiza cnj_normalizado se numero_processo mudou
    const cnj = normalizarCNJ((updates as any).numero_processo);
    if (cnj) (updates as any).cnj_normalizado = cnj;

    const { error } = await supabase
      .from('processos')
      .update(updates)
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Número duplicado',
          description: 'Já existe outro processo com este número CNJ.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Erro ao atualizar processo', description: error.message, variant: 'destructive' });
      }
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
