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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

const STAGE_CONFIG: Record<string, { icon: React.ElementType; color: string; activeBg: string; activeBorder: string }> = {
  'Lead Frio': { 
    icon: Snowflake, 
    color: 'text-stage-frio',
    activeBg: 'bg-stage-frio/10',
    activeBorder: 'border-stage-frio/40',
  },
  'Bentes Ramos': { 
    icon: Building2, 
    color: 'text-stage-bentes',
    activeBg: 'bg-stage-bentes/10',
    activeBorder: 'border-stage-bentes/40',
  },
  'Em Atendimento': { 
    icon: Flame, 
    color: 'text-stage-atendimento',
    activeBg: 'bg-stage-atendimento/10',
    activeBorder: 'border-stage-atendimento/40',
  },
  'Em Negociação': { 
    icon: Handshake, 
    color: 'text-stage-negociacao',
    activeBg: 'bg-stage-negociacao/10',
    activeBorder: 'border-stage-negociacao/40',
  },
  'Aguardando Contrato': { 
    icon: Clock, 
    color: 'text-stage-aguardando',
    activeBg: 'bg-stage-aguardando/10',
    activeBorder: 'border-stage-aguardando/40',
  },
  'Contrato Assinado': { 
    icon: FileSignature, 
    color: 'text-stage-assinado',
    activeBg: 'bg-stage-assinado/10',
    activeBorder: 'border-stage-assinado/40',
  },
  'Ganho': { 
    icon: Trophy, 
    color: 'text-stage-ganho',
    activeBg: 'bg-stage-ganho/10',
    activeBorder: 'border-stage-ganho/40',
  },
  'Perdido': { 
    icon: XCircle, 
    color: 'text-stage-perdido',
    activeBg: 'bg-stage-perdido/10',
    activeBorder: 'border-stage-perdido/40',
  },
};

export function PipelineStagePills({ stages, activeStage, onStageChange }: PipelineStagePillsProps) {
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {/* All Button */}
        <button
          onClick={() => onStageChange('all')}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap border shrink-0",
            activeStage === 'all'
              ? "bg-primary text-primary-foreground border-primary shadow-soft"
              : "bg-card text-muted-foreground border-border/60 hover:border-primary/30 hover:text-foreground"
          )}
        >
          <span>Todos</span>
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center",
            activeStage === 'all' ? "bg-primary-foreground/20" : "bg-muted"
          )}>
            {totalCount}
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border/60 shrink-0" />

        {/* Stage Pills */}
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage.status] || {
            icon: Flame, color: 'text-muted-foreground',
            activeBg: 'bg-muted', activeBorder: 'border-border',
          };
          const Icon = config.icon;
          const isActive = activeStage === stage.status;

          return (
            <Tooltip key={stage.status}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onStageChange(stage.status)}
                  className={cn(
                    "flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap border shrink-0",
                    isActive
                      ? cn(config.activeBg, config.activeBorder, config.color, "shadow-soft")
                      : "bg-card text-muted-foreground border-border/60 hover:border-primary/20 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? config.color : 'text-muted-foreground/70')} />
                  <span className="hidden sm:inline">{stage.label}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center",
                    isActive ? "bg-current/10" : "bg-muted/80"
                  )}>
                    {stage.count}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {stage.label} — {stage.count} lead{stage.count !== 1 ? 's' : ''}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
