import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';

// Histórico completo de processos (2013-2026) mantido pela equipe numa
// planilha do Drive, sincronizado automaticamente por sync-planilha-processos
// — ver planilha_processos_historico. 3400+ linhas: SEMPRE paginar (teto de
// 1000 linhas por página do PostgREST), classe de bug já vista várias vezes
// nesse projeto.
const SELECT = 'ano,nome_cliente,reclamada_requerido,justica,tribunal,andamento,resultado,mes_entrada,materia,qualificacao_cliente' as const;

export interface LinhaPlanilhaProcesso {
  ano: number;
  nome_cliente: string | null;
  reclamada_requerido: string | null;
  justica: string | null;
  tribunal: string | null;
  andamento: string | null;
  resultado: string | null;
  mes_entrada: string | null;
  materia: string | null;
  qualificacao_cliente: string | null;
}

export interface SyncEstado {
  ultima_sincronizacao: string | null;
  total_linhas: number | null;
  status: string | null;
}

export function usePlanilhaProcessos() {
  const [linhas, setLinhas] = useState<LinhaPlanilhaProcesso[]>([]);
  const [syncEstado, setSyncEstado] = useState<SyncEstado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      const [{ data }, { data: estado }] = await Promise.all([
        fetchAllPaginated<LinhaPlanilhaProcesso>((from, to) =>
          supabase.from('planilha_processos_historico').select(SELECT).range(from, to) as any
        ),
        supabase.from('planilha_processos_sync_estado').select('ultima_sincronizacao,total_linhas,status').eq('id', 1).maybeSingle(),
      ]);
      if (!ativo) return;
      setLinhas(data || []);
      setSyncEstado(estado as SyncEstado | null);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  return { linhas, syncEstado, loading };
}
