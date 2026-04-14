import { useMemo } from 'react';
import { Users, Megaphone, Building2, Bot, UserCircle } from 'lucide-react';
import { Lead } from '@/types/leads';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';

interface LeadOriginKPIsProps {
  leads: Lead[];
  stats?: { total_leads?: number; leads_trafego?: number };
}

export function LeadOriginKPIs({ leads, stats }: LeadOriginKPIsProps) {
  const metrics = useMemo(() => {
    const totalLeads       = stats?.total_leads ?? leads.length;
    const leadsTrafego     = stats?.leads_trafego ?? leads.filter(l => l.tipo_origem === 'trafego').length;
    const leadsBR          = totalLeads - leadsTrafego;
    const trafegoPercent   = totalLeads > 0 ? Math.round((leadsTrafego / totalLeads) * 100) : 0;
    const brPercent        = totalLeads > 0 ? Math.round((leadsBR / totalLeads) * 100) : 0;
    return { totalLeads, leadsTrafego, leadsBR, trafegoPercent, brPercent };
  }, [leads, stats]);

  const kpis = [
    {
      id: 'total',
      label: 'Total de Leads',
      value: metrics.totalLeads,
      sub: 'Todos os leads no CRM',
      icon: Users,
      accent: '#3d2b1f',
      accentLight: 'rgba(61,43,31,0.08)',
      badge: null,
      percent: null,
    },
    {
      id: 'trafego',
      label: 'Leads de Tráfego',
      value: metrics.leadsTrafego,
      sub: 'Atendimento automático — ISA',
      icon: Megaphone,
      accent: '#c9a96e',
      accentLight: 'rgba(201,169,110,0.1)',
      badge: { icon: Bot, text: 'ISA', bg: 'bg-emerald-50', color: 'text-emerald-700' },
      percent: metrics.trafegoPercent,
    },
    {
      id: 'br',
      label: 'Leads Bentes & Ramos',
      value: metrics.leadsBR,
      sub: 'Uso interno / histórico',
      icon: Building2,
      accent: '#3d2b1f',
      accentLight: 'rgba(61,43,31,0.08)',
      badge: { icon: UserCircle, text: 'Humano', bg: 'bg-[#c9a96e]/10', color: 'text-[#7c5a2a]' },
      percent: metrics.brPercent,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {kpis.map((kpi, idx) => (
        <div
          key={kpi.id}
          className="relative rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          {/* Accent bar */}
          <div className="h-[3px] w-full" style={{ background: kpi.accent }} />

          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Ícone */}
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: kpi.accentLight }}
              >
                <kpi.icon style={{ width: 20, height: 20, color: kpi.accent }} />
              </div>

              <div className="flex-1 min-w-0">
                {/* Label + badge */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {kpi.label}
                  </p>
                  {kpi.badge && (
                    <span className={cn(
                      'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                      kpi.badge.bg, kpi.badge.color
                    )}>
                      <kpi.badge.icon style={{ width: 11, height: 11 }} />
                      {kpi.badge.text}
                    </span>
                  )}
                </div>

                {/* Valor + % */}
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl font-black text-foreground tracking-tight">
                    <AnimatedCounter value={kpi.value} duration={1200} />
                  </p>
                  {kpi.percent !== null && (
                    <span className="text-sm font-medium text-muted-foreground">({kpi.percent}%)</span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground/70">{kpi.sub}</p>

                {/* Barra de progresso */}
                {kpi.percent !== null && (
                  <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${kpi.percent}%`, background: kpi.accent }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
