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

// Track previous values for trend comparison
let previousValues: { [key: string]: number } = {};

// Estados que indicam lead em progresso ativo
const ESTADOS_ATIVOS: LeadState[] = ['TRIAGE', 'CLASSIFIED', 'DATA_CAPTURE', 'CONTRACT_SENT'];

// Estados que indicam conversão bem sucedida
const ESTADOS_CONVERTIDOS: LeadState[] = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'];

export function DashboardKPIs({ leads, processos }: DashboardKPIsProps) {
  const [recentChange, setRecentChange] = useState<string | null>(null);
  
  // Métricas baseadas em lead_state (State Machine)
  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    
    // Leads em progresso ativo (usando lead_state)
    const leadsEmProgresso = leads.filter(l => 
      l.lead_state && ESTADOS_ATIVOS.includes(l.lead_state as LeadState)
    ).length;
    
    // Leads convertidos (contrato assinado ou além)
    const leadsConvertidos = leads.filter(l => 
      l.lead_state && ESTADOS_CONVERTIDOS.includes(l.lead_state as LeadState)
    ).length;
    
    // Leads perdidos (is_lost = true)
    const leadsPerdidos = leads.filter(l => l.is_lost === true).length;
    
    // Leads novos (estado NEW ou sem estado)
    const leadsNovos = leads.filter(l => !l.lead_state || l.lead_state === 'NEW').length;
    
    // Leads prontos para advogado
    const leadsReady = leads.filter(l => l.lead_state === 'READY_FOR_LAWYER').length;
    
    // Leads criados hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadsHoje = leads.filter(l => new Date(l.created_at) >= today).length;
    
    // Taxa de conversão: convertidos / (convertidos + perdidos)
    const leadsFinalizados = leadsConvertidos + leadsPerdidos;
    const taxaConversao = leadsFinalizados > 0 
      ? Math.round((leadsConvertidos / leadsFinalizados) * 100) 
      : 0;
    
    return {
      totalLeads,
      leadsEmProgresso,
      leadsConvertidos,
      leadsPerdidos,
      leadsNovos,
      leadsReady,
      leadsHoje,
      taxaConversao
    };
  }, [leads]);

  // Detect changes for visual feedback
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
      gradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
      iconBg: 'bg-blue-500/15 group-hover:bg-blue-500/25',
      iconColor: 'text-blue-600',
    },
    {
      id: 'leadsEmProgresso',
      title: 'Em Progresso',
      value: metrics.leadsEmProgresso,
      icon: TrendingUp,
      trend: metrics.leadsEmProgresso > 0 ? 'Ativos' : 'Nenhum',
      trendUp: metrics.leadsEmProgresso > 0,
      description: 'Triagem a Contrato',
      gradient: 'from-orange-500/20 via-orange-400/10 to-transparent',
      iconBg: 'bg-orange-500/15 group-hover:bg-orange-500/25',
      iconColor: 'text-orange-600',
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
      gradient: 'from-gold/20 via-gold/10 to-transparent',
      iconBg: 'bg-gold/15 group-hover:bg-gold/25',
      iconColor: 'text-gold',
    },
    {
      id: 'leadsConvertidos',
      title: 'Convertidos',
      value: metrics.leadsConvertidos,
      icon: Briefcase,
      trend: metrics.leadsReady > 0 ? `${metrics.leadsReady} prontos` : 'Contratos',
      trendUp: metrics.leadsConvertidos > 0,
      description: 'Contratos assinados+',
      gradient: 'from-success/20 via-success/10 to-transparent',
      iconBg: 'bg-success/15 group-hover:bg-success/25',
      iconColor: 'text-success',
    },
  ];

  return (
    <div className="space-y-2">
      {/* Real-time indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">Atualização em tempo real</span>
        </div>
        {recentChange && (
          <span className="text-xs text-success animate-fade-in flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Dados atualizados
          </span>
        )}
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-children">
        {kpis.map((kpi, index) => (
          <Card 
            key={kpi.title} 
            className={cn(
              "group relative rounded-xl border border-border/50 overflow-hidden bg-card",
              "transition-all duration-300 ease-out",
              "hover:shadow-card-hover hover:-translate-y-1 hover:border-border",
              recentChange === kpi.id && "ring-2 ring-success/50 animate-pulse"
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
    </div>
  );
}
