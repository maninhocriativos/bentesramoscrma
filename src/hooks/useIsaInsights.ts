import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IsaInsight {
  leadId: string;
  sentimento: 'positivo' | 'neutro' | 'negativo' | null;
  urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  ultimaAnalise: string | null;
}

export function useIsaInsights(leadIds: string[]) {
  const [insights, setInsights] = useState<Record<string, IsaInsight>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (leadIds.length === 0) return;

    const fetchInsights = async () => {
      setLoading(true);
      try {
        // Buscar últimas análises da Isa para cada lead
        const { data, error } = await supabase
          .from('system_events')
          .select('lead_id, dados, created_at')
          .eq('fonte', 'isa')
          .in('lead_id', leadIds)
          .in('acao', ['classificar_lead', 'criar_interacao', 'analise'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Agregar por lead_id, pegando a análise mais recente
        const insightsMap: Record<string, IsaInsight> = {};
        
        data?.forEach((event) => {
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