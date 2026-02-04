import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead, TipoOrigem } from '@/types/leads';
import { cn } from '@/lib/utils';
import { 
  User, Clock, 
  CheckCircle2, Star, Flame, Sparkles, Target, MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EnviarContratoModal } from '@/components/contratos/EnviarContratoModal';
import { Badge } from '@/components/ui/badge';

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

const formatShortCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
};

// Sentiment indicator with glow
function SentimentIndicator({ isaInsight }: { isaInsight?: LeadCardProps['isaInsight'] }) {
  if (!isaInsight?.sentimento) return null;

  const config = {
    positivo: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', glow: 'shadow-glow-gold' },
    neutro: { icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-50', glow: '' },
    negativo: { icon: Flame, color: 'text-red-500', bg: 'bg-red-50', glow: '' },
  };

  const { icon: Icon, color, bg } = config[isaInsight.sentimento];

  return (
    <div className={cn("p-1 rounded-full", bg)}>
      <Icon className={cn("w-3 h-3", color)} />
    </div>
  );
}

// Badge de origem do lead (tráfego vs direto)
function OrigemBadge({ tipoOrigem }: { tipoOrigem?: TipoOrigem | null }) {
  if (!tipoOrigem || tipoOrigem === 'indefinido') return null;

  const config = {
    trafego: { 
      icon: Target, 
      label: 'Tráfego', 
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
    },
    whatsapp_direto: { 
      icon: MessageSquare, 
      label: 'Direto', 
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' 
    },
  };

  const { icon: Icon, label, className } = config[tipoOrigem] || {};
  if (!Icon) return null;

  return (
    <Badge variant="secondary" className={cn("h-5 text-[10px] font-medium gap-1 px-1.5", className)}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

export function LeadCard({ lead, onClick, isDragging, isaInsight }: LeadCardProps) {
  const navigate = useNavigate();
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);
  
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const hasContract = lead.status === 'Ganho' || lead.status === 'Contrato Assinado';
  const hasValue = lead.valor_causa && lead.valor_causa > 0;

  // Ao clicar no card, abre o chat direto com o lead
  const handleCardClick = () => {
    navigate(`/chat?lead_id=${lead.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "rounded-lg cursor-pointer transition-all duration-200 group kanban-card-wrapper",
        "bg-card border border-border/60 overflow-hidden",
        "hover:border-gold/40 hover:shadow-card-hover",
        hasValue && "gradient-gold",
        hasContract && "ring-1 ring-success/30 gradient-success",
        isDragging && "kanban-card-dragging"
      )}
    >
      {/* Top accent line */}
      <div className={cn(
        "h-0.5 w-full",
        hasContract ? "bg-gradient-to-r from-success/60 via-success to-success/60" :
        hasValue ? "bg-gradient-to-r from-gold/40 via-gold to-gold/40" :
        "bg-gradient-to-r from-transparent via-border to-transparent"
      )} />

      {/* Main Content - compacto */}
      <div className="p-2">
        {/* Header Row */}
        <div className="flex items-start gap-2 mb-1.5">
          {/* Avatar compacto */}
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 relative",
            "bg-gradient-to-br from-primary/20 via-primary/10 to-gold/20",
            hasContract && "from-success/20 via-success/10 to-emerald-300/20"
          )}>
            <User className={cn(
              "w-3.5 h-3.5",
              hasContract ? "text-success" : "text-primary"
            )} />
            {hasContract && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-success text-success-foreground rounded-full p-0.5">
                <CheckCircle2 className="w-2 h-2" />
              </div>
            )}
          </div>

          {/* Name & Value */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[11px] text-foreground truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h4>
            {lead.tipo_acao && (
              <p className="text-[9px] text-muted-foreground truncate">
                {lead.tipo_acao}
              </p>
            )}
          </div>

          {/* Sentiment Indicator */}
          <SentimentIndicator isaInsight={isaInsight} />
        </div>

        {/* Meta Row - compacto */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          <span className="text-[9px]">{lastInteraction}</span>
        </div>

        {/* Origin badges - compacto */}
        {(lead.origem || lead.tipo_origem) && (
          <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1 flex-wrap">
            <OrigemBadge tipoOrigem={lead.tipo_origem as TipoOrigem} />
            {lead.origem && (
              <Badge variant="secondary" className="h-4 text-[8px] font-medium px-1">
                {lead.origem}
              </Badge>
            )}
          </div>
        )}
      </div>

      <EnviarContratoModal
        isOpen={isContratoModalOpen}
        onClose={() => setIsContratoModalOpen(false)}
        onSuccess={() => setIsContratoModalOpen(false)}
        preSelectedLead={{ id: lead.id, nome: lead.nome || '', email: lead.email, telefone: lead.telefone }}
      />
    </div>
  );
}