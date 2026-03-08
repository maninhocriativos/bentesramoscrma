import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead, TipoOrigem } from '@/types/leads';
import { cn } from '@/lib/utils';
import { User, Clock, Star, Flame, Sparkles, Target, MessageSquare, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    ultimaInteracao: { resumo: string; data: string; } | null;
    temAgendamento: boolean;
    proximoAgendamento: { titulo: string; data: string; } | null;
  };
}

function SentimentDot({ isaInsight }: { isaInsight?: LeadCardProps['isaInsight'] }) {
  if (!isaInsight?.sentimento) return null;

  const config = {
    positivo: { icon: Star, color: 'text-stage-ganho' },
    neutro: { icon: Sparkles, color: 'text-stage-bentes' },
    negativo: { icon: Flame, color: 'text-stage-perdido' },
  };

  const { icon: Icon, color } = config[isaInsight.sentimento];
  return <Icon className={cn("w-2.5 h-2.5", color)} />;
}

function OriginBadge({ tipoOrigem }: { tipoOrigem?: TipoOrigem | null }) {
  if (!tipoOrigem || tipoOrigem === 'indefinido') return null;

  const config = {
    trafego: { icon: Target, label: 'Ads', bg: 'bg-origem-ads/8', text: 'text-origem-ads' },
    whatsapp_direto: { icon: MessageSquare, label: 'Direto', bg: 'bg-linha-escritorio/8', text: 'text-linha-escritorio' },
  };

  const item = config[tipoOrigem];
  if (!item) return null;
  const { icon: Icon, label, bg, text } = item;

  return (
    <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[9px] font-medium", bg, text)}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

const formatCurrency = (value: number | null): string => {
  if (!value) return '';
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

export function LeadCard({ lead, onClick, isDragging, isaInsight }: LeadCardProps) {
  const navigate = useNavigate();
  
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const hasContract = lead.status === 'Ganho' || lead.status === 'Contrato Assinado';

  const handleCardClick = () => {
    navigate(`/chat?lead_id=${lead.id}`);
  };

  const initials = (lead.nome || 'L')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group bg-card rounded-lg border border-border/40",
        "cursor-pointer transition-all duration-150",
        "hover:shadow-soft hover:border-border/60",
        hasContract && "border-stage-ganho/20",
        isDragging && "opacity-70 shadow-soft-lg"
      )}
    >
      <div className="p-2.5">
        {/* Row 1: Name + Sentiment */}
        <div className="flex items-start gap-2 mb-1.5">
          <div className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold",
            hasContract ? "bg-stage-ganho/8 text-stage-ganho" : "bg-muted/60 text-muted-foreground"
          )}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-[12px] text-foreground truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h4>
            {lead.tipo_acao && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {lead.tipo_acao}
              </p>
            )}
          </div>

          <SentimentDot isaInsight={isaInsight} />
        </div>

        {/* Row 2: Meta info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            <OriginBadge tipoOrigem={lead.tipo_origem as TipoOrigem} />
            {lead.origem && !lead.tipo_origem && (
              <span className="text-[9px] text-muted-foreground px-1.5 py-px rounded bg-muted/30">
                {lead.origem}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lead.valor_causa ? (
              <span className="text-[10px] font-medium text-stage-ganho flex items-center gap-0.5">
                <DollarSign className="h-2.5 w-2.5" />
                {formatCurrency(lead.valor_causa)}
              </span>
            ) : null}
            <span className="flex items-center gap-0.5 text-muted-foreground/50 text-[9px]">
              <Clock className="w-2.5 h-2.5" />
              {lastInteraction}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
