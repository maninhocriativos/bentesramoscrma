import { useState, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardFiltersBar, DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { LeadOriginKPIs } from '@/components/dashboard/LeadOriginKPIs';
import { AlertasWidget } from '@/components/AlertasWidget';
import { AgendaPrazosWidget } from '@/components/dashboard/AgendaPrazosWidget';
import { useLeads } from '@/hooks/useLeads';
import { useProcessos } from '@/hooks/useProcessos';
import { useAlertas } from '@/hooks/useAlertas';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Users, DollarSign, Briefcase, Loader2, Zap } from 'lucide-react';
import { FinanceiroResumoWidget } from '@/components/dashboard/FinanceiroResumoWidget';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const DashboardCharts      = lazy(() => import('@/components/dashboard/DashboardCharts').then(m => ({ default: m.DashboardCharts })));
const ConversionMetrics    = lazy(() => import('@/components/dashboard/ConversionMetrics').then(m => ({ default: m.ConversionMetrics })));
const RealtimeLeadsMonitor = lazy(() => import('@/components/dashboard/RealtimeLeadsMonitor').then(m => ({ default: m.RealtimeLeadsMonitor })));
const TeamStatusWidget     = lazy(() => import('@/components/dashboard/TeamStatusWidget').then(m => ({ default: m.TeamStatusWidget })));
const FollowupStatsWidget  = lazy(() => import('@/components/dashboard/FollowupStatsWidget'));

const ChartFallback = () => (
  <div className="rounded-2xl border border-[#c9a96e]/15 bg-card p-6 space-y-4 animate-pulse">
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

// ─── Hero KPI Card ────────────────────────────────────────────────────────────
function HeroCard({
  label, value, sub, icon: Icon, accent, iconBg, iconColor,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; accent: string; iconBg: string; iconColor: string;
}) {
  return (
    <div className={cn(
      'relative rounded-2xl overflow-hidden bg-card',
      'border border-[#c9a96e]/15',
      'shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
      'transition-all duration-300 hover:-translate-y-0.5 group'
    )}>
      {/* Accent bar */}
      <div className={cn('h-[3px] w-full', accent)} />
      <div className="p-4 lg:p-6">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[10px] lg:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
          <div className={cn('h-8 w-8 lg:h-9 lg:w-9 shrink-0 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon className={cn('h-4 w-4', iconColor)} />
          </div>
        </div>
        <p className="text-xl lg:text-2xl xl:text-3xl font-black text-foreground tracking-tight leading-none mb-2 break-all">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { stats, loading: statsLoading } = useDashboardStats();
  const { leads, loading: leadsLoading, fetchLeads } = useLeads();
  const { processos, loading: processosLoading } = useProcessos();
  const { alertas } = useAlertas(leads, processos);
  const navigate = useNavigate();

  const handleRefreshLeads = useCallback(() => fetchLeads(), [fetchLeads]);

  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'all', origem: 'all', status: 'all', search: '',
  });

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!lead.nome?.toLowerCase().includes(s) && !lead.email?.toLowerCase().includes(s)) return false;
      }
      if (filters.period !== 'all') {
        const d = new Date(lead.created_at);
        const now = new Date();
        let start: Date;
        switch (filters.period) {
          case 'today':   start = startOfDay(now); break;
          case 'week':    start = startOfWeek(now, { weekStartsOn: 1 }); break;
          case 'month':   start = startOfMonth(now); break;
          case 'quarter': start = startOfQuarter(now); break;
          case 'year':    start = startOfYear(now); break;
          default:        start = new Date(0);
        }
        if (!isAfter(d, start)) return false;
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

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v);

  const heroReady  = !statsLoading;
  const chartsReady = !leadsLoading && !processosLoading;

  return (
    <AppLayout>
      <AppHeader title="Dashboard" />

      <div className="flex-1 overflow-auto">
        {!heroReady ? (
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
          </div>
        ) : (
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6 page-enter">

            {/* ── Hero KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <HeroCard
                label="Total de Leads"
                value={stats.total_leads.toLocaleString('pt-BR')}
                sub={stats.total_leads > 0
                  ? `${((stats.leads_trafego_convertidos / stats.total_leads) * 100).toFixed(1)}% taxa de conversão`
                  : 'leads no CRM'}
                icon={Users}
                accent="bg-[#3d2b1f]"
                iconBg="bg-[#3d2b1f]/8"
                iconColor="text-[#3d2b1f]"
              />
              <HeroCard
                label="Valor em Causa (Processos)"
                value={formatCurrency(stats.total_valor_causa)}
                sub="processos ativos com valor"
                icon={DollarSign}
                accent="bg-[#c9a96e]"
                iconBg="bg-[#c9a96e]/12"
                iconColor="text-[#b8922a]"
              />
              <HeroCard
                label="Processos Ativos"
                value={stats.total_processos.toLocaleString('pt-BR')}
                sub="processos cadastrados"
                icon={Briefcase}
                accent="bg-emerald-500"
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <HeroCard
                label="Tráfego Hoje"
                value={stats.leads_hoje.toLocaleString('pt-BR')}
                sub={`${stats.leads_trafego.toLocaleString('pt-BR')} total de tráfego`}
                icon={Zap}
                accent="bg-blue-500"
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
            </div>

            {/* ── Filtros ── */}
            <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />

            {/* ── Conteúdo principal ── */}
            {chartsReady ? (
              <>
                {/* Origem + Alertas */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
                  <div className="space-y-6">
                    <LeadOriginKPIs leads={leads} stats={stats} />
                    <DashboardKPIs leads={leads} processos={processos} stats={stats} />
                  </div>
                  <AlertasWidget alertas={alertas} onAlertClick={handleAlertClick} />
                </div>

                {/* Conversão */}
                <Suspense fallback={<ChartFallback />}>
                  <ConversionMetrics leads={leads} stats={stats} />
                </Suspense>

                {/* Gráficos — largura total */}
                <Suspense fallback={<ChartFallback />}>
                  <DashboardCharts leads={filteredLeads} />
                </Suspense>

                {/* Resumo financeiro */}
                <FinanceiroResumoWidget />

                {/* Widgets inferiores — 3 colunas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                  <AgendaPrazosWidget />
                  <Suspense fallback={<ChartFallback />}>
                    <RealtimeLeadsMonitor leads={leads} onRefresh={handleRefreshLeads} />
                  </Suspense>
                  <Suspense fallback={<ChartFallback />}>
                    <TeamStatusWidget />
                  </Suspense>
                </div>

                {/* Follow-up automático — largura total */}
                <div className="pb-4">
                  <Suspense fallback={<ChartFallback />}>
                    <FollowupStatsWidget />
                  </Suspense>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando dados...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default memo(DashboardPage);
