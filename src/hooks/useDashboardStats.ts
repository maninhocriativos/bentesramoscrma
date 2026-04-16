import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  total_leads: number;
  total_processos: number;
  total_valor_causa: number;
  leads_hoje: number;
  leads_novos: number;
  leads_em_progresso: number;
  leads_convertidos: number;
  leads_perdidos: number;
  leads_ready: number;
  leads_trafego: number;
  leads_trafego_convertidos: number;
  contratos_trafego_total: number;
  contratos_trafego_manual: number;
  leads_por_origem: Record<string, number>;
  leads_por_status: Record<string, number>;
}

const EMPTY_STATS: DashboardStats = {
  total_leads: 0,
  total_processos: 0,
  total_valor_causa: 0,
  leads_hoje: 0,
  leads_novos: 0,
  leads_em_progresso: 0,
  leads_convertidos: 0,
  leads_perdidos: 0,
  leads_ready: 0,
  leads_trafego: 0,
  leads_trafego_convertidos: 0,
  contratos_trafego_total: 0,
  contratos_trafego_manual: 0,
  leads_por_origem: {},
  leads_por_status: {},
};

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para acessar fetchStats dentro do canal sem recriar o canal
  const fetchStatsRef = useRef<(retry?: number) => Promise<void>>();

  const fetchStats = useCallback(async (retry = 0) => {
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) {
        console.error('[DashboardStats] RPC error:', error.message);
        if (retry < 2) {
          setTimeout(() => fetchStats(retry + 1), 3000);
          return;
        }
      } else if (data) {
        setStats(data as unknown as DashboardStats);
      }
    } catch (err) {
      console.error('[DashboardStats] Unexpected error:', err);
      if (retry < 2) {
        setTimeout(() => fetchStats(retry + 1), 3000);
        return;
      }
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, []);

  // Mantém a ref sempre atualizada
  useEffect(() => {
    fetchStatsRef.current = fetchStats;
  }, [fetchStats]);

  // Carga inicial
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh silencioso a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => fetchStats(), 300_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Realtime — canal criado UMA vez com [], nunca recriado ao trocar de aba
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-stats-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            fetchStatsRef.current?.();
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, []); // ✅ Dependência vazia — canal criado uma vez, nunca recriado

  return { stats, loading, refetch: fetchStats };
}
