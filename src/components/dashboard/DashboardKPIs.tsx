import { Users, Scale, TrendingUp, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';

interface DashboardKPIsProps {
  leads: Lead[];
  processos: Processo[];
}

export function DashboardKPIs({ leads, processos }: DashboardKPIsProps) {
  const totalLeads = leads.length;
  const totalProcessos = processos.length;
  const leadsGanhos = leads.filter(l => l.status === 'Ganho').length;
  const processosAtivos = processos.filter(p => p.status === 'Em Andamento').length;

  const kpis = [
    {
      title: 'Total de Leads',
      value: totalLeads,
      icon: Users,
      color: 'text-primary-foreground',
      bgColor: 'bg-primary',
      borderColor: 'border-primary/20',
    },
    {
      title: 'Total de Processos',
      value: totalProcessos,
      icon: Scale,
      color: 'text-gold-foreground',
      bgColor: 'bg-gold',
      borderColor: 'border-gold/30',
    },
    {
      title: 'Leads Ganhos',
      value: leadsGanhos,
      icon: TrendingUp,
      color: 'text-emerald-50',
      bgColor: 'bg-emerald-600',
      borderColor: 'border-emerald-300',
    },
    {
      title: 'Processos Ativos',
      value: processosAtivos,
      icon: Briefcase,
      color: 'text-blue-50',
      bgColor: 'bg-blue-600',
      borderColor: 'border-blue-300',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.title} 
          className="rounded-xl shadow-enterprise border-0 overflow-hidden hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className={`w-16 flex items-center justify-center ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
              <div className="flex-1 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.title}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{kpi.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
