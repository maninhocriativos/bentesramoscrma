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
    const { data, error } = await supabase
      .from('intimacoes')
      .select('id, processo_cnj, processo_titulo, conteudo, data_intimacao, data_publicacao, data_disponibilizacao, tribunal, tipo_intimacao, lida, oab_numero')
      .gte('data_intimacao', '2026-01-01T00:00:00Z')
      .order('data_intimacao', { ascending: false });

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
