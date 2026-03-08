import { LeadStatus } from '@/types/leads';
import { cn } from '@/lib/utils';
import {
  Snowflake,
  Building2,
  Flame,
  Handshake,
  Clock,
  FileSignature,
  Trophy,
  XCircle,
} from 'lucide-react';

interface PipelineStage {
  status: LeadStatus;
  label: string;
  count: number;
}

interface PipelineStagePillsProps {
  stages: PipelineStage[];
  activeStage: string;
  onStageChange: (stage: string) => void;
}

const STAGE_CONFIG: Record<string, { icon: React.ElementType; color: string; activeBg: string; activeBorder: string; dotColor: string }> = {
  'Lead Frio': { 
    icon: Snowflake, 
    color: 'text-stage-frio',
    activeBg: 'bg-stage-frio/8',
    activeBorder: 'border-stage-frio/30',
    dotColor: 'bg-stage-frio',
  },
  'Bentes Ramos': { 
    icon: Building2, 
    color: 'text-stage-bentes',
    activeBg: 'bg-stage-bentes/8',
    activeBorder: 'border-stage-bentes/30',
    dotColor: 'bg-stage-bentes',
  },
  'Em Atendimento': { 
    icon: Flame, 
    color: 'text-stage-atendimento',
    activeBg: 'bg-stage-atendimento/8',
    activeBorder: 'border-stage-atendimento/30',
    dotColor: 'bg-stage-atendimento',
  },
  'Em Negociação': { 
    icon: Handshake, 
    color: 'text-stage-negociacao',
    activeBg: 'bg-stage-negociacao/8',
    activeBorder: 'border-stage-negociacao/30',
    dotColor: 'bg-stage-negociacao',
  },
  'Aguardando Contrato': { 
    icon: Clock, 
    color: 'text-stage-aguardando',
    activeBg: 'bg-stage-aguardando/8',
    activeBorder: 'border-stage-aguardando/30',
    dotColor: 'bg-stage-aguardando',
  },
  'Contrato Assinado': { 
    icon: FileSignature, 
    color: 'text-stage-assinado',
    activeBg: 'bg-stage-assinado/8',
    activeBorder: 'border-stage-assinado/30',
    dotColor: 'bg-stage-assinado',
  },
  'Ganho': { 
    icon: Trophy, 
    color: 'text-stage-ganho',
    activeBg: 'bg-stage-ganho/8',
    activeBorder: 'border-stage-ganho/30',
    dotColor: 'bg-stage-ganho',
  },
  'Perdido': { 
    icon: XCircle, 
    color: 'text-stage-perdido',
    activeBg: 'bg-stage-perdido/8',
    activeBorder: 'border-stage-perdido/30',
    dotColor: 'bg-stage-perdido',
  },
};

export function PipelineStagePills({ stages, activeStage, onStageChange }: PipelineStagePillsProps) {
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
      {/* All Button */}
      <button
        onClick={() => onStageChange('all')}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap border shrink-0",
          activeStage === 'all'
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-transparent text-muted-foreground border-border/50 hover:border-primary/20 hover:text-foreground"
        )}
      >
        Todos
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-px rounded min-w-[18px] text-center",
          activeStage === 'all' ? "bg-primary-foreground/20" : "bg-muted"
        )}>
          {totalCount}
        </span>
      </button>

      {/* Connector line */}
      <div className="w-4 h-px bg-border/60 shrink-0" />

      {/* Stage Pills */}
      {stages.map((stage, index) => {
        const config = STAGE_CONFIG[stage.status] || {
          icon: Flame, color: 'text-muted-foreground',
          activeBg: 'bg-muted', activeBorder: 'border-border',
          dotColor: 'bg-muted-foreground',
        };
        const isActive = activeStage === stage.status;
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.status} className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onStageChange(stage.status)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-medium transition-all duration-200 whitespace-nowrap border",
                isActive
                  ? cn(config.activeBg, config.activeBorder, config.color)
                  : "bg-transparent text-muted-foreground border-border/40 hover:border-border hover:text-foreground"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full shrink-0", isActive ? config.dotColor : "bg-muted-foreground/30")} />
              <span className="hidden sm:inline">{stage.label}</span>
              <span className={cn(
                "text-[10px] font-bold min-w-[16px] text-center",
                isActive ? config.color : "text-muted-foreground/60"
              )}>
                {stage.count}
              </span>
            </button>
            {!isLast && <div className="w-2 h-px bg-border/40 shrink-0 hidden sm:block" />}
          </div>
        );
      })}
    </div>
  );
}
