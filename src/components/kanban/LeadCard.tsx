import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead, TipoOrigem } from '@/types/leads';
import { cn } from '@/lib/utils';
import { User, Clock, Star, Flame, Sparkles, Target, MessageSquare } from 'lucide-react';
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

// Sentiment indicator - usando cores do design system
function SentimentDot({ isaInsight }: { isaInsight?: LeadCardProps['isaInsight'] }) {
  if (!isaInsight?.sentimento) return null;

  const config = {
    positivo: { icon: Star, color: 'text-gold' },
    neutro: { icon: Sparkles, color: 'text-primary/60' },
    negativo: { icon: Flame, color: 'text-destructive' },
  };

  const { icon: Icon, color } = config[isaInsight.sentimento];

  return <Icon className={cn("w-3 h-3", color)} />;
}

// Origin badge - usando cores do design system
function OriginBadge({ tipoOrigem }: { tipoOrigem?: TipoOrigem | null }) {
  if (!tipoOrigem || tipoOrigem === 'indefinido') return null;

  const config = {
    trafego: { icon: Target, label: 'Ads', bg: 'bg-primary/10', text: 'text-primary' },
    whatsapp_direto: { icon: MessageSquare, label: 'Direto', bg: 'bg-muted', text: 'text-muted-foreground' },
  };

  const item = config[tipoOrigem];
  if (!item) return null;
  const { icon: Icon, label, bg, text } = item;

  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", bg, text)}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export function LeadCard({ lead, onClick, isDragging, isaInsight }: LeadCardProps) {
  const navigate = useNavigate();
  
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const hasContract = lead.status === 'Ganho' || lead.status === 'Contrato Assinado';

  const handleCardClick = () => {
    navigate(`/chat?lead_id=${lead.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "lead-card group",
        "bg-card rounded-xl border border-border/60",
        "cursor-pointer transition-all duration-200",
        "hover:shadow-card-hover hover:border-border",
        hasContract && "border-success/30",
        isDragging && "kanban-card-dragging opacity-80"
      )}
    >
      {/* Card Content - 2 row layout */}
      <div className="p-3">
        {/* Row 1: Avatar + Name + Time */}
        <div className="flex items-center gap-2.5 mb-2">
          {/* Avatar - usando cores do design system */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            "bg-gradient-to-br from-gold/20 to-gold/5",
            hasContract && "from-success/20 to-success/5"
          )}>
            <User className={cn(
              "w-4 h-4",
              hasContract ? "text-success" : "text-gold-foreground"
            )} />
          </div>

          {/* Name + Type */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h4>
            {lead.tipo_acao && (
              <p className="text-[11px] text-muted-foreground truncate">
                {lead.tipo_acao}
              </p>
            )}
          </div>

          {/* Sentiment + Time - usando cores do design system */}
          <div className="flex items-center gap-2 shrink-0">
            <SentimentDot isaInsight={isaInsight} />
            <div className="flex items-center gap-1 text-muted-foreground/70">
              <Clock className="w-3 h-3 text-gold/60" />
              <span className="text-[10px]">{lastInteraction}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Origin + Canal */}
        {(lead.origem || lead.tipo_origem) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <OriginBadge tipoOrigem={lead.tipo_origem as TipoOrigem} />
            {lead.origem && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                {lead.origem}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
