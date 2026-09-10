import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead } from '@/types/leads';
import { Phone, Clock, Star, Flame, Sparkles, Target, FileSignature, HardDrive, CalendarClock } from 'lucide-react';
import { STAGE_CFG } from '@/components/leads/PipelineStagePills';

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
  const lastInteraction = lead.updated_at
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const hasContract = lead.status === 'Ganho' || lead.status === 'Contrato Assinado';
  const isTrafego    = lead.tipo_origem === 'trafego' || lead.origem === 'Tráfego Pago';
  const isBR         = lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS';
  const urgente      = isaInsight?.urgencia === 'urgente' || isaInsight?.urgencia === 'alta';
  const cfg          = STAGE_CFG[lead.status || 'Lead Frio'] || STAGE_CFG['Lead Frio'];

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#efebe4] rounded-2xl p-4 flex flex-col gap-2.5 cursor-grab transition-shadow hover:shadow-[0_2px_8px_rgba(62,47,43,0.08)]"
      style={{ boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '0 2px 3px rgba(62,47,43,0.04)', opacity: isDragging ? 0.85 : 1 }}
    >
      {/* Status + tempo */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.text }} />
          <span className="text-[11px] font-semibold uppercase text-[#6e5e5a] truncate">{lead.status || 'Lead Frio'}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <SentimentIcon sentimento={isaInsight?.sentimento} />
          {urgente && <Flame className="h-3 w-3 text-[#dc2626]" />}
          <span className="text-[11px] text-[#a89b8f]">{lastInteraction}</span>
        </div>
      </div>

      {/* Nome + telefone */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-[#29201e] truncate">{lead.nome || 'Sem nome'}</p>
        {lead.telefone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-[#a89b8f] shrink-0" />
            <span className="text-[13px] text-[#6e5e5a] truncate">{lead.telefone}</span>
          </div>
        )}
      </div>

      {/* Próximo agendamento (real, sem equivalente no Figma) */}
      {leadExtra?.proximoAgendamento && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8a6d47] bg-[#f5efe6] rounded-lg px-2 py-1 truncate">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate">{leadExtra.proximoAgendamento.titulo}</span>
        </div>
      )}

      {/* Rodapé: tipo de ação + origem (padrão do Figma) */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {lead.tipo_acao && (
            <span className="text-[11px] font-semibold text-[#29201e] bg-[#f5efe6] rounded-md px-2 py-1 truncate">{lead.tipo_acao}</span>
          )}
          {isTrafego && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#8a6d47] bg-[#f5efe6] rounded-full px-2 py-0.5"><Target className="h-2.5 w-2.5" /> Ads</span>
          )}
          {isBR && <span className="text-[10px] font-bold text-[#3e2f2b] bg-[#f5efe6] rounded-full px-2 py-0.5">B&R</span>}
          {hasContract && <FileSignature className="h-3 w-3 text-[#15803d] shrink-0" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lead.valor_causa ? <span className="text-[11px] font-bold text-[#15803d]">{fmtCurrency(lead.valor_causa)}</span> : null}
          {lead.origem && (
            <span className="flex items-center gap-1 text-[11px] text-[#6e5e5a]">
              <HardDrive className="h-3 w-3" /> {lead.origem}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
