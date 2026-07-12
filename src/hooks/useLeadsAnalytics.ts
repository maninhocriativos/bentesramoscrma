import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Campos mínimos para os gráficos da página de Dados.
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

export interface CategoriaCount { name: string; value: number }

const CATEGORIA_ORDER = ['Servidor Público', 'Aposentado', 'Pensionista', 'Carteira Assinada', 'Aéreo', 'Outro', 'Não informado'];
const CATEGORIA_CONHECIDAS = new Set(['Servidor Público', 'Aposentado', 'Pensionista', 'Carteira Assinada', 'Aéreo']);

// Busca TODAS as linhas de uma tabela (o PostgREST corta em ~1000 por requisição).
async function fetchAll<T>(table: string, select: string): Promise<{ rows: T[]; error: string | null }> {
  const PAGE = 1000;
  const rows: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from(table as any).select(select).range(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    const batch = (data as T[]) || [];
    rows.push(...batch);
    if (batch.length < PAGE || rows.length >= 50000) break;
    from += PAGE;
  }
  return { rows, error: null };
}

export function useLeadsAnalytics() {
  const [leads, setLeads] = useState<LeadAnalytics[]>([]);
  const [categoriaProcessos, setCategoriaProcessos] = useState<CategoriaCount[]>([]);
  const [totalProcessos, setTotalProcessos] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const loadedOnce = useRef(false);

  const fetchAllData = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);

    // Leads (todos os gráficos exceto o Perfil do Beneficiário)
    const leadsRes = await fetchAll<LeadAnalytics>('leads_juridicos', ANALYTICS_SELECT);
    if (leadsRes.error) {
      toast({ title: 'Erro ao carregar leads', description: leadsRes.error, variant: 'destructive' });
    } else {
      setLeads(leadsRes.rows);
    }

    // Perfil do Beneficiário: campo estruturado nos PROCESSOS.
    const procRes = await fetchAll<{ categoria_beneficiario: string | null }>('processos', 'categoria_beneficiario');
    if (!procRes.error) {
      const map: Record<string, number> = {};
      procRes.rows.forEach(p => {
        const raw = (p.categoria_beneficiario || '').trim();
        const key = !raw ? 'Não informado' : CATEGORIA_CONHECIDAS.has(raw) ? raw : 'Outro';
        map[key] = (map[key] || 0) + 1;
      });
      setCategoriaProcessos(CATEGORIA_ORDER.filter(k => map[k]).map(name => ({ name, value: map[name] })));
      setTotalProcessos(procRes.rows.length);
    }

    loadedOnce.current = true;
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { leads, loading, categoriaProcessos, totalProcessos, refetch: fetchAllData };
}
