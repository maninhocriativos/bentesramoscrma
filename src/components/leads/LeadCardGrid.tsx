import { Lead, LeadStatus } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, MessageCircle, MoreHorizontal, Eye, Building2, Megaphone,
  Bot, User, FileSignature, Scale, Copy, ArrowRight, Users, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface LeadCardGridProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
  processoCounts?: Record<string, number>;
}

// Cores sólidas por status — sem CSS vars para garantir render
const STATUS_CFG: Record<string, { dot: string; bg: string; text: string; bar: string; label: string }> = {
  'Lead Frio':           { dot: '#64748b', bg: '#f1f5f9', text: '#475569', bar: '#94a3b8', label: 'Frio' },
  'Bentes Ramos':        { dot: '#3d2b1f', bg: 'rgba(61,43,31,0.08)', text: '#3d2b1f', bar: '#3d2b1f', label: 'B&R' },
  'Em Atendimento':      { dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', bar: '#f59e0b', label: 'Atendimento' },
  'Em Negociação':       { dot: '#8b5cf6', bg: '#f5f3ff', text: '#7c3aed', bar: '#8b5cf6', label: 'Negociação' },
  'Aguardando Contrato': { dot: '#c9a96e', bg: 'rgba(201,169,110,0.1)', text: '#b8922a', bar: '#c9a96e', label: 'Aguardando' },
  'Contrato Assinado':   { dot: '#0d9488', bg: '#f0fdfa', text: '#0f766e', bar: '#0d9488', label: 'Assinado' },
  'Ganho':               { dot: '#16a34a', bg: '#f0fdf4', text: '#15803d', bar: '#16a34a', label: 'Ganho' },
  'Perdido':             { dot: '#dc2626', bg: '#fef2f2', text: '#b91c1c', bar: '#dc2626', label: 'Perdido' },
};

const fmtCurrency = (v: number | null) => {
  if (!v) return '';
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
};

function LeadCard({ lead, onClick, onMoveStage, allStages, processoCount = 0 }: {
  lead: Lead;
  onClick: () => void;
  onMoveStage: (id: string, s: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
  processoCount?: number;
}) {
  const navigate = useNavigate();
  const status = lead.status || 'Lead Frio';
  const cfg = STATUS_CFG[status] || STATUS_CFG['Lead Frio'];
  const initials = (lead.nome || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isTrafego = lead.tipo_origem === 'trafego' || lead.linha_whatsapp === 'trafego_isa' || lead.origem === 'Tráfego Pago';
  const isBR = lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS';
  const isIsa = lead.owner_tipo === 'isa' || lead.isa_ativa;
  const hasContract = lead.contract_signed_at || lead.status === 'Contrato Assinado' || lead.status === 'Ganho';
  const waLink = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, '')}` : null;

  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) { navigator.clipboard.writeText(lead.telefone); toast.success('Telefone copiado'); }
  };

  return (
    <div
      onClick={onClick}
      className="group"
      style={{
        background: 'white',
        borderRadius: 14,
        border: `1px solid rgba(201,169,110,0.18)`,
        borderLeft: `3px solid ${cfg.bar}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        overflow: 'hidden',
        opacity: lead.is_lost ? 0.65 : 1,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ padding: '12px 14px' }}>
        {/* Linha 1: Avatar + Nome + Ações */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <Avatar style={{ width: 36, height: 36, flexShrink: 0 }}>
            <AvatarFallback style={{ background: cfg.bg, color: cfg.text, fontSize: 11, fontWeight: 800 }}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.nome || 'Sem nome'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
            </div>
          </div>

          {/* Ações hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {waLink && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={e => { e.stopPropagation(); window.open(waLink, '_blank'); }}>
                    <MessageCircle style={{ width: 13, height: 13, color: '#16a34a' }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>WhatsApp</TooltipContent>
              </Tooltip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                  <MoreHorizontal style={{ width: 13, height: 13 }} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={onClick}>
                  <Eye style={{ width: 13, height: 13, marginRight: 8 }} /> Ver detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                  <User style={{ width: 13, height: 13, marginRight: 8 }} /> Ficha completa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight style={{ width: 13, height: 13, marginRight: 8 }} /> Mover etapa
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {allStages.map(s => {
                      const sCfg = STATUS_CFG[s.status] || STATUS_CFG['Lead Frio'];
                      return (
                        <DropdownMenuItem key={s.status} disabled={s.status === lead.status}
                          onClick={() => onMoveStage(lead.id, s.status)}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: sCfg.dot, marginRight: 8, flexShrink: 0 }} />
                          {s.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Linha 2: Telefone + Origem */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {lead.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="group/phone">
              <Phone style={{ width: 11, height: 11, color: '#9ca3af', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {lead.telefone}
              </span>
              <button onClick={copyPhone} className="opacity-0 group-hover/phone:opacity-100 transition-opacity">
                <Copy style={{ width: 10, height: 10, color: '#9ca3af' }} />
              </button>
            </div>
          )}
          {lead.origem && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isTrafego ? <Megaphone style={{ width: 11, height: 11, color: '#c9a96e', flexShrink: 0 }} />
                : isBR ? <Building2 style={{ width: 11, height: 11, color: '#3d2b1f', flexShrink: 0 }} />
                : <User style={{ width: 11, height: 11, color: '#9ca3af', flexShrink: 0 }} />}
              <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.origem}
              </span>
            </div>
          )}
        </div>

        {/* Linha 3: Footer badges + valor + tempo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {processoCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(61,43,31,0.08)', color: '#3d2b1f' }}>
                <Scale style={{ width: 9, height: 9 }} />{processoCount}
              </span>
            )}
            {hasContract && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
                <FileSignature style={{ width: 9, height: 9 }} />
              </span>
            )}
            {isIsa && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(201,169,110,0.1)', color: '#b8922a' }}>
                <Bot style={{ width: 9, height: 9 }} />ISA
              </span>
            )}
            {isBR && !isIsa && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(61,43,31,0.08)', color: '#3d2b1f' }}>
                B&R
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {lead.valor_causa ? (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>
                {fmtCurrency(lead.valor_causa)}
              </span>
            ) : null}
            {lead.updated_at && (
              <span style={{ fontSize: 10, color: '#d1d5db' }}>
                {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeadCardGrid({ leads, onLeadClick, onMoveStage, allStages, processoCounts = {} }: LeadCardGridProps) {
  if (leads.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(201,169,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Users style={{ width: 24, height: 24, color: '#d1d5db' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>Nenhum lead encontrado</p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Ajuste os filtros ou adicione um novo lead</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
            onMoveStage={onMoveStage}
            allStages={allStages}
            processoCount={processoCounts[lead.id] || 0}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
