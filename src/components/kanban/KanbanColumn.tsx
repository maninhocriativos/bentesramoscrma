import { Lead, LeadStatus } from '@/types/leads';
import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import {
  Snowflake, MessageSquare, Handshake, FileSignature,
  CheckCircle2, Trophy, XCircle, Building2, DollarSign,
  Plus, GripVertical,
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

// Paleta por estágio — cores sólidas e distintas
const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;       // cor principal
  bg: string;          // fundo do header
  headerText: string;  // texto no header
  dropBg: string;      // fundo ao fazer drop
  badge: string;       // badge count
}> = {
  'Lead Frio': {
    icon: Snowflake,
    color: '#64748b',
    bg: 'rgba(100,116,139,0.06)',
    headerText: '#475569',
    dropBg: 'rgba(100,116,139,0.08)',
    badge: '#e2e8f0',
  },
  'Bentes Ramos': {
    icon: Building2,
    color: '#3d2b1f',
    bg: 'rgba(61,43,31,0.06)',
    headerText: '#3d2b1f',
    dropBg: 'rgba(61,43,31,0.08)',
    badge: 'rgba(61,43,31,0.12)',
  },
  'Em Atendimento': {
    icon: MessageSquare,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    headerText: '#b45309',
    dropBg: 'rgba(245,158,11,0.1)',
    badge: 'rgba(245,158,11,0.15)',
  },
  'Em Negociação': {
    icon: Handshake,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.06)',
    headerText: '#7c3aed',
    dropBg: 'rgba(139,92,246,0.1)',
    badge: 'rgba(139,92,246,0.12)',
  },
  'Aguardando Contrato': {
    icon: FileSignature,
    color: '#c9a96e',
    bg: 'rgba(201,169,110,0.08)',
    headerText: '#b8922a',
    dropBg: 'rgba(201,169,110,0.12)',
    badge: 'rgba(201,169,110,0.18)',
  },
  'Contrato Assinado': {
    icon: CheckCircle2,
    color: '#0d9488',
    bg: 'rgba(13,148,136,0.06)',
    headerText: '#0f766e',
    dropBg: 'rgba(13,148,136,0.1)',
    badge: 'rgba(13,148,136,0.12)',
  },
  'Ganho': {
    icon: Trophy,
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.06)',
    headerText: '#15803d',
    dropBg: 'rgba(22,163,74,0.1)',
    badge: 'rgba(22,163,74,0.12)',
  },
  'Perdido': {
    icon: XCircle,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.06)',
    headerText: '#b91c1c',
    dropBg: 'rgba(220,38,38,0.1)',
    badge: 'rgba(220,38,38,0.12)',
  },
};

const fmtCompact = (v: number) => {
  if (!v) return '';
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
};

export function KanbanColumn({
  status, leads, onLeadClick, onDragStart, onDragEnd,
  onDragOver, onDrop, isDragOver, isaInsights = {}, leadExtras = {},
}: KanbanColumnProps) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Lead Frio'];
  const Icon = cfg.icon;
  const columnLeads = leads.filter(l => l.status === status);
  const totalValue = columnLeads.reduce((s, l) => s + (l.valor_causa || 0), 0);
  const convertidos = columnLeads.filter(l => l.lead_state === 'CONTRACT_SIGNED' || l.status === 'Ganho').length;

  return (
    <div
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, status)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        background: isDragOver ? cfg.dropBg : '#f8f7f5',
        border: `1px solid ${isDragOver ? cfg.color + '50' : 'rgba(201,169,110,0.18)'}`,
        boxShadow: isDragOver ? `0 0 0 2px ${cfg.color}30` : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        minHeight: 500,
      }}
    >
      {/* ── Header ── */}
      <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}20`, padding: '12px 14px 10px' }}>
        {/* Accent top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.color, borderRadius: '16px 16px 0 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: cfg.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon style={{ width: 14, height: 14, color: cfg.color }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: cfg.headerText, letterSpacing: '-0.01em' }}>
              {status}
            </span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 20,
            background: cfg.badge, color: cfg.headerText,
            border: `0.5px solid ${cfg.color}25`,
          }}>
            {columnLeads.length}
          </span>
        </div>

        {/* Valor total + convertidos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalValue > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <DollarSign style={{ width: 10, height: 10, color: cfg.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{fmtCompact(totalValue)}</span>
            </div>
          )}
          {convertidos > 0 && (
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>✓ {convertidos} convertido{convertidos > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* ── Cards ── */}
      <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {columnLeads.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: `1.5px dashed ${isDragOver ? cfg.color + '60' : 'rgba(201,169,110,0.25)'}`,
            borderRadius: 12, padding: '32px 16px', color: isDragOver ? cfg.color : '#d1d5db',
            background: isDragOver ? cfg.dropBg : 'transparent', transition: 'all 0.2s',
          }}>
            <GripVertical style={{ width: 20, height: 20, marginBottom: 6, opacity: 0.5 }} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{isDragOver ? 'Solte aqui!' : 'Sem leads'}</span>
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

      {/* ── Footer com drop zone ── */}
      {isDragOver && (
        <div style={{
          padding: '8px 10px',
          borderTop: `1px dashed ${cfg.color}40`,
          textAlign: 'center',
          fontSize: 11, fontWeight: 700, color: cfg.color,
          background: cfg.dropBg,
        }}>
          ↓ Mover para {status}
        </div>
      )}
    </div>
  );
}
