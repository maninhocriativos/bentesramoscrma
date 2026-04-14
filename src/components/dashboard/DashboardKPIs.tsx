import { useState, useEffect } from 'react';
import { Users, Scale, TrendingUp, Briefcase, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';
import { DashboardStats } from '@/hooks/useDashboardStats';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';

interface DashboardKPIsProps {
  leads: Lead[];
  processos: Processo[];
  stats: DashboardStats;
}

export function DashboardKPIs({ stats }: DashboardKPIsProps) {
  const [recentChange, setRecentChange] = useState<string | null>(null);
  const [prevTotal, setPrevTotal] = useState(0);

  useEffect(() => {
    if (prevTotal !== 0 && stats.total_leads !== prevTotal) {
      setRecentChange('totalLeads');
      setTimeout(() => setRecentChange(null), 2000);
    }
    setPrevTotal(stats.total_leads);
  }, [stats.total_leads]);

  const taxaConversao = stats.leads_trafego > 0
    ? Math.round((stats.contratos_trafego_total / stats.leads_trafego) * 100)
    : 0;

  const kpis = [
    {
      id: 'totalLeads',
      title: 'Total de Leads',
      value: stats.total_leads,
      icon: Users,
      trend: stats.leads_hoje > 0 ? `+${stats.leads_hoje} hoje` : '+0 hoje',
      trendUp: stats.leads_hoje > 0,
      description: `${stats.leads_novos} novos aguardando`,
      accent: '#3d2b1f', accentLight: 'rgba(61,43,31,0.08)', accentBar: '#3d2b1f',
    },
    {
      id: 'emProgresso',
      title: 'Em Progresso',
      value: stats.leads_em_progresso,
      icon: TrendingUp,
      trend: stats.leads_em_progresso > 0 ? 'Ativos' : 'Nenhum',
      trendUp: stats.leads_em_progresso > 0,
      description: 'Triagem a Contrato',
      accent: '#c9a96e', accentLight: 'rgba(201,169,110,0.1)', accentBar: '#c9a96e',
    },
    {
      id: 'taxaConversao',
      title: 'Taxa de Conversão',
      value: taxaConversao,
      isPercentage: true,
      icon: Scale,
      trend: taxaConversao >= 50 ? 'Excelente' : taxaConversao >= 20 ? 'Bom' : 'Em progresso',
      trendUp: taxaConversao >= 20,
      description: 'Contratos vs Leads de Tráfego',
      accent: '#c9a96e', accentLight: 'rgba(201,169,110,0.1)', accentBar: '#c9a96e',
    },
    {
      id: 'contratosTrafego',
      title: 'Contratos (Tráfego)',
      value: stats.contratos_trafego_total,
      icon: Briefcase,
      trend: `de ${stats.leads_trafego} leads`,
      trendUp: stats.contratos_trafego_total > 0,
      description: stats.contratos_trafego_manual > 0
        ? `+${stats.contratos_trafego_manual} inseridos manualmente`
        : `${stats.leads_convertidos} total geral`,
      accent: '#16a34a', accentLight: 'rgba(22,163,74,0.08)', accentBar: '#16a34a',
      badge: stats.contratos_trafego_manual > 0
        ? { text: `+${stats.contratos_trafego_manual} manual`, color: '#c9a96e' }
        : null,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-muted-foreground">Tempo real</span>
        {recentChange && (
          <span className="text-xs text-emerald-600 flex items-center gap-1 ml-auto">
            <Activity style={{ width: 12, height: 12 }} />
            Dados atualizados
          </span>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <div
            key={kpi.id}
            className={cn(
              'relative rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15',
              'shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
              'transition-all duration-300 hover:-translate-y-0.5',
              recentChange === kpi.id && 'ring-2 ring-emerald-400/40'
            )}
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="h-[3px] w-full" style={{ background: kpi.accentBar }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: kpi.accentLight }}>
                  <kpi.icon style={{ width: 18, height: 18, color: kpi.accent }} />
                </div>
                <div className={cn(
                  'flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full',
                  kpi.trendUp ? 'text-emerald-700 bg-emerald-50' : 'text-muted-foreground bg-muted/50'
                )}>
                  {kpi.trendUp ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
                  {kpi.trend}
                </div>
              </div>
              <p className="text-3xl font-black text-foreground tracking-tight mb-1">
                <AnimatedCounter value={kpi.value} suffix={kpi.isPercentage ? '%' : ''} duration={1200} />
              </p>
              <div className="mt-2 pt-2 border-t border-[#c9a96e]/8">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{kpi.title}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[11px] text-muted-foreground/60">{kpi.description}</p>
                  {(kpi as any).badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: 'rgba(201,169,110,0.15)', color: (kpi as any).badge.color }}>
                      {(kpi as any).badge.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
