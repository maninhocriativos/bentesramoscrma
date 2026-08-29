import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IntimacaoEvent {
  id: string;
  processo_cnj: string | null;
  processo_titulo: string | null;
  conteudo: string | null;
  data_intimacao: string | null;
  data_publicacao: string | null;
  data_disponibilizacao: string | null;
  tribunal: string | null;
  tipo_intimacao: string | null;
  lida: boolean;
  oab_numero: string;
}

export function useIntimacoes() {
  const [intimacoes, setIntimacoes] = useState<IntimacaoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntimacoes = useCallback(async () => {
    // A fonte ativa hoje (processo-djen-sync) nunca preenche data_intimacao —
    // só data_publicacao/data_disponibilizacao. O filtro .gte('data_intimacao', ...)
    // que existia aqui excluía TODA linha com data_intimacao nula (NULL >= x é
    // sempre falso no Postgres), ou seja, zerava o resultado pra praticamente
    // tudo que o sync atual insere. IntimacoesPage.tsx (a tela real) nunca usou
    // esse filtro — ordena por data_publicacao/disponibilizacao/created_at, sem
    // exigir data_intimacao. Replicado aqui pelo mesmo motivo.
    const { data, error } = await supabase
      .from('intimacoes')
      .select('id, processo_cnj, processo_titulo, conteudo, data_intimacao, data_publicacao, data_disponibilizacao, tribunal, tipo_intimacao, lida, oab_numero')
      .order('data_publicacao', { ascending: false, nullsFirst: false })
      .order('data_disponibilizacao', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setIntimacoes(data as IntimacaoEvent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIntimacoes();
  }, [fetchIntimacoes]);

  return { intimacoes, loading, fetchIntimacoes };
}
