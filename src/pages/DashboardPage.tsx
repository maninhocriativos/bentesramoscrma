import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { DashboardFiltersBar, DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { ConversionMetrics } from '@/components/dashboard/ConversionMetrics';
import { RealtimeLeadsMonitor } from '@/components/dashboard/RealtimeLeadsMonitor';
import { LeadOriginKPIs } from '@/components/dashboard/LeadOriginKPIs';
import { AlertasWidget } from '@/components/AlertasWidget';
import { useLeads } from '@/hooks/useLeads';
import { useProcessos } from '@/hooks/useProcessos';
import { useAlertas } from '@/hooks/useAlertas';
import { Loader2, LayoutDashboard } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { leads, loading: leadsLoading, fetchLeads } = useLeads();
  const { processos, loading: processosLoading } = useProcessos();
  const { alertas } = useAlertas(leads, processos);
  const navigate = useNavigate();

  const handleRefreshLeads = useCallback(() => {
    console.log('🔄 Dashboard: Solicitando atualização manual dos leads');
    fetchLeads();
  }, [fetchLeads]);
  
  useEffect(() => {
    console.log('📊 Dashboard: leads atualizados, total:', leads.length);
  }, [leads]);

  useEffect(() => {
    console.log('📊 Dashboard: processos atualizados, total:', processos.length);
  }, [processos]);
  
  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'all',
    origem: 'all',
    status: 'all',
    search: '',
  });

  const isLoading = leadsLoading || processosLoading;

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

  return (
    <AppLayout>
      <AppHeader title="Dashboard" />
      
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-8 animate-fade-in">
            {/* Header Section with greeting */}
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                Visão Geral
              </h2>
              <p className="text-sm text-muted-foreground">
                Acompanhe o desempenho do escritório em tempo real
              </p>
            </div>

            {/* Filters */}
            <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />

            {/* Section: Origem */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                Segmentação por Origem
              </h3>
              <LeadOriginKPIs leads={leads} />
            </section>
            
            {/* Section: KPIs + Alertas side by side on desktop */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                Métricas Principais
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-stretch">
                <DashboardKPIs leads={filteredLeads} processos={processos} />
                <div className="h-full">
                  <AlertasWidget 
                    alertas={alertas} 
                    onAlertClick={handleAlertClick}
                  />
                </div>
              </div>
            </section>

            {/* Section: Conversion */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                Conversão & Performance
              </h3>
              <ConversionMetrics leads={leads} />
            </section>

            {/* Section: Monitor */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                Monitor em Tempo Real
              </h3>
              <RealtimeLeadsMonitor leads={leads} onRefresh={handleRefreshLeads} />
            </section>

            {/* Section: Charts */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                Análise Visual
              </h3>
              <DashboardCharts leads={filteredLeads} />
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
