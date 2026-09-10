import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { MoreHorizontal, GripVertical } from 'lucide-react';
import { STAGE_CFG } from '@/components/leads/PipelineStagePills';

interface IsaInsight {
  sentimento: 'positivo' | 'neutro' | 'negativo' | null;
  urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
}

interface LeadExtra {
  leadId: string;
  ultimaInteracao: { resumo: string; data: string } | null;
  temAgendamento: boolean;
  proximoAgendamento: { titulo: string; data: string } | null;
}

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  isDragOver?: boolean;
  isaInsights?: Record<string, IsaInsight>;
  leadExtras?: Record<string, LeadExtra>;
}

const fmtCompact = (v: number) => {
  if (!v) return '';
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
};

export function KanbanColumn({
  status, leads, onLeadClick,
  onDragStart, onDragEnd, onDragOver, onDrop,
  isDragOver, isaInsights = {}, leadExtras = {},
}: KanbanColumnProps) {
  const cfg = STAGE_CFG[status] || STAGE_CFG['Lead Frio'];
  const columnLeads = leads.filter(l => l.status === status);
  const totalValue = columnLeads.reduce((s, l) => s + (l.valor_causa || 0), 0);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, status)}
      className="flex flex-col h-full w-[300px] lg:w-[340px] shrink-0"
    >
      {/* ── Header (estilo do Figma: só rótulo + badge de contagem) ── */}
      <div className="flex items-center justify-between py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-bold text-[#29201e] truncate">{status}</p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            {columnLeads.length}
          </span>
          {totalValue > 0 && (
            <span className="hidden lg:inline text-[11px] font-semibold text-[#6e5e5a] shrink-0">{fmtCompact(totalValue)}</span>
          )}
        </div>
        <MoreHorizontal className="h-4 w-4 text-[#6e5e5a] shrink-0" />
      </div>

      {/* ── Cards ── */}
      <div
        className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto rounded-2xl transition-colors"
        style={{
          background: isDragOver ? `${cfg.bg}80` : 'transparent',
          outline: isDragOver ? `2px dashed ${cfg.text}50` : 'none',
          outlineOffset: -2,
          padding: isDragOver ? 6 : 0,
        }}
      >
        {columnLeads.length === 0 ? (
          <div className="flex-1 min-h-20 flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#efebe4] py-6 text-[#c9c0b5]">
            <GripVertical className="h-4 w-4 opacity-50" />
            <span className="text-[11px] font-semibold">{isDragOver ? 'Solte aqui!' : 'Sem leads'}</span>
          </div>
        ) : (
          columnLeads.map(lead => (
            <div key={lead.id} draggable onDragStart={e => onDragStart(e, lead)} onDragEnd={onDragEnd} className="cursor-grab">
              <LeadCard
                lead={lead}
                onClick={() => onLeadClick(lead)}
                isaInsight={isaInsights[lead.id]}
                leadExtra={leadExtras[lead.id]}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
