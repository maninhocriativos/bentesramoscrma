import { LeadStatus } from '@/types/leads';
import { cn } from '@/lib/utils';

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

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  'all': { bg: 'bg-muted/50', border: 'border-border', text: 'text-foreground', activeBg: 'bg-primary text-primary-foreground' },
  'Lead Frio': { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', activeBg: 'bg-slate-600 text-white' },
  'Bentes Ramos': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', activeBg: 'bg-blue-600 text-white' },
  'Em Atendimento': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', activeBg: 'bg-amber-600 text-white' },
  'Em Negociação': { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', activeBg: 'bg-sky-600 text-white' },
  'Aguardando Contrato': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', activeBg: 'bg-purple-600 text-white' },
  'Contrato Assinado': { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', activeBg: 'bg-cyan-600 text-white' },
  'Ganho': { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', activeBg: 'bg-emerald-600 text-white' },
  'Perdido': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', activeBg: 'bg-red-600 text-white' },
};

export function PipelineStagePills({ stages, activeStage, onStageChange }: PipelineStagePillsProps) {
  const totalCount = stages.reduce((sum, s) => sum + s.count, 0);
  const allColors = STATUS_COLORS['all'];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {/* All Stages Pill */}
      <button
        onClick={() => onStageChange('all')}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
          activeStage === 'all'
            ? allColors.activeBg + " border-transparent shadow-sm"
            : allColors.bg + " " + allColors.border + " " + allColors.text + " hover:bg-muted"
        )}
      >
        <span>Todas</span>
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
          activeStage === 'all' ? "bg-white/20" : "bg-black/5"
        )}>
          {totalCount}
        </span>
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Stage Pills */}
      {stages.map((stage) => {
        const colors = STATUS_COLORS[stage.status] || STATUS_COLORS['all'];
        const isActive = activeStage === stage.status;

        return (
          <button
            key={stage.status}
            onClick={() => onStageChange(stage.status)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
              isActive
                ? colors.activeBg + " border-transparent shadow-sm"
                : colors.bg + " " + colors.border + " " + colors.text + " hover:opacity-80"
            )}
          >
            <span>{stage.label}</span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
              isActive ? "bg-white/20" : "bg-black/5"
            )}>
              {stage.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
