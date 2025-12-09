import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { getLeadIndicator } from '@/hooks/useAlertas';
import { MessageCircle, Eye, User, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
}

const ORIGEM_STYLES: Record<string, { bg: string; text: string }> = {
  Instagram: { bg: 'bg-pink-100', text: 'text-pink-700' },
  Google: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Site: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Indicação: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Outro: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

const INDICATOR_STYLES = {
  red: { bg: 'bg-red-500', ring: 'ring-red-200', title: 'Sem interação há 7+ dias' },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-200', title: 'Lead novo (< 24h)' },
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', title: 'Movimentado hoje' },
};

// Mock value - in real app this would come from the lead data
const getLeadValue = (lead: Lead): string => {
  // Generate a mock value based on lead ID for demo purposes
  const values = ['15.000', '25.000', '50.000', '75.000', '100.000', '150.000'];
  const index = lead.id.charCodeAt(0) % values.length;
  return values[index];
};

// Mock action type - in real app this would come from the lead data
const getActionType = (lead: Lead): string => {
  const types = ['Trabalhista', 'Cível', 'Consumidor', 'Família', 'Tributário', 'Criminal'];
  const index = lead.id.charCodeAt(1) % types.length;
  return types[index];
};

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const navigate = useNavigate();
  const origemStyle = ORIGEM_STYLES[lead.origem || 'Outro'] || ORIGEM_STYLES.Outro;
  const indicator = getLeadIndicator(lead);
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });

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
        "bg-card rounded-lg cursor-pointer transition-all duration-200 relative group",
        "border border-border/60 hover:border-gold/50",
        "shadow-soft hover:shadow-card-hover hover:-translate-y-0.5",
        isDragging && "opacity-60 rotate-1 scale-105 shadow-card-hover"
      )}
    >
      {/* Status Indicator - top right */}
      {indicator && (
        <div 
          className={cn(
            "absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-card z-10",
            INDICATOR_STYLES[indicator].bg
          )}
          title={INDICATOR_STYLES[indicator].title}
        />
      )}

      {/* Card Header - Client Name + Avatar */}
      <div className="flex items-center gap-3 p-3 pb-2 border-b border-border/40">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-foreground truncate leading-tight">
            {lead.nome || 'Sem nome'}
          </h4>
          {lead.email && (
            <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
          )}
        </div>
      </div>

      {/* Card Body - Value, Action Type, Last Interaction */}
      <div className="p-3 space-y-2">
        {/* Value */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Valor da causa:</span>
          <span className="font-semibold text-success text-sm">
            R$ {getLeadValue(lead)},00
          </span>
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Action Type Badge */}
          <span className="badge-compact bg-muted text-muted-foreground">
            {getActionType(lead)}
          </span>
          
          {/* Origem Badge */}
          {lead.origem && (
            <span className={cn("badge-compact", origemStyle.bg, origemStyle.text)}>
              {lead.origem}
            </span>
          )}

          {/* Contract Badge */}
          {lead.link_contrato && (
            <span className="badge-compact bg-gold/20 text-gold-foreground">
              Contrato
            </span>
          )}
        </div>

        {/* Last Interaction */}
        <p className="text-xs text-muted-foreground">
          Última interação: {lastInteraction}
        </p>
      </div>

      {/* Card Footer - Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-success gap-1"
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
          onClick={handleViewDetails}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ver Perfil
        </Button>
      </div>
    </div>
  );
}
