import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { useLeads } from '@/hooks/useLeads';
import { useProcessos } from '@/hooks/useProcessos';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { leads, loading: leadsLoading } = useLeads();
  const { processos, loading: processosLoading } = useProcessos();

  const isLoading = leadsLoading || processosLoading;

  return (
    <AppLayout>
      <AppHeader title="Dashboard" />
      
      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DashboardKPIs leads={leads} processos={processos} />
            <DashboardCharts leads={leads} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
