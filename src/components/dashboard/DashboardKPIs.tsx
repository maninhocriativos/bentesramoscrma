import { Users, Scale, TrendingUp, TrendingDown, Briefcase, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
  
  // Calculate conversion rate
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.title} 
          className="rounded-xl shadow-enterprise border-0 overflow-hidden hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1 bg-card"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
                <kpi.icon className="h-7 w-7 text-gold" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {kpi.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                  {/* Trend indicator */}
                  <div className={`flex items-center text-xs font-medium ${kpi.trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {kpi.trendUp ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    <span>{kpi.trend}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
