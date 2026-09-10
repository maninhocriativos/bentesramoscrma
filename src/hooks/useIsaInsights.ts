import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IsaInsight {
  leadId: string;
  sentimento: 'positivo' | 'neutro' | 'negativo' | null;
  urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  ultimaAnalise: string | null;
}

// Tamanho seguro de lote pro filtro .in(...) — acima disso a URL da consulta
// fica grande demais e o navegador recusa a requisição (TypeError: Failed to
// fetch). O Board da Pipeline de Leads pode passar milhares de IDs de uma vez.
const CHUNK_SIZE = 150;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function useIsaInsights(leadIds: string[]) {
  const [insights, setInsights] = useState<Record<string, IsaInsight>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (leadIds.length === 0) return;

    const fetchInsights = async () => {
      setLoading(true);
      try {
        // Buscar últimas análises da Isa para cada lead — em lotes, senão
        // uma lista grande de IDs (Board sem paginação) estoura o limite de
        // tamanho de URL da requisição.
        const batches = chunk(leadIds, CHUNK_SIZE);
        const results = await Promise.all(batches.map(batch =>
          supabase
            .from('system_events')
            .select('lead_id, dados, created_at')
            .eq('fonte', 'isa')
            .in('lead_id', batch)
            .in('acao', ['classificar_lead', 'criar_interacao', 'analise'])
            .order('created_at', { ascending: false })
        ));

        const data: any[] = [];
        for (const r of results) {
          if (r.error) { console.error('[useIsaInsights] erro num lote:', r.error); continue; }
          data.push(...(r.data || []));
        }

        // Agregar por lead_id, pegando a análise mais recente
        const insightsMap: Record<string, IsaInsight> = {};

        data.forEach((event) => {
          if (!event.lead_id || insightsMap[event.lead_id]) return;

          const dados = event.dados as any;
          const analise = dados?.analise || {};

          insightsMap[event.lead_id] = {
            leadId: event.lead_id,
            sentimento: analise?.sentimento || null,
            urgencia: analise?.urgencia || null,
            ultimaAnalise: event.created_at,
          };
        });

        setInsights(insightsMap);
      } catch (error) {
        console.error('Erro ao buscar insights da Isa:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [leadIds.join(',')]);

  return { insights, loading };
}