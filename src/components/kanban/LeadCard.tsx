import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { getLeadIndicator } from '@/hooks/useAlertas';
import { 
  MessageCircle, ExternalLink, User, Clock, FileSignature, 
  Instagram, Facebook, Phone, Globe, Users, Mail, Briefcase, Sparkles,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { EnviarContratoModal } from '@/components/contratos/EnviarContratoModal';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
  isaInsight?: {
    sentimento: 'positivo' | 'neutro' | 'negativo' | null;
    urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  };
}

const ORIGEM_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  Instagram: { bg: 'bg-gradient-to-r from-pink-500/15 to-purple-500/15', text: 'text-pink-600', icon: Instagram },
  Facebook: { bg: 'bg-blue-500/15', text: 'text-blue-600', icon: Facebook },
  WhatsApp: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', icon: MessageCircle },
  ManyChat: { bg: 'bg-violet-500/15', text: 'text-violet-600', icon: MessageCircle },
  Google: { bg: 'bg-red-500/15', text: 'text-red-600', icon: Globe },
  Site: { bg: 'bg-cyan-500/15', text: 'text-cyan-600', icon: Globe },
  Indicação: { bg: 'bg-amber-500/15', text: 'text-amber-600', icon: Users },
  Telegram: { bg: 'bg-sky-500/15', text: 'text-sky-600', icon: MessageCircle },
  Email: { bg: 'bg-slate-500/15', text: 'text-slate-600', icon: Mail },
  Telefone: { bg: 'bg-green-500/15', text: 'text-green-600', icon: Phone },
  Outro: { bg: 'bg-muted', text: 'text-muted-foreground', icon: User },
};

const INDICATOR_STYLES = {
  red: { bg: 'bg-red-500', title: 'Sem interação há 7+ dias', pulse: true },
  yellow: { bg: 'bg-amber-400', title: 'Lead novo (< 24h)', pulse: false },
  green: { bg: 'bg-emerald-500', title: 'Movimentado hoje', pulse: false },
};

const SENTIMENTO_CONFIG = {
  positivo: { icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Positivo' },
  neutro: { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-400/10', label: 'Neutro' },
  negativo: { icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Negativo' },
};

const URGENCIA_CONFIG: Record<string, { color: string; bg: string; label: string; pulse?: boolean }> = {
  baixa: { color: 'text-slate-500', bg: 'bg-slate-100', label: 'Baixa' },
  media: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Média' },
  alta: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Alta' },
  urgente: { color: 'text-red-600', bg: 'bg-red-100', label: 'Urgente', pulse: true },
};

const formatShortCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '--';
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
};

export function LeadCard({ lead, onClick, isDragging, isaInsight }: LeadCardProps) {
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

  const truncatedResumo = lead.resumo_ia 
    ? lead.resumo_ia.length > 60 ? lead.resumo_ia.substring(0, 60) + '...' : lead.resumo_ia
    : null;

  const sentimentoConfig = isaInsight?.sentimento ? SENTIMENTO_CONFIG[isaInsight.sentimento] : null;
  const urgenciaConfig = isaInsight?.urgencia ? URGENCIA_CONFIG[isaInsight.urgencia] : null;
  const SentimentoIcon = sentimentoConfig?.icon;

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
        "bg-card rounded-lg cursor-pointer transition-all duration-150 relative group",
        "border border-border/50 hover:border-primary/40",
        "shadow-sm hover:shadow-md",
        isDragging && "opacity-70 rotate-1 scale-[1.02] shadow-lg"
      )}
    >
      {/* Status Indicator */}
      {indicatorStyle && (
        <div 
          className={cn(
            "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-card z-10",
            indicatorStyle.bg,
            indicatorStyle.pulse && "animate-pulse"
          )}
          title={indicatorStyle.title}
        />
      )}

      {/* Compact Header */}
      <div className="flex items-center gap-2 p-2.5 pb-1.5">
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-xs text-foreground truncate group-hover:text-primary transition-colors">
            {lead.nome || 'Sem nome'}
          </h4>
          <p className="text-[10px] text-muted-foreground truncate">{lead.email || lead.telefone || '--'}</p>
        </div>
      </div>

      {/* Compact Body */}
      <div className="px-2.5 pb-2 space-y-1">
        {/* Value + Insights Row */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
            lead.valor_causa ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          )}>
            {formatShortCurrency(lead.valor_causa)}
          </span>
          
          {sentimentoConfig && SentimentoIcon && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex items-center px-1 py-0.5 rounded", sentimentoConfig.bg, sentimentoConfig.color)}>
                  <SentimentoIcon className="w-2.5 h-2.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {sentimentoConfig.label}
              </TooltipContent>
            </Tooltip>
          )}
          
          {urgenciaConfig && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium",
                  urgenciaConfig.bg, urgenciaConfig.color,
                  urgenciaConfig.pulse && "animate-pulse"
                )}>
                  <Zap className="w-2 h-2" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {urgenciaConfig.label}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Origin + Time Row */}
        <div className="flex items-center justify-between gap-1">
          {lead.origem && (
            <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium", origemConfig.bg, origemConfig.text)}>
              <OrigemIcon className="w-2.5 h-2.5" />
              {lead.origem}
            </span>
          )}
          {lead.link_contrato && (
            <FileSignature className="w-3 h-3 text-gold" />
          )}
          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 ml-auto">
            <Clock className="w-2 h-2" />
            {lastInteraction}
          </span>
        </div>
      </div>

      {/* Contract Button - Only when needed */}
      {showContractButton && (
        <div className="px-2.5 pb-2">
          <Button
            size="sm"
            className="w-full h-6 text-[10px] gap-1 bg-gold hover:bg-gold/90 text-gold-foreground"
            onClick={handleGenerateContract}
          >
            <FileSignature className="w-2.5 h-2.5" />
            Gerar Contrato
          </Button>
        </div>
      )}

      {/* Minimal Footer */}
      <div className="flex items-center border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-7 rounded-none text-[10px] text-muted-foreground gap-1 hover:text-emerald-600 hover:bg-emerald-50/50"
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
        >
          <MessageCircle className="w-3 h-3" />
          WhatsApp
        </Button>
        <div className="w-px h-4 bg-border/50" />
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-7 rounded-none text-[10px] text-muted-foreground gap-1 hover:text-primary hover:bg-primary/5"
          onClick={handleViewDetails}
        >
          <ExternalLink className="w-3 h-3" />
          Detalhes
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