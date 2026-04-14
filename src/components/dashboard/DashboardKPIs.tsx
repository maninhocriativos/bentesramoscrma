import { useState, useEffect, useMemo } from 'react';
import { Users, Scale, TrendingUp, Briefcase, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';
import { LEAD_STATE_LABELS, LeadState } from '@/types/stateMachine';

interface DashboardKPIsProps {
  leads: Lead[];
  processos: Processo[];
}

let previousValues: { [key: string]: number } = {};

const ESTADOS_ATIVOS: LeadState[]     = ['TRIAGE', 'CLASSIFIED', 'DATA_CAPTURE', 'CONTRACT_SENT'];
const ESTADOS_CONVERTIDOS: LeadState[] = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'];

export function DashboardKPIs({ leads, processos }: DashboardKPIsProps) {
  const [recentChange, setRecentChange] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const totalLeads       = leads.length;
    const leadsEmProgresso = leads.filter(l => l.lead_state && ESTADOS_ATIVOS.includes(l.lead_state as LeadState)).length;
    const today            = new Date(); today.setHours(0,0,0,0);
    const leadsHoje        = leads.filter(l => new Date(l.created_at) >= today).length;
    const leadsNovos       = leads.filter(l => !l.lead_state || l.lead_state === 'NEW').length;

    const trafficLeads     = leads.filter(l => l.tipo_origem === 'trafego');
    const trafficTotal     = trafficLeads.length;

    const countContracts = (arr: Lead[]) =>
      arr.reduce((sum, l) => {
        const converted = l.lead_state && ESTADOS_CONVERTIDOS.includes(l.lead_state as LeadState);
        return sum + (converted ? 1 : 0) + (l.contratos_adicionais || 0);
      }, 0);

    const totalTrafficContratos = countContracts(trafficLeads);
    const totalContratos        = countContracts(leads);
    const taxaConversao         = trafficTotal > 0 ? Math.round((totalTrafficContratos / trafficTotal) * 100) : 0;

    return { totalLeads, leadsEmProgresso, leadsHoje, leadsNovos, taxaConversao, totalTrafficContratos, trafficTotal, totalContratos };
  }, [leads]);

  useEffect(() => {
    const cur = { totalLeads: metrics.totalLeads, leadsEmProgresso: metrics.leadsEmProgresso };
    Object.keys(cur).forEach(k => {
      if (previousValues[k] !== undefined && previousValues[k] !== (cur as any)[k]) {
        setRecentChange(k);
        setTimeout(() => setRecentChange(null), 2000);
      }
    });
    previousValues = { ...cur };
  }, [metrics]);

  const kpis = [
    {
      id: 'totalLeads',
      title: 'Total de Leads',
      value: metrics.totalLeads,
      icon: Users,
      trend: metrics.leadsHoje > 0 ? `+${metrics.leadsHoje} hoje` : '+0 hoje',
      trendUp: metrics.leadsHoje > 0,
      description: `${metrics.leadsNovos} novos aguardando`,
      accent: '#3d2b1f',
      accentLight: 'rgba(61,43,31,0.08)',
      accentBar: '#3d2b1f',
    },
    {
      id: 'leadsEmProgresso',
      title: 'Em Progresso',
      value: metrics.leadsEmProgresso,
      icon: TrendingUp,
      trend: metrics.leadsEmProgresso > 0 ? 'Ativos' : 'Nenhum',
      trendUp: metrics.leadsEmProgresso > 0,
      description: 'Triagem a Contrato',
      accent: '#c9a96e',
      accentLight: 'rgba(201,169,110,0.1)',
      accentBar: '#c9a96e',
    },
    {
      id: 'taxaConversao',
      title: 'Taxa de Conversão',
      value: metrics.taxaConversao,
      isPercentage: true,
      icon: Scale,
      trend: metrics.taxaConversao >= 50 ? 'Excelente' : metrics.taxaConversao >= 20 ? 'Bom' : 'Em progresso',
      trendUp: metrics.taxaConversao >= 20,
      description: 'Contratos vs Leads de Tráfego',
      accent: '#c9a96e',
      accentLight: 'rgba(201,169,110,0.1)',
      accentBar: '#c9a96e',
    },
    {
      id: 'contratos',
      title: 'Contratos (Tráfego)',
      value: metrics.totalTrafficContratos,
      icon: Briefcase,
      trend: metrics.trafficTotal > 0 ? `de ${metrics.trafficTotal} leads` : 'Tráfego',
      trendUp: metrics.totalTrafficContratos > 0,
      description: `${metrics.totalContratos} total geral`,
      accent: '#16a34a',
      accentLight: 'rgba(22,163,74,0.08)',
      accentBar: '#16a34a',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Indicador tempo real */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-muted-foreground">Tempo real</span>
        {recentChange && (
          <span className="text-xs text-emerald-600 animate-fade-in flex items-center gap-1 ml-auto">
            <Activity className="w-3 h-3" />
            Dados atualizados
          </span>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <div
            key={kpi.id}
            className={cn(
              'relative rounded-2xl overflow-hidden bg-card',
              'border border-[#c9a96e]/15',
              'shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
              'transition-all duration-300 hover:-translate-y-0.5',
              recentChange === kpi.id && 'ring-2 ring-emerald-400/40'
            )}
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            {/* Accent bar */}
            <div className="h-[3px] w-full" style={{ background: kpi.accentBar }} />

            <div className="p-5">
              {/* Ícone + badge trend */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background: kpi.accentLight }}
                >
                  <kpi.icon style={{ width: 18, height: 18, color: kpi.accent }} />
                </div>
                <div className={cn(
                  'flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full',
                  kpi.trendUp
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-muted-foreground bg-muted/50'
                )}>
                  {kpi.trendUp
                    ? <ArrowUpRight style={{ width: 12, height: 12 }} />
                    : <ArrowDownRight style={{ width: 12, height: 12 }} />
                  }
                  {kpi.trend}
                </div>
              </div>

              {/* Valor */}
              <p className="text-3xl font-black text-foreground tracking-tight mb-1">
                <AnimatedCounter
                  value={kpi.value}
                  suffix={kpi.isPercentage ? '%' : ''}
                  duration={1200}
                />
              </p>

              {/* Título + descrição */}
              <div className="mt-2 pt-2 border-t border-[#c9a96e]/8">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                  {kpi.title}
                </p>
                <p className="text-[11px] text-muted-foreground/60">{kpi.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
