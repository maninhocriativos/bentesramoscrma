import { Users, UserCheck, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Lead } from '@/types/leads';

interface KPICardsProps {
  leads: Lead[];
}

export function KPICards({ leads }: KPICardsProps) {
  const totalLeads = leads.length;
  const emAtendimento = leads.filter(l => l.status === 'Em Atendimento').length;
  const ganhos = leads.filter(l => l.status === 'Ganho' || l.status === 'Contrato Assinado').length;
  const taxaConversao = totalLeads > 0 ? ((ganhos / totalLeads) * 100).toFixed(1) : '0';

  const kpis = [
    {
      title: 'Total de Leads',
      value: totalLeads,
      icon: Users,
      color: 'text-stage-all',
      bgColor: 'bg-stage-all-bg',
    },
    {
      title: 'Em Atendimento',
      value: emAtendimento,
      icon: UserCheck,
      color: 'text-stage-atendimento',
      bgColor: 'bg-stage-atendimento-bg',
    },
    {
      title: 'Taxa de Conversão',
      value: `${taxaConversao}%`,
      icon: TrendingUp,
      color: 'text-stage-ganho',
      bgColor: 'bg-stage-ganho-bg',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {kpis.map((kpi) => (
        <Card 
          key={kpi.title} 
          className="rounded-xl shadow-soft hover:shadow-soft-lg transition-shadow duration-300 animate-fade-in"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{kpi.title}</p>
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
