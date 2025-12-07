import { Users, Scale, TrendingUp, Briefcase, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
  const leadsPerdidos = leads.filter(l => l.status === 'Perdido').length;
  const processosAtivos = processos.filter(p => p.status === 'Em Andamento').length;
  
  const leadsFinalizados = leadsGanhos + leadsPerdidos;
  const taxaConversao = leadsFinalizados > 0 ? Math.round((leadsGanhos / leadsFinalizados) * 100) : 0;

  const kpis = [
    {
      title: 'Total de Leads',
      value: totalLeads,
      icon: Users,
      trend: '+12%',
      trendUp: true,
      description: 'Leads captados',
    },
    {
      title: 'Taxa de Conversão',
      value: `${taxaConversao}%`,
      icon: TrendingUp,
      trend: taxaConversao >= 50 ? '+5%' : '-3%',
      trendUp: taxaConversao >= 50,
      description: 'Leads convertidos',
    },
    {
      title: 'Leads Ganhos',
      value: leadsGanhos,
      icon: Scale,
      trend: leadsGanhos > 0 ? '+8%' : '0%',
      trendUp: leadsGanhos > 0,
      description: 'Contratos fechados',
    },
    {
      title: 'Processos Ativos',
      value: processosAtivos,
      icon: Briefcase,
      trend: '+15%',
      trendUp: true,
      description: `de ${totalProcessos} total`,
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.title} 
          className="rounded-xl shadow-soft border border-border/50 overflow-hidden hover:shadow-enterprise transition-all duration-200 hover:-translate-y-0.5 bg-card"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon - Compact */}
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center shrink-0">
                <kpi.icon className="h-5 w-5 text-gold" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5 truncate">
                  {kpi.title}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <div className={`flex items-center text-xs font-medium ${kpi.trendUp ? 'text-success' : 'text-destructive'}`}>
                    {kpi.trendUp ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>{kpi.trend}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{kpi.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
