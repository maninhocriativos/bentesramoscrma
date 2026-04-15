import { LeadStatus } from '@/types/leads';
import {
  Snowflake, Building2, Flame, Handshake,
  Clock, FileSignature, Trophy, XCircle,
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

const STAGE_CFG: Record<string, { icon: React.ElementType; color: string; bg: string; activeBg: string }> = {
  'Lead Frio':           { icon: Snowflake,     color: '#64748b', bg: '#f1f5f9', activeBg: '#e2e8f0' },
  'Bentes Ramos':        { icon: Building2,     color: '#3d2b1f', bg: 'rgba(61,43,31,0.08)', activeBg: 'rgba(61,43,31,0.14)' },
  'Em Atendimento':      { icon: Flame,         color: '#f59e0b', bg: '#fffbeb', activeBg: '#fef3c7' },
  'Em Negociação':       { icon: Handshake,     color: '#8b5cf6', bg: '#f5f3ff', activeBg: '#ede9fe' },
  'Aguardando Contrato': { icon: Clock,         color: '#c9a96e', bg: 'rgba(201,169,110,0.1)', activeBg: 'rgba(201,169,110,0.2)' },
  'Contrato Assinado':   { icon: FileSignature, color: '#0d9488', bg: '#f0fdfa', activeBg: '#ccfbf1' },
  'Ganho':               { icon: Trophy,        color: '#16a34a', bg: '#f0fdf4', activeBg: '#dcfce7' },
  'Perdido':             { icon: XCircle,       color: '#dc2626', bg: '#fef2f2', activeBg: '#fee2e2' },
};

export function PipelineStagePills({ stages, activeStage, onStageChange }: PipelineStagePillsProps) {
  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="scrollbar-hide">

      {/* Todos */}
      <button
        onClick={() => onStageChange('all')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 32, padding: '0 12px', borderRadius: 20, cursor: 'pointer',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
          background: activeStage === 'all' ? '#3d2b1f' : 'rgba(61,43,31,0.06)',
          color: activeStage === 'all' ? '#c9a96e' : '#9ca3af',
          border: `1px solid ${activeStage === 'all' ? '#3d2b1f' : 'rgba(201,169,110,0.2)'}`,
          transition: 'all 0.15s ease',
        }}
      >
        Todos
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 20,
          background: activeStage === 'all' ? 'rgba(201,169,110,0.25)' : 'rgba(201,169,110,0.12)',
          color: activeStage === 'all' ? '#c9a96e' : '#9ca3af',
        }}>
          {total}
        </span>
      </button>

      {/* Divisor */}
      <div style={{ width: 1, height: 20, background: 'rgba(201,169,110,0.2)', flexShrink: 0 }} />

      {/* Etapas */}
      {stages.map((stage, idx) => {
        const cfg = STAGE_CFG[stage.status] || STAGE_CFG['Lead Frio'];
        const isActive = activeStage === stage.status;
        const Icon = cfg.icon;

        return (
          <div key={stage.status} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => onStageChange(stage.status)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 10px', borderRadius: 20, cursor: 'pointer',
                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                background: isActive ? cfg.activeBg : cfg.bg,
                color: isActive ? cfg.color : '#9ca3af',
                border: `1px solid ${isActive ? cfg.color + '50' : 'rgba(201,169,110,0.15)'}`,
                boxShadow: isActive ? `0 0 0 1px ${cfg.color}20` : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon style={{ width: 11, height: 11, flexShrink: 0, color: isActive ? cfg.color : '#d1d5db' }} />
              <span className="hidden sm:inline">{stage.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, minWidth: 18, textAlign: 'center',
                color: isActive ? cfg.color : '#9ca3af',
              }}>
                {stage.count}
              </span>
            </button>

            {idx < stages.length - 1 && (
              <div style={{ width: 12, height: 1, background: 'rgba(201,169,110,0.2)', flexShrink: 0 }} className="hidden sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
