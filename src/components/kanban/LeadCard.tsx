import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead, TipoOrigem } from '@/types/leads';
import { cn } from '@/lib/utils';
import { 
  MessageCircle, ExternalLink, User, Clock, 
  CheckCircle2, Star, Flame, Sparkles, Target, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/leads/${lead.id}`);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl cursor-pointer transition-all duration-200 group kanban-card-wrapper",
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

      {/* Main Content */}
      <div className="p-3">
        {/* Header Row */}
        <div className="flex items-start gap-2.5 mb-2">
          {/* Avatar with gradient */}
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative",
            "bg-gradient-to-br from-primary/20 via-primary/10 to-gold/20",
            hasContract && "from-success/20 via-success/10 to-emerald-300/20"
          )}>
            <User className={cn(
              "w-4 h-4",
              hasContract ? "text-success" : "text-primary"
            )} />
            {hasContract && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-success text-success-foreground rounded-full p-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" />
              </div>
            )}
          </div>

          {/* Name & Value */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {hasValue && (
                <span className={cn(
                  "text-xs font-bold",
                  hasContract ? "text-success" : "text-gold-foreground"
                )}>
                  {formatShortCurrency(lead.valor_causa)}
                </span>
              )}
              {lead.tipo_acao && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] font-medium">
                  {lead.tipo_acao.slice(0, 12)}
                </Badge>
              )}
            </div>
          </div>

          {/* Sentiment Indicator */}
          <SentimentIndicator isaInsight={isaInsight} />
        </div>

        {/* Meta Row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">{lastInteraction}</span>
          </div>
        </div>

        {/* Origin and Origem badges */}
        {(lead.origem || lead.tipo_origem) && (
          <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
            <OrigemBadge tipoOrigem={lead.tipo_origem as TipoOrigem} />
            {lead.origem && (
              <Badge variant="secondary" className="h-5 text-[10px] font-medium">
                {lead.origem}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Hover Actions */}
      <div className={cn(
        "flex border-t border-border/40 divide-x divide-border/40",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        "bg-muted/30"
      )}>
        {lead.telefone && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 rounded-none text-muted-foreground hover:text-green-600 hover:bg-green-50 gap-1.5"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">WhatsApp</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 rounded-none text-muted-foreground hover:text-primary hover:bg-primary/5 gap-1.5"
          onClick={handleViewDetails}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Detalhes</span>
        </Button>
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