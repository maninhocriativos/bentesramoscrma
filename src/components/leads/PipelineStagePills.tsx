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

// Mesma paleta de status usada nas outras telas redesenhadas a partir do
// Figma real (Petições, Documentos) — mantém consistência visual entre
// módulos do CRM.
export const STAGE_CFG: Record<string, { bg: string; text: string }> = {
  'Lead Frio':           { bg: '#e8f0fe', text: '#1565c0' },
  'Bentes Ramos':        { bg: '#f5efe6', text: '#3e2f2b' },
  'Em Atendimento':      { bg: '#fef3c7', text: '#92400e' },
  'Em Negociação':       { bg: '#e9d5ff', text: '#6b21a8' },
  'Aguardando Contrato': { bg: '#f5efe6', text: '#8a6d47' },
  'Contrato Assinado':   { bg: '#dcfce7', text: '#15803d' },
  'Ganho':               { bg: '#d1fae5', text: '#047857' },
  'Perdido':             { bg: '#fee2e2', text: '#991b1b' },
};

export function PipelineStagePills({ stages, activeStage, onStageChange }: PipelineStagePillsProps) {
  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
      <button
        onClick={() => onStageChange('all')}
        className={cn('flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border',
          activeStage === 'all'
            ? 'bg-[#3e2f2b] text-white border-[#3e2f2b]'
            : 'bg-white text-[#6e5e5a] border-[#efebe4] hover:border-[#e3d9cd]')}
      >
        Todos os Leads
        <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded-full', activeStage === 'all' ? 'bg-white/20 text-white' : 'bg-[#f5efe6] text-[#29201e]')}>
          {total}
        </span>
      </button>

      {stages.map(stage => {
        const cfg = STAGE_CFG[stage.status] || STAGE_CFG['Lead Frio'];
        const isActive = activeStage === stage.status;

        return (
          <button
            key={stage.status}
            onClick={() => onStageChange(stage.status)}
            style={isActive ? { backgroundColor: cfg.bg, color: cfg.text } : undefined}
            className={cn('flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors',
              isActive ? '' : 'bg-white text-[#6e5e5a] border border-[#efebe4] hover:border-[#e3d9cd]')}
          >
            {stage.label}
            <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded-full', isActive ? 'bg-black/10' : 'bg-[#f5efe6] text-[#29201e]')}>
              {stage.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
