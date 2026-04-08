import { useMemo } from 'react';
import { Users, Megaphone, Building2, Bot, UserCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Lead, TipoOrigem } from '@/types/leads';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';

interface LeadOriginKPIsProps {
  leads: Lead[];
  stats?: {
    total_leads?: number;
    leads_trafego?: number;
  };
}

export function LeadOriginKPIs({ leads, stats }: LeadOriginKPIsProps) {
  const metrics = useMemo(() => {
    // Prefer accurate RPC counts when available, fallback to array counting
    const totalLeads = stats?.total_leads ?? leads.length;
    const leadsTrafego = stats?.leads_trafego ?? leads.filter(l => l.tipo_origem === 'trafego').length;
    const leadsBentesRamos = leads.filter(l => 
      l.tipo_origem === 'whatsapp_direto' || l.tipo_origem === 'indefinido' || !l.tipo_origem
    ).length;
    const bentesRamosAdjusted = stats?.total_leads ? totalLeads - leadsTrafego : leadsBentesRamos;
    const trafegoPercent = totalLeads > 0 ? Math.round((leadsTrafego / totalLeads) * 100) : 0;
    const bentesRamosPercent = totalLeads > 0 ? Math.round((bentesRamosAdjusted / totalLeads) * 100) : 0;
    
    return { totalLeads, leadsTrafego, leadsBentesRamos: bentesRamosAdjusted, trafegoPercent, bentesRamosPercent };
  }, [leads, stats]);

  const kpis = [
    {
      id: 'totalLeads',
      title: 'Total de Leads',
      value: metrics.totalLeads,
      icon: Users,
      subtitle: 'Todos os leads no CRM',
      accentColor: 'bg-primary',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      id: 'leadsTrafego',
      title: 'Leads de Tráfego',
      value: metrics.leadsTrafego,
      icon: Megaphone,
      subtitle: 'Atendimento automático — ISA',
      badge: { icon: Bot, text: 'ISA', color: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' },
      accentColor: 'bg-[hsl(var(--gold))]',
      iconBg: 'bg-[hsl(var(--gold))]/10',
      iconColor: 'text-[hsl(var(--gold))]',
      percent: metrics.trafegoPercent,
    },
    {
      id: 'leadsBentesRamos',
      title: 'Leads Bentes & Ramos',
      value: metrics.leadsBentesRamos,
      icon: Building2,
      subtitle: 'Uso interno / histórico',
      badge: { icon: UserCircle, text: 'Humano', color: 'bg-primary/10 text-primary' },
      accentColor: 'bg-primary',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      percent: metrics.bentesRamosPercent,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {kpis.map((kpi, index) => (
        <Card 
          key={kpi.id} 
          className={cn(
            "group relative rounded-2xl border-0 overflow-hidden bg-card",
            "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
            "transition-all duration-300 ease-out",
            "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5",
          )}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          {/* Top accent */}
          <div className={cn("h-1 w-full", kpi.accentColor)} />
          
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                "transition-all duration-300",
                kpi.iconBg
              )}>
                <kpi.icon className={cn("h-5 w-5", kpi.iconColor)} />
              </div>
              
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {kpi.title}
                  </p>
                  {kpi.badge && (
                    <span className={cn(
                      "flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
                      kpi.badge.color
                    )}>
                      <kpi.badge.icon className="h-3 w-3" />
                      {kpi.badge.text}
                    </span>
                  )}
                </div>
                
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground tracking-tight">
                    <AnimatedCounter value={kpi.value} duration={1200} />
                  </p>
                  {kpi.percent !== undefined && (
                    <span className="text-sm text-muted-foreground">({kpi.percent}%)</span>
                  )}
                </div>
                
                <p className="text-[11px] text-muted-foreground/70">{kpi.subtitle}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
