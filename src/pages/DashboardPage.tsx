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
import { Loader2 } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { leads, loading: leadsLoading, fetchLeads } = useLeads();
  const { processos, loading: processosLoading } = useProcessos();
  const { alertas } = useAlertas(leads, processos);
  const navigate = useNavigate();

  // Callback for manual refresh from monitor
  const handleRefreshLeads = useCallback(() => {
    console.log('🔄 Dashboard: Solicitando atualização manual dos leads');
    fetchLeads();
  }, [fetchLeads]);
  
  // Debug: log when leads change
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
      // Search filter - by name or email
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const nameMatch = lead.nome?.toLowerCase().includes(searchLower);
        const emailMatch = lead.email?.toLowerCase().includes(searchLower);
        if (!nameMatch && !emailMatch) {
          return false;
        }
      }

      // Period filter
      if (filters.period !== 'all') {
        const leadDate = new Date(lead.created_at);
        const now = new Date();
        let startDate: Date;
        
        switch (filters.period) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case 'week':
            startDate = startOfWeek(now, { weekStartsOn: 1 });
            break;
          case 'month':
            startDate = startOfMonth(now);
            break;
          case 'quarter':
            startDate = startOfQuarter(now);
            break;
          case 'year':
            startDate = startOfYear(now);
            break;
          default:
            startDate = new Date(0);
        }
        
        if (!isAfter(leadDate, startDate)) {
          return false;
        }
      }
      
      // Origem filter
      if (filters.origem !== 'all' && lead.origem !== filters.origem) {
        return false;
      }
      
      // Status filter
      if (filters.status !== 'all' && lead.status !== filters.status) {
        return false;
      }
      
      return true;
    });
  }, [leads, filters]);

  const handleAlertClick = (alerta: any) => {
    if (alerta.leadId) {
      navigate('/leads');
    } else if (alerta.processoId) {
      navigate('/processos');
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Dashboard" />
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 space-y-4 animate-fade-in overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} />
            
            {/* Lead Origin KPIs - Segmentação por Origem */}
            <LeadOriginKPIs leads={leads} />
            
            <DashboardKPIs leads={filteredLeads} processos={processos} />

            <ConversionMetrics leads={leads} />

            {/* Real-time Leads Monitor */}
            <RealtimeLeadsMonitor leads={leads} onRefresh={handleRefreshLeads} />

            <div className="grid grid-cols-1 gap-4">
              <AlertasWidget 
                alertas={alertas} 
                onAlertClick={handleAlertClick}
              />
            </div>
            
            <DashboardCharts leads={filteredLeads} />
          </>
        )}
      </div>
    </AppLayout>
  );
}