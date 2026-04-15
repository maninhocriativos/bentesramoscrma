import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import {
  Snowflake, MessageSquare, Handshake, FileSignature,
  CheckCircle2, Trophy, XCircle, Building2, DollarSign, GripVertical,
} from 'lucide-react';

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

const STATUS_CFG: Record<string, {
  icon: React.ElementType;
  color: string;
  headerBg: string;
  badgeBg: string;
}> = {
  'Lead Frio':           { icon: Snowflake,     color: '#64748b', headerBg: 'rgba(100,116,139,0.06)', badgeBg: '#e2e8f0' },
  'Bentes Ramos':        { icon: Building2,     color: '#3d2b1f', headerBg: 'rgba(61,43,31,0.06)',    badgeBg: 'rgba(61,43,31,0.12)' },
  'Em Atendimento':      { icon: MessageSquare, color: '#f59e0b', headerBg: 'rgba(245,158,11,0.06)',  badgeBg: 'rgba(245,158,11,0.15)' },
  'Em Negociação':       { icon: Handshake,     color: '#8b5cf6', headerBg: 'rgba(139,92,246,0.06)', badgeBg: 'rgba(139,92,246,0.12)' },
  'Aguardando Contrato': { icon: FileSignature, color: '#c9a96e', headerBg: 'rgba(201,169,110,0.08)', badgeBg: 'rgba(201,169,110,0.18)' },
  'Contrato Assinado':   { icon: CheckCircle2,  color: '#0d9488', headerBg: 'rgba(13,148,136,0.06)',  badgeBg: 'rgba(13,148,136,0.12)' },
  'Ganho':               { icon: Trophy,        color: '#16a34a', headerBg: 'rgba(22,163,74,0.06)',   badgeBg: 'rgba(22,163,74,0.12)' },
  'Perdido':             { icon: XCircle,       color: '#dc2626', headerBg: 'rgba(220,38,38,0.06)',   badgeBg: 'rgba(220,38,38,0.12)' },
};

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
  const cfg = STATUS_CFG[status] || STATUS_CFG['Lead Frio'];
  const Icon = cfg.icon;
  const columnLeads = leads.filter(l => l.status === status);
  const totalValue = columnLeads.reduce((s, l) => s + (l.valor_causa || 0), 0);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, status)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        overflow: 'hidden',
        background: isDragOver ? `${cfg.color}08` : '#f9f8f6',
        border: `1px solid ${isDragOver ? cfg.color + '40' : 'rgba(201,169,110,0.2)'}`,
        boxShadow: isDragOver
          ? `0 0 0 2px ${cfg.color}25, 0 2px 8px rgba(0,0,0,0.06)`
          : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.18s ease',
        minHeight: 480,
        width: '100%',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        position: 'relative',
        background: cfg.headerBg,
        borderBottom: `1px solid ${cfg.color}18`,
        padding: '10px 12px 9px',
      }}>
        {/* Accent top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.color }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: totalValue > 0 ? 5 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Icon style={{ width: 13, height: 13, color: cfg.color, flexShrink: 0 }} />
            <span style={{
              fontSize: 11, fontWeight: 800, color: cfg.color,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}>
              {status}
            </span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800,
            padding: '2px 8px', borderRadius: 20,
            background: cfg.badgeBg, color: cfg.color,
            border: `0.5px solid ${cfg.color}20`,
            flexShrink: 0, marginLeft: 4,
          }}>
            {columnLeads.length}
          </span>
        </div>

        {/* Valor total */}
        {totalValue > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <DollarSign style={{ width: 9, height: 9, color: cfg.color }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{fmtCompact(totalValue)}</span>
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      <div style={{
        flex: 1,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 260px)',
      }}>
        {columnLeads.length === 0 ? (
          <div style={{
            flex: 1, minHeight: 80,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: `1.5px dashed ${isDragOver ? cfg.color + '50' : 'rgba(201,169,110,0.2)'}`,
            borderRadius: 10, padding: '20px 12px',
            color: isDragOver ? cfg.color : '#d1d5db',
            background: isDragOver ? `${cfg.color}06` : 'transparent',
            transition: 'all 0.15s',
          }}>
            <GripVertical style={{ width: 16, height: 16, marginBottom: 4, opacity: 0.5 }} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>
              {isDragOver ? 'Solte aqui!' : 'Sem leads'}
            </span>
          </div>
        ) : (
          columnLeads.map(lead => (
            <div
              key={lead.id}
              draggable
              onDragStart={e => onDragStart(e, lead)}
              onDragEnd={onDragEnd}
              style={{ cursor: 'grab' }}
            >
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

      {/* Drop indicator */}
      {isDragOver && (
        <div style={{
          padding: '6px 12px',
          borderTop: `1px dashed ${cfg.color}40`,
          textAlign: 'center',
          fontSize: 10, fontWeight: 700, color: cfg.color,
          background: `${cfg.color}06`,
        }}>
          ↓ Mover para {status}
        </div>
      )}
    </div>
  );
}
