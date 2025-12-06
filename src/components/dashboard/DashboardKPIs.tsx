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
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total de Processos',
      value: totalProcessos,
      icon: Scale,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent/20',
    },
    {
      title: 'Leads Ganhos',
      value: leadsGanhos,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Processos Ativos',
      value: processosAtivos,
      icon: Briefcase,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className="rounded-xl shadow-soft hover:shadow-soft-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-3xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
