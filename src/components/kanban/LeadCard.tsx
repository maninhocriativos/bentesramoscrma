import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { getLeadIndicator } from '@/hooks/useAlertas';
import { 
  MessageCircle, ExternalLink, User, Clock, DollarSign, FileSignature, 
  Instagram, Facebook, Phone, Globe, Users, Mail, Briefcase, Sparkles,
  Calendar, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { EnviarContratoModal } from '@/components/contratos/EnviarContratoModal';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
}

const ORIGEM_CONFIG: Record<string, { bg: string; text: string; glow: string; icon: React.ElementType }> = {
  Instagram: { bg: 'bg-gradient-to-r from-pink-500/15 to-purple-500/15', text: 'text-pink-600', glow: 'shadow-pink-200', icon: Instagram },
  Facebook: { bg: 'bg-blue-500/15', text: 'text-blue-600', glow: 'shadow-blue-200', icon: Facebook },
  WhatsApp: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', glow: 'shadow-emerald-200', icon: MessageCircle },
  ManyChat: { bg: 'bg-violet-500/15', text: 'text-violet-600', glow: 'shadow-violet-200', icon: MessageCircle },
  Google: { bg: 'bg-red-500/15', text: 'text-red-600', glow: 'shadow-red-200', icon: Globe },
  Site: { bg: 'bg-cyan-500/15', text: 'text-cyan-600', glow: 'shadow-cyan-200', icon: Globe },
  Indicação: { bg: 'bg-amber-500/15', text: 'text-amber-600', glow: 'shadow-amber-200', icon: Users },
  Telegram: { bg: 'bg-sky-500/15', text: 'text-sky-600', glow: 'shadow-sky-200', icon: MessageCircle },
  Email: { bg: 'bg-slate-500/15', text: 'text-slate-600', glow: 'shadow-slate-200', icon: Mail },
  Telefone: { bg: 'bg-green-500/15', text: 'text-green-600', glow: 'shadow-green-200', icon: Phone },
  Outro: { bg: 'bg-muted', text: 'text-muted-foreground', glow: '', icon: User },
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

// Format short currency
const formatShortCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '--';
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const navigate = useNavigate();
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);
  
  const origemConfig = ORIGEM_CONFIG[lead.origem || 'Outro'] || ORIGEM_CONFIG.Outro;
  const OrigemIcon = origemConfig.icon;
  const indicator = getLeadIndicator(lead);
  const indicatorStyle = indicator ? INDICATOR_STYLES[indicator] : null;
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR });

  const showContractButton = lead.status === 'Aguardando Contrato' && !lead.link_contrato;

  // Truncate resumo IA
  const truncatedResumo = lead.resumo_ia 
    ? lead.resumo_ia.length > 80 
      ? lead.resumo_ia.substring(0, 80) + '...' 
      : lead.resumo_ia
    : null;

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

      {/* Card Header - Client Name + Value */}
      <div className="flex items-start gap-3 p-3.5 pb-2">
        <div className={cn(
          "w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5",
          "flex items-center justify-center shrink-0",
          "transition-transform duration-300 group-hover:scale-105"
        )}>
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors" title={lead.nome || 'Sem nome'}>
              {lead.nome || 'Sem nome'}
            </h4>
            {/* Value badge in header */}
            <span className={cn(
              "shrink-0 text-xs font-bold px-2 py-0.5 rounded-md",
              lead.valor_causa 
                ? "bg-emerald-500/15 text-emerald-600" 
                : "bg-muted text-muted-foreground"
            )}>
              {formatShortCurrency(lead.valor_causa)}
            </span>
          </div>
          {lead.email && (
            <p className="text-xs text-muted-foreground truncate mt-0.5" title={lead.email}>{lead.email}</p>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-3.5 pb-3 space-y-2">
        {/* Tipo de Ação */}
        {lead.tipo_acao && (
          <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-2.5 py-1.5">
            <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              {lead.tipo_acao}
            </span>
          </div>
        )}

        {/* Resumo IA */}
        {truncatedResumo && (
          <div className="flex items-start gap-2 bg-violet-500/5 rounded-lg px-2.5 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {truncatedResumo}
            </p>
          </div>
        )}

        {/* Badges Row - Origin + Contract */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Origem Badge with Icon */}
          {lead.origem && (
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium",
              origemConfig.bg, 
              origemConfig.text
            )}>
              <OrigemIcon className="w-3 h-3" />
              {lead.origem}
            </span>
          )}

          {/* Contract Badge */}
          {lead.link_contrato && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gold/20 text-gold-foreground">
              <FileSignature className="w-3 h-3" />
              Contrato
            </span>
          )}
        </div>

        {/* Last Interaction */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{lastInteraction}</span>
        </div>
      </div>

      {/* Generate Contract Button - only for "Aguardando Contrato" */}
      {showContractButton && (
        <div className="px-3.5 pb-2">
          <Button
            variant="default"
            size="sm"
            className={cn(
              "w-full h-8 text-xs gap-2 rounded-lg",
              "bg-gold hover:bg-gold/90 text-gold-foreground",
              "shadow-sm hover:shadow-md transition-all duration-200"
            )}
            onClick={handleGenerateContract}
          >
            <FileSignature className="w-3.5 h-3.5" />
            Gerar Contrato
          </Button>
        </div>
      )}

      {/* Card Footer - Actions */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 border-t border-border/30",
        "bg-muted/20"
      )}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs text-muted-foreground gap-1.5 rounded-md",
            "hover:text-emerald-600 hover:bg-emerald-500/10 transition-all duration-200"
          )}
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs text-muted-foreground gap-1.5 rounded-md",
            "hover:text-primary hover:bg-primary/10 transition-all duration-200"
          )}
          onClick={handleViewDetails}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Detalhes</span>
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