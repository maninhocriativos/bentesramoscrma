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
import { TeamStatusWidget } from '@/components/dashboard/TeamStatusWidget';
import { useLeads } from '@/hooks/useLeads';
import { useProcessos } from '@/hooks/useProcessos';
import { useAlertas } from '@/hooks/useAlertas';
import { Loader2 } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
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

  const totalValorCausa = useMemo(() => {
    return leads.reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);
  }, [leads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
    }).format(value);
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
          <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
            
            {/* ===== TOP: Hero KPIs (big numbers like the reference) ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Qtd. de Leads */}
              <div className="bg-card rounded-xl overflow-hidden shadow-soft border border-border/40">
                <div className="bg-primary px-4 py-2">
                  <span className="text-primary-foreground text-xs font-semibold uppercase tracking-wider">
                    Qtd. de Leads
                  </span>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-5xl font-bold text-foreground tracking-tight">{leads.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">leads no CRM</p>
                </div>
              </div>
              
              {/* Faturamento */}
              <div className="bg-card rounded-xl overflow-hidden shadow-soft border border-border/40">
                <div className="bg-[hsl(var(--gold))] px-4 py-2">
                  <span className="text-[hsl(var(--gold-foreground))] text-xs font-semibold uppercase tracking-wider">
                    Faturamento (Valor Causa)
                  </span>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-4xl font-bold text-foreground tracking-tight">{formatCurrency(totalValorCausa)}</p>
                  <p className="text-xs text-muted-foreground mt-1">total em pipeline</p>
                </div>
              </div>
              
              {/* Processos */}
              <div className="bg-card rounded-xl overflow-hidden shadow-soft border border-border/40">
                <div className="bg-[hsl(var(--success))] px-4 py-2">
                  <span className="text-[hsl(var(--success-foreground))] text-xs font-semibold uppercase tracking-wider">
                    Processos Ativos
                  </span>
                </div>
                <div className="px-6 py-5 text-center">
                  <p className="text-5xl font-bold text-foreground tracking-tight">{processos.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">processos cadastrados</p>
                </div>
              </div>
            </div>

            {/* ===== FILTERS ===== */}
            <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />

            {/* ===== ROW 2: Origem + KPIs Métricas ===== */}
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

            {/* ===== ROW 3: Conversão ===== */}
            <ConversionMetrics leads={leads} />

            {/* ===== ROW 4: Charts + Monitor ===== */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
              <DashboardCharts leads={filteredLeads} />
              <div className="space-y-6">
                <RealtimeLeadsMonitor leads={leads} onRefresh={handleRefreshLeads} />
                <TeamStatusWidget />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
