import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead, TipoOrigem } from '@/types/leads';
import { Phone, Clock, Star, Flame, Sparkles, Target, MessageSquare, DollarSign, FileSignature, Building2, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Paleta ────────────────────────────────────────────────────────────────────
const BROWN = '#3d2b1f';
const GOLD  = '#c9a96e';

const STATUS_BAR: Record<string, string> = {
  'Lead Frio':           '#64748b',
  'Bentes Ramos':        '#3d2b1f',
  'Em Atendimento':      '#f59e0b',
  'Em Negociação':       '#8b5cf6',
  'Aguardando Contrato': '#c9a96e',
  'Contrato Assinado':   '#0d9488',
  'Ganho':               '#16a34a',
  'Perdido':             '#dc2626',
};

const fmtCurrency = (v: number | null) => {
  if (!v) return '';
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
};

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
  isaInsight?: {
    sentimento: 'positivo' | 'neutro' | 'negativo' | null;
    urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  };
  leadExtra?: {
    leadId: string;
    ultimaInteracao: { resumo: string; data: string } | null;
    temAgendamento: boolean;
    proximoAgendamento: { titulo: string; data: string } | null;
  };
}

function SentimentIcon({ sentimento }: { sentimento?: string | null }) {
  if (!sentimento) return null;
  if (sentimento === 'positivo') return <Star style={{ width: 11, height: 11, color: '#16a34a', fill: '#16a34a' }} />;
  if (sentimento === 'negativo') return <Flame style={{ width: 11, height: 11, color: '#dc2626' }} />;
  return <Sparkles style={{ width: 11, height: 11, color: '#c9a96e' }} />;
}

export function LeadCard({ lead, onClick, isDragging, isaInsight, leadExtra }: LeadCardProps) {
  const navigate = useNavigate();

  const lastInteraction = lead.updated_at
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const hasContract   = lead.status === 'Ganho' || lead.status === 'Contrato Assinado';
  const isTrafego     = lead.tipo_origem === 'trafego' || lead.origem === 'Tráfego Pago';
  const isBR          = lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS';
  const barColor      = STATUS_BAR[lead.status || 'Lead Frio'] || '#94a3b8';
  const initials      = (lead.nome || 'L').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const urgente       = isaInsight?.urgencia === 'urgente' || isaInsight?.urgencia === 'alta';

  const handleClick = () => {
    navigate(`/chat?lead_id=${lead.id}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'white',
        borderRadius: 12,
        border: `1px solid ${hasContract ? 'rgba(22,163,74,0.25)' : 'rgba(201,169,110,0.2)'}`,
        borderLeft: `3px solid ${barColor}`,
        boxShadow: isDragging
          ? '0 8px 24px rgba(0,0,0,0.15)'
          : '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'grab',
        opacity: isDragging ? 0.85 : 1,
        transition: 'box-shadow 0.15s, transform 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ padding: '10px 12px' }}>

        {/* Linha 1: Avatar + Nome + Sentiment + Grip */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: hasContract ? 'rgba(22,163,74,0.1)' : `${barColor}12`,
            color: hasContract ? '#16a34a' : barColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, letterSpacing: '-0.02em',
          }}>
            {initials}
          </div>

          {/* Nome */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 12, fontWeight: 700, color: '#1c1917',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}>
              {lead.nome || 'Sem nome'}
            </p>
            {lead.tipo_acao && (
              <p style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                {lead.tipo_acao}
              </p>
            )}
          </div>

          {/* Sentiment + Grip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <SentimentIcon sentimento={isaInsight?.sentimento} />
            <GripVertical style={{ width: 12, height: 12, color: '#d1d5db' }} />
          </div>
        </div>

        {/* Linha 2: Telefone */}
        {lead.telefone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Phone style={{ width: 10, height: 10, color: '#9ca3af', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.telefone}
            </span>
          </div>
        )}

        {/* Linha 3: Próximo agendamento */}
        {leadExtra?.proximoAgendamento && (
          <div style={{
            fontSize: 10, color: '#b8922a', fontWeight: 600,
            background: 'rgba(201,169,110,0.08)', borderRadius: 6, padding: '3px 7px',
            marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            📅 {leadExtra.proximoAgendamento.titulo}
          </div>
        )}

        {/* Linha 4: Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 7, borderTop: '0.5px solid rgba(201,169,110,0.1)' }}>
          {/* Badges origem */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {isTrafego && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(201,169,110,0.12)', color: '#b8922a' }}>
                <Target style={{ width: 8, height: 8 }} /> Ads
              </span>
            )}
            {isBR && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(61,43,31,0.08)', color: BROWN }}>
                B&R
              </span>
            )}
            {!isTrafego && !isBR && lead.origem && (
              <span style={{ fontSize: 9, color: '#9ca3af', padding: '1px 5px', borderRadius: 20, background: '#f1f5f9' }}>
                {lead.origem.length > 12 ? lead.origem.slice(0, 12) + '…' : lead.origem}
              </span>
            )}
            {hasContract && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
                <FileSignature style={{ width: 8, height: 8 }} />
              </span>
            )}
            {urgente && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', animation: 'pulse 2s infinite' }}>
                ⚡
              </span>
            )}
          </div>

          {/* Valor + Tempo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {lead.valor_causa ? (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a' }}>
                {fmtCurrency(lead.valor_causa)}
              </span>
            ) : null}
            <span style={{ fontSize: 9, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock style={{ width: 9, height: 9 }} />
              {lastInteraction}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
