import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { getLeadIndicator } from '@/hooks/useAlertas';
import { LeadFollowupInfo } from '@/hooks/useLeadFollowups';
import { 
  MessageCircle, ExternalLink, User, Clock, FileSignature, 
  Instagram, Facebook, Phone, Globe, Users, Mail, Briefcase, Sparkles,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Zap, CalendarX, Calendar,
  Pause, Timer, Ban, Send
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
  followupInfo?: LeadFollowupInfo;
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

// Follow-up status badges component
function FollowupBadges({ followupInfo }: { followupInfo: LeadFollowupInfo }) {
  const { status, followupStageFast, followupStageSlow, followupLockReason, waitingReply, nextFollowupType } = followupInfo;

  // Bloqueado/Concluído
  if (status === 'concluido' || followupLockReason) {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <Ban className="w-2.5 h-2.5" />
          Bloqueado
        </span>
      </div>
    );
  }

  // Aguardando resposta
  if (waitingReply) {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
          <Pause className="w-2.5 h-2.5" />
          Aguardando
        </span>
      </div>
    );
  }

  const badges = [];

  // FAST stage badge
  if (followupStageFast !== null && followupStageFast >= 0 && followupStageFast < 3) {
    const fastLabels = ['10min', '4h', '15h'];
    badges.push(
      <span key="fast" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        <Zap className="w-2.5 h-2.5" />
        FAST {followupStageFast + 1}/3
      </span>
    );
  }

  // SLOW stage badge
  if (followupStageSlow !== null && followupStageSlow >= 0 && followupStageSlow < 3) {
    badges.push(
      <span key="slow" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
        <Timer className="w-2.5 h-2.5" />
        SLOW {followupStageSlow + 1}/3
      </span>
    );
  }

  // Next follow-up type
  if (nextFollowupType && badges.length === 0) {
    const isfast = nextFollowupType === 'fast';
    badges.push(
      <span key="next" className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium",
        isfast ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
      )}>
        <Send className="w-2.5 h-2.5" />
        {isfast ? 'FAST' : 'SLOW'}
      </span>
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {badges}
    </div>
  );
}

export function LeadCard({ lead, onClick, isDragging, isaInsight, leadExtra, followupInfo }: LeadCardProps) {
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
            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-card z-10",
            indicatorStyle.bg,
            indicatorStyle.pulse && "animate-pulse"
          )}
          title={indicatorStyle.title}
        />
      )}

      {/* Ultra Compact Header */}
      <div className="flex items-center gap-1.5 p-2 pb-1">
        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-3 h-3 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[11px] text-foreground truncate leading-tight group-hover:text-primary transition-colors">
            {lead.nome || 'Sem nome'}
          </h4>
        </div>
      </div>

      {/* Compact Body */}
      <div className="px-2 pb-1.5 space-y-1">
        {/* Value + Origin + Insights - Single Row */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className={cn(
            "text-[9px] font-semibold px-1 py-0.5 rounded",
            lead.valor_causa ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          )}>
            {formatShortCurrency(lead.valor_causa)}
          </span>
          
          {lead.origem && (
            <span className={cn("inline-flex items-center px-1 py-0.5 rounded", origemConfig.bg, origemConfig.text)}>
              <OrigemIcon className="w-2.5 h-2.5" />
            </span>
          )}
          
          {sentimentoConfig && SentimentoIcon && (
            <span className={cn("inline-flex items-center px-0.5 py-0.5 rounded", sentimentoConfig.bg, sentimentoConfig.color)}>
              <SentimentoIcon className="w-2.5 h-2.5" />
            </span>
          )}

          {lead.link_contrato && (
            <FileSignature className="w-2.5 h-2.5 text-gold" />
          )}
        </div>

        {/* Follow-up Badges - Compact */}
        {followupInfo && (
          <FollowupBadges followupInfo={followupInfo} />
        )}

        {/* Time + Alert Row */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
            <Clock className="w-2 h-2" />
            {lastInteraction}
          </div>
          
          {precisaAgendar && (
            <span className="flex items-center gap-0.5 text-[8px] text-amber-600 animate-pulse">
              <CalendarX className="w-2 h-2" />
            </span>
          )}
          
          {leadExtra?.proximoAgendamento && (
            <span className="flex items-center gap-0.5 text-[8px] text-emerald-600">
              <Calendar className="w-2 h-2" />
              {new Date(leadExtra.proximoAgendamento.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Minimal Footer - 2 icons only */}
      <div className="flex items-center border-t border-border/30 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-5 rounded-none text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50/50 disabled:opacity-30"
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
          title="WhatsApp"
        >
          <MessageCircle className="w-2.5 h-2.5" />
        </Button>
        <div className="w-px h-2.5 bg-border/40" />
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-5 rounded-none text-muted-foreground hover:text-primary hover:bg-primary/5"
          onClick={handleViewDetails}
          title="Detalhes"
        >
          <ExternalLink className="w-2.5 h-2.5" />
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