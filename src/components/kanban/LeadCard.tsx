import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Lead } from '@/types/leads';
import { cn } from '@/lib/utils';
import { LeadFollowupInfo } from '@/hooks/useLeadFollowups';
import { 
  MessageCircle, ExternalLink, User, Clock, 
  Zap, Timer, Ban, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  leadExtra?: {
    leadId: string;
    ultimaInteracao: { resumo: string; data: string; } | null;
    temAgendamento: boolean;
    proximoAgendamento: { titulo: string; data: string; } | null;
  };
  followupInfo?: LeadFollowupInfo;
}

const formatShortCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
};

// Compact follow-up indicator
function FollowupIndicator({ followupInfo }: { followupInfo: LeadFollowupInfo }) {
  const { status, followupStageFast, followupStageSlow, followupLockReason, waitingReply } = followupInfo;

  if (status === 'concluido' || followupLockReason) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Ban className="w-3 h-3" />
      </span>
    );
  }

  if (waitingReply) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
        <Clock className="w-3 h-3 animate-pulse" />
      </span>
    );
  }

  const hasFast = followupStageFast !== null && followupStageFast >= 0 && followupStageFast < 3;
  const hasSlow = followupStageSlow !== null && followupStageSlow >= 0 && followupStageSlow < 3;

  if (!hasFast && !hasSlow) return null;

  return (
    <div className="flex items-center gap-1">
      {hasFast && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600">
          <Zap className="w-3 h-3" />
          {(followupStageFast ?? 0) + 1}/3
        </span>
      )}
      {hasSlow && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600">
          <Timer className="w-3 h-3" />
          {(followupStageSlow ?? 0) + 1}/3
        </span>
      )}
    </div>
  );
}

export function LeadCard({ lead, onClick, isDragging, followupInfo }: LeadCardProps) {
  const navigate = useNavigate();
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);
  
  const lastInteraction = lead.updated_at 
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })
    : formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const hasContract = lead.status === 'Ganho' || lead.status === 'Contrato Assinado';

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
        "bg-card rounded-lg cursor-pointer transition-all duration-150 group",
        "border border-border/60 hover:border-primary/30 hover:shadow-md",
        isDragging && "opacity-60 rotate-1 scale-105 shadow-xl"
      )}
    >
      {/* Header */}
      <div className="p-3 pb-2">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              {lead.valor_causa && (
                <span className="text-xs font-medium text-success">
                  {formatShortCurrency(lead.valor_causa)}
                </span>
              )}
              {hasContract && (
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {lastInteraction}
          </span>
          {followupInfo && <FollowupIndicator followupInfo={followupInfo} />}
        </div>
      </div>

      {/* Actions - Minimal */}
      <div className="flex border-t border-border/40 divide-x divide-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 rounded-none rounded-bl-lg text-muted-foreground hover:text-success hover:bg-success/5"
          onClick={handleWhatsApp}
          disabled={!lead.telefone}
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 rounded-none rounded-br-lg text-muted-foreground hover:text-primary hover:bg-primary/5"
          onClick={handleViewDetails}
        >
          <ExternalLink className="w-3.5 h-3.5" />
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
