import { Lead, LeadStatus } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, MessageCircle, MoreHorizontal, Eye, Building2, Megaphone, Bot, User,
  FileSignature, Scale, DollarSign, Clock, Copy, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

interface LeadCardGridProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
  processoCounts?: Record<string, number>;
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  'Lead Frio': { dot: 'bg-stage-frio', bg: 'bg-stage-frio-bg', text: 'text-stage-frio', label: 'Frio' },
  'Bentes Ramos': { dot: 'bg-stage-bentes', bg: 'bg-stage-bentes-bg', text: 'text-stage-bentes', label: 'B&R' },
  'Em Atendimento': { dot: 'bg-stage-atendimento', bg: 'bg-stage-atendimento-bg', text: 'text-stage-atendimento', label: 'Atendimento' },
  'Em Negociação': { dot: 'bg-stage-negociacao', bg: 'bg-stage-negociacao-bg', text: 'text-stage-negociacao', label: 'Negociação' },
  'Aguardando Contrato': { dot: 'bg-stage-aguardando', bg: 'bg-stage-aguardando-bg', text: 'text-stage-aguardando', label: 'Aguardando' },
  'Contrato Assinado': { dot: 'bg-stage-assinado', bg: 'bg-stage-assinado-bg', text: 'text-stage-assinado', label: 'Assinado' },
  'Ganho': { dot: 'bg-stage-ganho', bg: 'bg-stage-ganho-bg', text: 'text-stage-ganho', label: 'Ganho' },
  'Perdido': { dot: 'bg-stage-perdido', bg: 'bg-stage-perdido-bg', text: 'text-stage-perdido', label: 'Perdido' },
};

const formatCurrency = (value: number | null): string => {
  if (!value) return '';
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

function LeadCard({ lead, onClick, onMoveStage, allStages, processoCount = 0 }: {
  lead: Lead;
  onClick: () => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
  processoCount?: number;
}) {
  const navigate = useNavigate();
  const status = lead.status || 'Lead Frio';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['Lead Frio'];
  const initials = (lead.nome || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const hasContract = lead.contract_signed_at || lead.status === 'Contrato Assinado' || lead.status === 'Ganho';
  const isIsa = lead.owner_tipo === 'isa' || lead.isa_ativa;
  const isBR = lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS';
  const isTrafego = lead.tipo_origem === 'trafego' || lead.linha_whatsapp === 'trafego_isa';

  const whatsappLink = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, '')}` : null;

  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      navigator.clipboard.writeText(lead.telefone);
      toast.success('Telefone copiado');
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-xl border border-border/50 p-4 cursor-pointer",
        "hover:shadow-md hover:border-border hover:-translate-y-0.5",
        "transition-all duration-200 ease-out",
        lead.is_lost && "opacity-60"
      )}
    >
      {/* Top row: Avatar + Name + Actions */}
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background shadow-sm">
          <AvatarFallback className={cn("text-[11px] font-semibold", config.bg, config.text)}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
            {lead.nome || 'Sem nome'}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
            <span className={cn("text-[10px] font-medium", config.text)}>{config.label}</span>
          </div>
        </div>

        {/* Quick actions - visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {whatsappLink && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-action-chat hover:bg-action-chat-bg"
                  onClick={(e) => { e.stopPropagation(); window.open(whatsappLink, '_blank'); }}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>WhatsApp</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem onClick={onClick}>
                <Eye className="h-3.5 w-3.5 mr-2" /> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                <User className="h-3.5 w-3.5 mr-2" /> Ficha completa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRight className="h-3.5 w-3.5 mr-2" /> Mover etapa
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {allStages.map(stage => (
                    <DropdownMenuItem
                      key={stage.status}
                      disabled={stage.status === lead.status}
                      onClick={() => onMoveStage(lead.id, stage.status)}
                    >
                      <span className={cn("w-2 h-2 rounded-full mr-2", STATUS_CONFIG[stage.status]?.dot)} />
                      {stage.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Middle: Key info */}
      <div className="mt-3 space-y-1.5">
        {lead.telefone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground group/phone">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.telefone}</span>
            <button onClick={copyPhone} className="opacity-0 group-hover/phone:opacity-100 transition-opacity">
              <Copy className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        {lead.origem && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isTrafego ? <Megaphone className="h-3 w-3 shrink-0" /> : isBR ? <Building2 className="h-3 w-3 shrink-0" /> : <User className="h-3 w-3 shrink-0" />}
            <span>{lead.origem}</span>
          </div>
        )}
      </div>

      {/* Footer: Badges + Meta */}
      <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Process count */}
          {processoCount > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4.5 px-1.5 gap-0.5 bg-primary/5 text-primary border-0">
              <Scale className="h-2.5 w-2.5" />
              {processoCount}
            </Badge>
          )}

          {/* Contract indicator */}
          {hasContract && (
            <Badge variant="secondary" className="text-[9px] h-4.5 px-1.5 gap-0.5 bg-stage-ganho-bg text-stage-ganho border-0">
              <FileSignature className="h-2.5 w-2.5" />
            </Badge>
          )}

          {/* ISA badge */}
          {isIsa && (
            <Badge variant="secondary" className="text-[9px] h-4.5 px-1.5 gap-0.5 bg-linha-trafego-bg text-linha-trafego border-0">
              <Bot className="h-2.5 w-2.5" />
            </Badge>
          )}

          {/* Line badge */}
          {isBR && (
            <Badge variant="secondary" className="text-[9px] h-4.5 px-1.5 bg-linha-escritorio-bg text-linha-escritorio border-0">
              B&R
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lead.valor_causa ? (
            <span className="text-[10px] font-semibold text-[hsl(var(--success))]">
              {formatCurrency(lead.valor_causa)}
            </span>
          ) : null}

          {lead.updated_at && (
            <span className="text-[9px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function LeadCardGrid({ leads, onLeadClick, onMoveStage, allStages, processoCounts = {} }: LeadCardGridProps) {
  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum lead encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros ou adicione um novo lead</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
            onMoveStage={onMoveStage}
            allStages={allStages}
            processoCount={processoCounts[lead.id] || 0}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
