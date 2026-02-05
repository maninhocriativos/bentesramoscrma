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

// Mapeamento usando tokens do design system
const STAGE_CONFIG: Record<string, { icon: React.ElementType; colorClass: string; bgClass: string }> = {
  'Lead Frio': { 
    icon: Snowflake, 
    colorClass: 'text-stage-frio', 
    bgClass: 'bg-stage-frio-bg' 
  },
  'Bentes Ramos': { 
    icon: Building2, 
    colorClass: 'text-stage-bentes', 
    bgClass: 'bg-stage-bentes-bg' 
  },
  'Em Atendimento': { 
    icon: Flame, 
    colorClass: 'text-stage-atendimento', 
    bgClass: 'bg-stage-atendimento-bg' 
  },
  'Em Negociação': { 
    icon: Handshake, 
    colorClass: 'text-stage-negociacao', 
    bgClass: 'bg-stage-negociacao-bg' 
  },
  'Aguardando Contrato': { 
    icon: Clock, 
    colorClass: 'text-stage-aguardando', 
    bgClass: 'bg-stage-aguardando-bg' 
  },
  'Contrato Assinado': { 
    icon: FileSignature, 
    colorClass: 'text-stage-assinado', 
    bgClass: 'bg-stage-assinado-bg' 
  },
  'Ganho': { 
    icon: Trophy, 
    colorClass: 'text-stage-ganho', 
    bgClass: 'bg-stage-ganho-bg' 
  },
  'Perdido': { 
    icon: XCircle, 
    colorClass: 'text-stage-perdido', 
    bgClass: 'bg-stage-perdido-bg' 
  },
};

export function PipelineStagePills({ stages, activeStage, onStageChange }: PipelineStagePillsProps) {
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* All Stages Pill */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onStageChange('all')}
              className={cn(
                "flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-xs font-medium transition-all",
                activeStage === 'all'
                  ? "bg-stage-all text-white shadow-sm"
                  : "bg-stage-all-bg text-stage-all hover:opacity-80"
              )}
            >
              <span>Todos</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-semibold",
                activeStage === 'all' ? "bg-white/20" : "bg-black/5"
              )}>
                {totalCount}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Todas as etapas
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Stage Compact Pills */}
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage.status] || { 
            icon: Flame, 
            colorClass: 'text-muted-foreground', 
            bgClass: 'bg-muted' 
          };
          const Icon = config.icon;
          const isActive = activeStage === stage.status;

          return (
            <Tooltip key={stage.status}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onStageChange(stage.status)}
                  className={cn(
                    "flex items-center gap-1.5 h-[22px] px-2 rounded-full text-xs font-medium transition-all",
                    isActive
                      ? cn(config.colorClass, "bg-current text-white shadow-sm", 
                          // Override para usar a cor como background quando ativo
                          stage.status === 'Lead Frio' && "bg-stage-frio",
                          stage.status === 'Bentes Ramos' && "bg-stage-bentes",
                          stage.status === 'Em Atendimento' && "bg-stage-atendimento",
                          stage.status === 'Em Negociação' && "bg-stage-negociacao",
                          stage.status === 'Aguardando Contrato' && "bg-stage-aguardando",
                          stage.status === 'Contrato Assinado' && "bg-stage-assinado",
                          stage.status === 'Ganho' && "bg-stage-ganho",
                          stage.status === 'Perdido' && "bg-stage-perdido"
                        )
                      : cn(config.bgClass, config.colorClass, "hover:opacity-80")
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className={cn(
                    "text-[10px] px-1 py-0.5 rounded-full min-w-[16px] text-center font-semibold",
                    isActive ? "bg-white/20" : "bg-black/5"
                  )}>
                    {stage.count}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {stage.label} ({stage.count})
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
