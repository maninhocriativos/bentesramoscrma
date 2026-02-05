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

const STAGE_CONFIG: Record<string, { icon: React.ElementType; color: string; activeColor: string }> = {
  'Lead Frio': { icon: Snowflake, color: 'text-slate-500 bg-slate-100', activeColor: 'bg-slate-600 text-white' },
  'Bentes Ramos': { icon: Building2, color: 'text-blue-500 bg-blue-100', activeColor: 'bg-blue-600 text-white' },
  'Em Atendimento': { icon: Flame, color: 'text-amber-500 bg-amber-100', activeColor: 'bg-amber-600 text-white' },
  'Em Negociação': { icon: Handshake, color: 'text-sky-500 bg-sky-100', activeColor: 'bg-sky-600 text-white' },
  'Aguardando Contrato': { icon: Clock, color: 'text-purple-500 bg-purple-100', activeColor: 'bg-purple-600 text-white' },
  'Contrato Assinado': { icon: FileSignature, color: 'text-cyan-500 bg-cyan-100', activeColor: 'bg-cyan-600 text-white' },
  'Ganho': { icon: Trophy, color: 'text-emerald-500 bg-emerald-100', activeColor: 'bg-emerald-600 text-white' },
  'Perdido': { icon: XCircle, color: 'text-red-500 bg-red-100', activeColor: 'bg-red-600 text-white' },
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
                "flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-all",
                activeStage === 'all'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
            >
              <span>Todos</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded min-w-[18px] text-center font-semibold",
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
            color: 'text-muted-foreground bg-muted', 
            activeColor: 'bg-primary text-primary-foreground' 
          };
          const Icon = config.icon;
          const isActive = activeStage === stage.status;

          return (
            <Tooltip key={stage.status}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onStageChange(stage.status)}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-2 rounded-md text-xs font-medium transition-all",
                    isActive
                      ? config.activeColor + " shadow-sm"
                      : config.color + " hover:opacity-80"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className={cn(
                    "text-[10px] px-1 py-0.5 rounded min-w-[16px] text-center font-semibold",
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
