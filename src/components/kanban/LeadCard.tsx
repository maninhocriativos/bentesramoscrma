import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { getLeadIndicator } from '@/hooks/useAlertas';
import { MessageCircle, ExternalLink, User, Clock, DollarSign, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { EnviarContratoModal } from '@/components/contratos/EnviarContratoModal';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
}

const ORIGEM_STYLES: Record<string, { bg: string; text: string; glow: string }> = {
  Instagram: { bg: 'bg-pink-100', text: 'text-pink-700', glow: 'shadow-pink-200' },
  Google: { bg: 'bg-blue-100', text: 'text-blue-700', glow: 'shadow-blue-200' },
  Site: { bg: 'bg-emerald-100', text: 'text-emerald-700', glow: 'shadow-emerald-200' },
  Indicação: { bg: 'bg-purple-100', text: 'text-purple-700', glow: 'shadow-purple-200' },
  Outro: { bg: 'bg-muted', text: 'text-muted-foreground', glow: '' },
};

const INDICATOR_STYLES = {
  red: { bg: 'bg-red-500', ring: 'ring-red-200', title: 'Sem interação há 7+ dias', pulse: true },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-200', title: 'Lead novo (< 24h)', pulse: false },
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', title: 'Movimentado hoje', pulse: false },
};

// Format currency value
const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const navigate = useNavigate();
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);
  
  const origemStyle = ORIGEM_STYLES[lead.origem || 'Outro'] || ORIGEM_STYLES.Outro;
  const indicator = getLeadIndicator(lead);
  const indicatorStyle = indicator ? INDICATOR_STYLES[indicator] : null;
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });

  const showContractButton = lead.status === 'Aguardando Contrato' && !lead.link_contrato;

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

  const handleGenerateContract = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsContratoModalOpen(true);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl cursor-pointer transition-all duration-300 relative group",
        "border border-border/60 hover:border-gold/40",
        "shadow-soft hover:shadow-card-hover",
        isDragging && "opacity-60 rotate-2 scale-105 shadow-lg"
      )}
    >
      {/* Status Indicator - top right with pulse for urgent */}
      {indicatorStyle && (
        <div 
          className={cn(
            "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full ring-2 ring-card z-10",
            indicatorStyle.bg,
            indicatorStyle.pulse && "animate-pulse"
          )}
          title={indicatorStyle.title}
        >
          {indicatorStyle.pulse && (
            <span className={cn(
              "absolute inset-0 rounded-full animate-ping",
              indicatorStyle.bg,
              "opacity-40"
            )} />
          )}
        </div>
      )}

      {/* Card Header - Client Name + Avatar */}
      <div className="flex items-center gap-3 p-3.5 pb-2.5 border-b border-border/30">
        <div className={cn(
          "w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5",
          "flex items-center justify-center shrink-0",
          "transition-transform duration-300 group-hover:scale-105"
        )}>
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors" title={lead.nome || 'Sem nome'}>
            {lead.nome || 'Sem nome'}
          </h4>
          {lead.email && (
            <p className="text-xs text-muted-foreground truncate mt-0.5" title={lead.email}>{lead.email}</p>
          )}
        </div>
      </div>

      {/* Card Body - Value, Action Type, Last Interaction */}
      <div className="p-3.5 pt-3 space-y-2.5">
        {/* Value */}
        <div className="flex items-center justify-between bg-muted/30 rounded-lg px-2.5 py-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Valor:
          </span>
          <span className={cn(
            "font-bold text-sm",
            lead.valor_causa ? "text-success" : "text-muted-foreground"
          )}>
            {formatCurrency(lead.valor_causa)}
          </span>
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Action Type Badge */}
          {lead.tipo_acao && (
            <span className="badge-compact bg-muted text-muted-foreground whitespace-nowrap">
              {lead.tipo_acao}
            </span>
          )}
          
          {/* Origem Badge */}
          {lead.origem && (
            <span className={cn(
              "badge-compact whitespace-nowrap transition-shadow duration-200",
              origemStyle.bg, 
              origemStyle.text,
              `hover:${origemStyle.glow}`
            )}>
              {lead.origem}
            </span>
          )}

          {/* Contract Badge */}
          {lead.link_contrato && (
            <span className="badge-compact bg-gold/20 text-gold-foreground whitespace-nowrap animate-pulse-subtle">
              Contrato
            </span>
          )}
        </div>

        {/* Last Interaction */}
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {lastInteraction}
        </p>
      </div>

      {/* Generate Contract Button - only for "Aguardando Contrato" */}
      {showContractButton && (
        <div className="px-3.5 pb-2">
          <Button
            variant="default"
            size="sm"
            className={cn(
              "w-full h-9 text-xs gap-2 rounded-lg",
              "bg-gold hover:bg-gold/90 text-gold-foreground",
              "shadow-sm hover:shadow-md transition-all duration-200"
            )}
            onClick={handleGenerateContract}
          >
            <FileSignature className="w-4 h-4" />
            Gerar Contrato
          </Button>
        </div>
      )}

      {/* Card Footer - Actions with hover reveal */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-t border-border/30",
        "bg-gradient-to-r from-muted/20 via-transparent to-muted/20"
      )}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2.5 text-xs text-muted-foreground gap-1.5 rounded-lg",
            "hover:text-success hover:bg-success/10 transition-all duration-200",
            "hover:scale-105"
          )}
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2.5 text-xs text-muted-foreground gap-1.5 rounded-lg",
            "hover:text-primary hover:bg-primary/10 transition-all duration-200",
            "hover:scale-105"
          )}
          onClick={handleViewDetails}
        >
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">Detalhes</span>
        </Button>
      </div>

      {/* Contract Modal */}
      <EnviarContratoModal
        isOpen={isContratoModalOpen}
        onClose={() => setIsContratoModalOpen(false)}
        onSuccess={() => setIsContratoModalOpen(false)}
        preSelectedLead={{ id: lead.id, nome: lead.nome || '', email: lead.email, telefone: lead.telefone }}
      />
    </div>
  );
}
