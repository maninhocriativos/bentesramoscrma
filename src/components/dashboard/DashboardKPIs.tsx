import { useState, useEffect, useMemo } from 'react';
import { Users, Scale, TrendingUp, Briefcase, ArrowUpRight, ArrowDownRight, Sparkles, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

const ESTADOS_ATIVOS: LeadState[] = ['TRIAGE', 'CLASSIFIED', 'DATA_CAPTURE', 'CONTRACT_SENT'];
const ESTADOS_CONVERTIDOS: LeadState[] = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'];

export function DashboardKPIs({ leads, processos }: DashboardKPIsProps) {
  const [recentChange, setRecentChange] = useState<string | null>(null);
  
  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const leadsEmProgresso = leads.filter(l => 
      l.lead_state && ESTADOS_ATIVOS.includes(l.lead_state as LeadState)
    ).length;
    const leadsConvertidos = leads.filter(l => 
      l.lead_state && ESTADOS_CONVERTIDOS.includes(l.lead_state as LeadState)
    ).length;
    const leadsPerdidos = leads.filter(l => l.is_lost === true).length;
    const leadsNovos = leads.filter(l => !l.lead_state || l.lead_state === 'NEW').length;
    const leadsReady = leads.filter(l => l.lead_state === 'READY_FOR_LAWYER').length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadsHoje = leads.filter(l => new Date(l.created_at) >= today).length;
    const leadsFinalizados = leadsConvertidos + leadsPerdidos;
    const taxaConversao = leadsFinalizados > 0 
      ? Math.round((leadsConvertidos / leadsFinalizados) * 100) 
      : 0;
    
    return { totalLeads, leadsEmProgresso, leadsConvertidos, leadsPerdidos, leadsNovos, leadsReady, leadsHoje, taxaConversao };
  }, [leads]);

  useEffect(() => {
    const currentValues: { [key: string]: number } = {
      totalLeads: metrics.totalLeads,
      leadsEmProgresso: metrics.leadsEmProgresso,
      leadsConvertidos: metrics.leadsConvertidos
    };

    Object.keys(currentValues).forEach(key => {
      if (previousValues[key] !== undefined && previousValues[key] !== currentValues[key]) {
        setRecentChange(key);
        setTimeout(() => setRecentChange(null), 2000);
      }
    });

    previousValues = { ...currentValues };
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
      accentColor: 'bg-blue-500',
    },
    {
      id: 'leadsEmProgresso',
      title: 'Em Progresso',
      value: metrics.leadsEmProgresso,
      icon: TrendingUp,
      trend: metrics.leadsEmProgresso > 0 ? 'Ativos' : 'Nenhum',
      trendUp: metrics.leadsEmProgresso > 0,
      description: 'Triagem a Contrato',
      accentColor: 'bg-amber-500',
    },
    {
      id: 'taxaConversao',
      title: 'Taxa de Conversão',
      value: metrics.taxaConversao,
      isPercentage: true,
      icon: Scale,
      trend: metrics.taxaConversao >= 50 ? 'Excelente' : 'Em progresso',
      trendUp: metrics.taxaConversao >= 50,
      description: 'Convertidos vs Perdidos',
      accentColor: 'bg-[hsl(var(--gold))]',
    },
    {
      id: 'leadsConvertidos',
      title: 'Convertidos',
      value: metrics.leadsConvertidos,
      icon: Briefcase,
      trend: metrics.leadsReady > 0 ? `${metrics.leadsReady} prontos` : 'Contratos',
      trendUp: metrics.leadsConvertidos > 0,
      description: 'Contratos assinados+',
      accentColor: 'bg-[hsl(var(--success))]',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Real-time indicator */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
        <span className="text-xs text-muted-foreground">Tempo real</span>
        {recentChange && (
          <span className="text-xs text-[hsl(var(--success))] animate-fade-in flex items-center gap-1 ml-auto">
            <Activity className="w-3 h-3" />
            Dados atualizados
          </span>
        )}
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 items-start">
        {kpis.map((kpi, index) => (
          <Card 
            key={kpi.title} 
            className={cn(
              "group relative rounded-2xl border-0 overflow-hidden bg-card",
              "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
              "transition-all duration-300 ease-out",
              "hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-0.5",
              recentChange === kpi.id && "ring-2 ring-[hsl(var(--success))]/40"
            )}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Top accent bar */}
            <div className={cn("h-1 w-full", kpi.accentColor)} />
            
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  "bg-muted/60 group-hover:bg-muted transition-colors"
                )}>
                  <kpi.icon className="h-5 w-5 text-foreground/70 group-hover:text-foreground transition-colors" />
                </div>
                
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                  kpi.trendUp 
                    ? 'text-[hsl(var(--success))] bg-[hsl(var(--success))]/10' 
                    : 'text-muted-foreground bg-muted/50'
                )}>
                  {kpi.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.trend}
                </div>
              </div>
              
              <p className="text-3xl font-bold text-foreground tracking-tight mb-1">
                <AnimatedCounter 
                  value={kpi.value} 
                  suffix={kpi.isPercentage ? '%' : ''}
                  duration={1200}
                />
              </p>
              
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {kpi.title}
              </p>
              
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
