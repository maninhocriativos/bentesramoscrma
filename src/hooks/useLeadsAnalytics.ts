import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Campos mínimos para os gráficos da página de Dados.
// Inclui `profissao` (não está no select padrão de useLeads) para derivar a categoria do beneficiário.
const ANALYTICS_SELECT =
  'id,created_at,status,origem,tipo_acao,uf,profissao,valor_causa,is_lost,lost_at' as const;

export interface LeadAnalytics {
  id: string;
  created_at: string;
  status: string | null;
  origem: string | null;
  tipo_acao: string | null;
  uf: string | null;
  profissao: string | null;
  valor_causa: number | null;
  is_lost: boolean | null;
  lost_at: string | null;
}

export function useLeadsAnalytics() {
  const [leads, setLeads] = useState<LeadAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const loadedOnce = useRef(false);

  const fetchLeads = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);

    const { data, error } = await supabase
      .from('leads_juridicos')
      .select(ANALYTICS_SELECT)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } else {
      setLeads((data as LeadAnalytics[]) || []);
    }

    loadedOnce.current = true;
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return { leads, loading, refetch: fetchLeads };
}
