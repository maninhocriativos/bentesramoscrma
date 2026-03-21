import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardFiltersBar, DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { LeadOriginKPIs } from '@/components/dashboard/LeadOriginKPIs';
import { AlertasWidget } from '@/components/AlertasWidget';
import { useLeads } from '@/hooks/useLeads';
import { useProcessos } from '@/hooks/useProcessos';
import { useAlertas } from '@/hooks/useAlertas';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Lazy-load heavy chart components (Recharts is large)
const DashboardCharts = lazy(() => import('@/components/dashboard/DashboardCharts').then(m => ({ default: m.DashboardCharts })));
const ConversionMetrics = lazy(() => import('@/components/dashboard/ConversionMetrics').then(m => ({ default: m.ConversionMetrics })));
const RealtimeLeadsMonitor = lazy(() => import('@/components/dashboard/RealtimeLeadsMonitor').then(m => ({ default: m.RealtimeLeadsMonitor })));
const TeamStatusWidget = lazy(() => import('@/components/dashboard/TeamStatusWidget').then(m => ({ default: m.TeamStatusWidget })));

const ChartFallback = () => (
  <div className="bg-card rounded-2xl border border-border/40 p-6 space-y-4 animate-pulse">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-28" />
    </div>
    <div className="h-[220px] flex items-end gap-3 px-2">
      {[60, 85, 45, 90, 55, 75, 40, 80, 65, 95, 50, 70].map((h, i) => (
        <div key={i} className="flex-1 bg-muted rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

export default function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { leads, loading: leadsLoading, fetchLeads } = useLeads();
  const { processos, loading: processosLoading } = useProcessos();
  const { alertas } = useAlertas(leads, processos);
  const navigate = useNavigate();

  const handleRefreshLeads = useCallback(() => {
    fetchLeads();
  }, [fetchLeads]);
  
  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'all',
    origem: 'all',
    status: 'all',
    search: '',
  });

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = lead.nome?.toLowerCase().includes(searchLower);
        const emailMatch = lead.email?.toLowerCase().includes(searchLower);
        if (!nameMatch && !emailMatch) return false;
      }

      if (filters.period !== 'all') {
        const leadDate = new Date(lead.created_at);
        const now = new Date();
        let startDate: Date;
        switch (filters.period) {
          case 'today': startDate = startOfDay(now); break;
          case 'week': startDate = startOfWeek(now, { weekStartsOn: 1 }); break;
          case 'month': startDate = startOfMonth(now); break;
          case 'quarter': startDate = startOfQuarter(now); break;
          case 'year': startDate = startOfYear(now); break;
          default: startDate = new Date(0);
        }
        if (!isAfter(leadDate, startDate)) return false;
      }
      
      if (filters.origem !== 'all' && lead.origem !== filters.origem) return false;
      if (filters.status !== 'all' && lead.status !== filters.status) return false;
      return true;
    });
  }, [leads, filters]);

  const handleAlertClick = (alerta: any) => {
    if (alerta.leadId) navigate('/leads');
    else if (alerta.processoId) navigate('/processos');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
    }).format(value);
  };

  // Show hero KPIs immediately from fast RPC, rest loads progressively
  const heroReady = !statsLoading;
  const chartsReady = !leadsLoading && !processosLoading;

  return (
    <AppLayout>
      <AppHeader title="Dashboard" />
      
      <div className="flex-1 overflow-auto">
        {!heroReady ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
            
            {/* ===== TOP: Hero KPIs (instant from RPC) ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl overflow-hidden shadow-soft border border-border/40">
                <div className="bg-primary px-4 py-2">
                  <span className="text-primary-foreground text-xs font-semibold uppercase tracking-wider">
                    Qtd. de Leads
                  </span>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-5xl font-bold text-foreground tracking-tight">{stats.total_leads}</p>
                  <p className="text-xs text-muted-foreground mt-1">leads no CRM</p>
                </div>
              </div>
              
              <div className="bg-card rounded-xl overflow-hidden shadow-soft border border-border/40">
                <div className="bg-[hsl(var(--gold))] px-4 py-2">
                  <span className="text-[hsl(var(--gold-foreground))] text-xs font-semibold uppercase tracking-wider">
                    Faturamento (Valor Causa)
                  </span>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-4xl font-bold text-foreground tracking-tight">{formatCurrency(stats.total_valor_causa)}</p>
                  <p className="text-xs text-muted-foreground mt-1">total em pipeline</p>
                </div>
              </div>
              
              <div className="bg-card rounded-xl overflow-hidden shadow-soft border border-border/40">
                <div className="bg-[hsl(var(--success))] px-4 py-2">
                  <span className="text-[hsl(var(--success-foreground))] text-xs font-semibold uppercase tracking-wider">
                    Processos Ativos
                  </span>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-5xl font-bold text-foreground tracking-tight">{stats.total_processos}</p>
                  <p className="text-xs text-muted-foreground mt-1">processos cadastrados</p>
                </div>
              </div>
            </div>

            {/* ===== FILTERS ===== */}
            <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />

            {/* ===== ROW 2: Origem + KPIs (progressive load) ===== */}
            {chartsReady ? (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
                  <div className="space-y-6">
                    <LeadOriginKPIs leads={leads} />
                    <DashboardKPIs leads={filteredLeads} processos={processos} />
                  </div>
                  <AlertasWidget 
                    alertas={alertas} 
                    onAlertClick={handleAlertClick}
                  />
                </div>

                {/* ===== ROW 3: Conversão (lazy) ===== */}
                <Suspense fallback={<ChartFallback />}>
                  <ConversionMetrics leads={leads} />
                </Suspense>

                {/* ===== ROW 4: Charts + Monitor (lazy) ===== */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
                  <Suspense fallback={<ChartFallback />}>
                    <DashboardCharts leads={filteredLeads} />
                  </Suspense>
                  <div className="space-y-6">
                    <Suspense fallback={<ChartFallback />}>
                      <RealtimeLeadsMonitor leads={leads} onRefresh={handleRefreshLeads} />
                    </Suspense>
                    <Suspense fallback={<ChartFallback />}>
                      <TeamStatusWidget />
                    </Suspense>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando gráficos...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
