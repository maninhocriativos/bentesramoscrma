import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { getLeadIndicator } from '@/hooks/useAlertas';
import { 
  MessageCircle, ExternalLink, User, Clock, FileSignature, 
  Instagram, Facebook, Phone, Globe, Users, Mail, Briefcase, Sparkles,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Zap, CalendarX, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { EnviarContratoModal } from '@/components/contratos/EnviarContratoModal';

interface LeadExtra {
  leadId: string;
  ultimaInteracao: {
    resumo: string;
    data: string;
  } | null;
  temAgendamento: boolean;
  proximoAgendamento: {
    titulo: string;
    data: string;
  } | null;
}

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
  isaInsight?: {
    sentimento: 'positivo' | 'neutro' | 'negativo' | null;
    urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  };
  leadExtra?: LeadExtra;
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

export function LeadCard({ lead, onClick, isDragging, isaInsight, leadExtra }: LeadCardProps) {
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
  
  // Verifica se é lead em atendimento/negociação e precisa mostrar extras
  const precisaAgendamento = lead.status === 'Em Atendimento' || lead.status === 'Em Negociação';
  const precisaAgendar = precisaAgendamento && leadExtra && !leadExtra.temAgendamento;
  const ultimaInteracaoResumo = leadExtra?.ultimaInteracao?.resumo
    ? leadExtra.ultimaInteracao.resumo.length > 50 
      ? leadExtra.ultimaInteracao.resumo.substring(0, 50) + '...'
      : leadExtra.ultimaInteracao.resumo
    : null;

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, '');
      window.location.href = `tel:+55${phone}`;
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
      <div className="px-2.5 pb-2 space-y-1.5">
        {/* Value + Insights + Origin Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
            lead.valor_causa ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          )}>
            {formatShortCurrency(lead.valor_causa)}
          </span>
          
          {lead.origem && (
            <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium", origemConfig.bg, origemConfig.text)}>
              <OrigemIcon className="w-2.5 h-2.5" />
            </span>
          )}
          
          {sentimentoConfig && SentimentoIcon && (
            <span className={cn("inline-flex items-center px-1 py-0.5 rounded", sentimentoConfig.bg, sentimentoConfig.color)}>
              <SentimentoIcon className="w-2.5 h-2.5" />
            </span>
          )}
          
          {urgenciaConfig && (
            <span className={cn(
              "inline-flex items-center px-1 py-0.5 rounded",
              urgenciaConfig.bg, urgenciaConfig.color,
              urgenciaConfig.pulse && "animate-pulse"
            )}>
              <Zap className="w-2.5 h-2.5" />
            </span>
          )}

          {lead.link_contrato && (
            <FileSignature className="w-3 h-3 text-gold" />
          )}
        </div>

        {/* Time Row */}
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          {lastInteraction}
        </div>

        {/* Resumo da conversa para leads em atendimento/negociação */}
        {precisaAgendamento && ultimaInteracaoResumo && (
          <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded px-1.5 py-1">
            <p className="text-[9px] text-blue-700 dark:text-blue-300 line-clamp-2">
              <Sparkles className="w-2 h-2 inline mr-0.5" />
              {ultimaInteracaoResumo}
            </p>
          </div>
        )}

        {/* Alerta de agendamento pendente */}
        {precisaAgendar && (
          <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 rounded px-1.5 py-1 animate-pulse">
            <CalendarX className="w-2.5 h-2.5 text-amber-600" />
            <span className="text-[9px] font-medium text-amber-700 dark:text-amber-400">
              Falta agendar
            </span>
          </div>
        )}

        {/* Próximo agendamento */}
        {leadExtra?.proximoAgendamento && (
          <div className="flex items-center gap-1 bg-emerald-50/50 dark:bg-emerald-900/10 rounded px-1.5 py-1">
            <Calendar className="w-2.5 h-2.5 text-emerald-600" />
            <span className="text-[9px] text-emerald-700 dark:text-emerald-400 truncate">
              {new Date(leadExtra.proximoAgendamento.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}
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

      {/* Minimal Footer - 3 compact icons */}
      <div className="flex items-center border-t border-border/30 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-6 rounded-none text-muted-foreground hover:text-green-600 hover:bg-green-50/50 disabled:opacity-30"
          onClick={handleCall}
          disabled={!lead.telefone}
          title="Ligar"
        >
          <Phone className="w-3 h-3" />
        </Button>
        <div className="w-px h-3 bg-border/40" />
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-6 rounded-none text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50/50 disabled:opacity-30"
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
          title="WhatsApp"
        >
          <MessageCircle className="w-3 h-3" />
        </Button>
        <div className="w-px h-3 bg-border/40" />
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-6 rounded-none text-muted-foreground hover:text-primary hover:bg-primary/5"
          onClick={handleViewDetails}
          title="Detalhes"
        >
          <ExternalLink className="w-3 h-3" />
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