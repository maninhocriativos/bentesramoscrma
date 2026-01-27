import { useMemo } from 'react';
import { Users, Megaphone, Building2, Bot, UserCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Lead, TipoOrigem } from '@/types/leads';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';

interface LeadOriginKPIsProps {
  leads: Lead[];
}

export function LeadOriginKPIs({ leads }: LeadOriginKPIsProps) {
  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    
    // Leads de Tráfego (marketing campaigns)
    const leadsTrafego = leads.filter(l => l.tipo_origem === 'trafego').length;
    
    // Leads Bentes & Ramos (whatsapp_direto + indefinido + null)
    const leadsBentesRamos = leads.filter(l => 
      l.tipo_origem === 'whatsapp_direto' || 
      l.tipo_origem === 'indefinido' || 
      !l.tipo_origem
    ).length;
    
    // Percentage calculations
    const trafegoPercent = totalLeads > 0 ? Math.round((leadsTrafego / totalLeads) * 100) : 0;
    const bentesRamosPercent = totalLeads > 0 ? Math.round((leadsBentesRamos / totalLeads) * 100) : 0;
    
    return {
      totalLeads,
      leadsTrafego,
      leadsBentesRamos,
      trafegoPercent,
      bentesRamosPercent,
    };
  }, [leads]);

  const kpis = [
    {
      id: 'totalLeads',
      title: 'Total de Leads',
      value: metrics.totalLeads,
      icon: Users,
      subtitle: 'Todos os leads no CRM',
      gradient: 'from-slate-500/20 via-slate-400/10 to-transparent',
      iconBg: 'bg-slate-500/15 group-hover:bg-slate-500/25',
      iconColor: 'text-slate-600',
      borderColor: 'border-l-slate-500',
    },
    {
      id: 'leadsTrafego',
      title: 'Leads de Tráfego',
      value: metrics.leadsTrafego,
      icon: Megaphone,
      subtitle: 'Atendimento automático — ISA',
      badge: { icon: Bot, text: 'ISA', color: 'bg-success/10 text-success' },
      gradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
      iconBg: 'bg-blue-500/15 group-hover:bg-blue-500/25',
      iconColor: 'text-blue-600',
      borderColor: 'border-l-blue-500',
      percent: metrics.trafegoPercent,
    },
    {
      id: 'leadsBentesRamos',
      title: 'Leads Bentes & Ramos',
      value: metrics.leadsBentesRamos,
      icon: Building2,
      subtitle: 'Uso interno / histórico',
      badge: { icon: UserCircle, text: 'Humano', color: 'bg-amber-500/10 text-amber-600' },
      gradient: 'from-amber-500/20 via-amber-400/10 to-transparent',
      iconBg: 'bg-amber-500/15 group-hover:bg-amber-500/25',
      iconColor: 'text-amber-600',
      borderColor: 'border-l-amber-500',
      percent: metrics.bentesRamosPercent,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.id} 
          className={cn(
            "group relative rounded-xl border border-border/50 overflow-hidden bg-card",
            "transition-all duration-300 ease-out border-l-4",
            "hover:shadow-card-hover hover:-translate-y-1 hover:border-border",
            kpi.borderColor
          )}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {/* Gradient overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            kpi.gradient
          )} />
          
          <CardContent className="relative p-5">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                "transition-all duration-300",
                kpi.iconBg
              )}>
                <kpi.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", kpi.iconColor)} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {kpi.title}
                  </p>
                  {kpi.badge && (
                    <span className={cn(
                      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                      kpi.badge.color
                    )}>
                      <kpi.badge.icon className="h-3 w-3" />
                      {kpi.badge.text}
                    </span>
                  )}
                </div>
                
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground tracking-tight">
                    <AnimatedCounter 
                      value={kpi.value} 
                      duration={1200}
                    />
                  </p>
                  {kpi.percent !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      ({kpi.percent}%)
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {kpi.subtitle}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
