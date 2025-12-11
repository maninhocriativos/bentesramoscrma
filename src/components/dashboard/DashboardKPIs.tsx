import { Users, Scale, TrendingUp, Briefcase, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';

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
      gradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
      iconBg: 'bg-blue-500/15 group-hover:bg-blue-500/25',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Taxa de Conversão',
      value: taxaConversao,
      isPercentage: true,
      icon: TrendingUp,
      trend: taxaConversao >= 50 ? '+5%' : '-3%',
      trendUp: taxaConversao >= 50,
      description: 'Leads convertidos',
      gradient: 'from-gold/20 via-gold/10 to-transparent',
      iconBg: 'bg-gold/15 group-hover:bg-gold/25',
      iconColor: 'text-gold',
    },
    {
      title: 'Leads Ganhos',
      value: leadsGanhos,
      icon: Scale,
      trend: leadsGanhos > 0 ? '+8%' : '0%',
      trendUp: leadsGanhos > 0,
      description: 'Contratos fechados',
      gradient: 'from-success/20 via-success/10 to-transparent',
      iconBg: 'bg-success/15 group-hover:bg-success/25',
      iconColor: 'text-success',
    },
    {
      title: 'Processos Ativos',
      value: processosAtivos,
      icon: Briefcase,
      trend: '+15%',
      trendUp: true,
      description: `de ${totalProcessos} total`,
      gradient: 'from-purple-500/20 via-purple-400/10 to-transparent',
      iconBg: 'bg-purple-500/15 group-hover:bg-purple-500/25',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-children">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.title} 
          className={cn(
            "group relative rounded-xl border border-border/50 overflow-hidden bg-card",
            "transition-all duration-300 ease-out",
            "hover:shadow-card-hover hover:-translate-y-1 hover:border-border"
          )}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {/* Gradient overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            kpi.gradient
          )} />
          
          <CardContent className="relative p-4 sm:p-5">
            <div className="flex items-start gap-4">
              {/* Icon with glow effect */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                "transition-all duration-300",
                kpi.iconBg
              )}>
                <kpi.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", kpi.iconColor)} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                  {kpi.title}
                </p>
                
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground tracking-tight">
                    <AnimatedCounter 
                      value={kpi.value} 
                      suffix={kpi.isPercentage ? '%' : ''}
                      duration={1200}
                    />
                  </p>
                  
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                    kpi.trendUp 
                      ? 'text-success bg-success/10' 
                      : 'text-destructive bg-destructive/10'
                  )}>
                    {kpi.trendUp ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>{kpi.trend}</span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 opacity-50" />
                  {kpi.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
