import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { DashboardFiltersBar, DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { AlertasWidget } from '@/components/AlertasWidget';
import { useLeads } from '@/hooks/useLeads';
import { useProcessos } from '@/hooks/useProcessos';
import { useAlertas } from '@/hooks/useAlertas';
import { Loader2 } from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { leads, loading: leadsLoading } = useLeads();
  const { processos, loading: processosLoading } = useProcessos();
  const { alertas } = useAlertas(leads, processos);
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'all',
    origem: 'all',
    status: 'all',
  });

  const isLoading = leadsLoading || processosLoading;

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
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
      
      if (filters.origem !== 'all' && lead.origem !== filters.origem) {
        return false;
      }
      
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
            
            <DashboardKPIs leads={filteredLeads} processos={processos} />
            
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <DashboardCharts leads={filteredLeads} />
              </div>
              <div className="lg:col-span-1">
                <AlertasWidget 
                  alertas={alertas} 
                  onAlertClick={handleAlertClick}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
