import { useState, useEffect, useCallback } from 'react';
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
  leads_por_origem: {},
  leads_por_status: {},
};

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (!error && data) {
      setStats(data as unknown as DashboardStats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      setLoading(false);
      return;
    }

    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchStats, 300_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Realtime: refresh stats when leads change
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-stats-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        () => {
          // Debounce: wait 2s after last change to avoid rapid re-fetches
          clearTimeout((channel as any)._debounceTimer);
          (channel as any)._debounceTimer = setTimeout(fetchStats, 2000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout((channel as any)._debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
