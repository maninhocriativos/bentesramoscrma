import { Lead, LeadStatus } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, Eye, MoreHorizontal, CheckCircle, XCircle, Building2, Megaphone, Bot, User, ArrowRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface LeadsTableRowProps {
  lead: Lead;
  onClick: () => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
  index?: number;
}

const STATUS_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  'Lead Frio': { text: 'text-stage-frio', bg: 'bg-stage-frio-bg', dot: 'bg-stage-frio' },
  'Bentes Ramos': { text: 'text-stage-bentes', bg: 'bg-stage-bentes-bg', dot: 'bg-stage-bentes' },
  'Em Atendimento': { text: 'text-stage-atendimento', bg: 'bg-stage-atendimento-bg', dot: 'bg-stage-atendimento' },
  'Em Negociação': { text: 'text-stage-negociacao', bg: 'bg-stage-negociacao-bg', dot: 'bg-stage-negociacao' },
  'Aguardando Contrato': { text: 'text-stage-aguardando', bg: 'bg-stage-aguardando-bg', dot: 'bg-stage-aguardando' },
  'Contrato Assinado': { text: 'text-stage-assinado', bg: 'bg-stage-assinado-bg', dot: 'bg-stage-assinado' },
  'Ganho': { text: 'text-stage-ganho', bg: 'bg-stage-ganho-bg', dot: 'bg-stage-ganho' },
  'Perdido': { text: 'text-stage-perdido', bg: 'bg-stage-perdido-bg', dot: 'bg-stage-perdido' },
};

const ORIGEM_COLORS: Record<string, { text: string; bg: string }> = {
  'Instagram': { text: 'text-origem-ads', bg: 'bg-origem-ads-bg' },
  'Google': { text: 'text-origem-site', bg: 'bg-origem-site-bg' },
  'Site': { text: 'text-origem-site', bg: 'bg-origem-site-bg' },
  'Indicação': { text: 'text-origem-organico', bg: 'bg-origem-organico-bg' },
  'WhatsApp Z-API': { text: 'text-stage-ganho', bg: 'bg-stage-ganho-bg' },
  'Tráfego Pago': { text: 'text-origem-ads', bg: 'bg-origem-ads-bg' },
  'Escritório': { text: 'text-linha-escritorio', bg: 'bg-linha-escritorio-bg' },
};

const formatCurrency = (value: number | null): string => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

function getLeadLineInfo(lead: Lead): { isBentesRamos: boolean; isTraffic: boolean; isIsa: boolean } {
  const isBentesRamos = lead.linha_whatsapp === 'bentes_ramos_antigo' || 
                        lead.empresa_tag === 'BENTES_RAMOS' ||
                        lead.tipo_origem === 'whatsapp_direto';
  const isTraffic = lead.linha_whatsapp === 'trafego_isa' || 
                    lead.tipo_origem === 'trafego';
  const isIsa = lead.isa_ativa === true || lead.owner_tipo === 'isa';
  return { isBentesRamos, isTraffic, isIsa };
}

// Avatar color based on lead name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-stage-frio/15 text-stage-frio',
    'bg-stage-atendimento/15 text-stage-atendimento',
    'bg-stage-negociacao/15 text-stage-negociacao',
    'bg-stage-aguardando/15 text-stage-aguardando',
    'bg-stage-assinado/15 text-stage-assinado',
    'bg-stage-ganho/15 text-stage-ganho',
  ];
  const index = (name || '').charCodeAt(0) % colors.length;
  return colors[index];
}

export function LeadsTableRow({ lead, onClick, onMoveStage, allStages, index = 0 }: LeadsTableRowProps) {
  const navigate = useNavigate();

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chat?lead_id=${lead.id}`);
  };

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      navigator.clipboard.writeText(lead.telefone).then(() => {
        import('sonner').then(({ toast }) => toast.success('Telefone copiado!'));
      }).catch(() => {});
    }
  };

  const initials = (lead.nome || 'L')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusColors = STATUS_COLORS[lead.status || ''] || { text: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' };
  const origemColors = ORIGEM_COLORS[lead.origem || ''] || { text: 'text-muted-foreground', bg: 'bg-muted' };
  const lastContact = lead.last_contact_at || lead.updated_at || lead.created_at;
  const { isBentesRamos, isTraffic, isIsa } = getLeadLineInfo(lead);
  const avatarColor = getAvatarColor(lead.nome || '');

  return (
    <TooltipProvider delayDuration={300}>
      <tr 
        className="group hover:bg-muted/20 transition-all duration-150 cursor-pointer"
        onClick={onClick}
        style={{ animationDelay: `${index * 20}ms` }}
      >
        {/* Lead - Sticky */}
        <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/20 px-4 py-3.5 transition-colors">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className={cn("text-xs font-semibold", avatarColor)}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate max-w-[150px] leading-tight">
                {lead.nome || 'Sem nome'}
              </p>
              {lead.email && (
                <p className="text-[10px] text-muted-foreground truncate max-w-[150px] mt-0.5">
                  {lead.email}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Linha WhatsApp */}
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-1">
            {isTraffic && (
              <Badge 
                variant="outline" 
                className="text-[10px] font-medium gap-0.5 rounded-lg h-[22px] border-linha-trafego/20 bg-linha-trafego-bg text-linha-trafego"
              >
                <Megaphone className="h-3 w-3" />
                ADS
              </Badge>
            )}
            {isIsa && (
              <Badge 
                variant="outline" 
                className="text-[10px] font-medium gap-0.5 rounded-lg h-[22px] border-stage-atendimento/20 bg-stage-atendimento-bg text-stage-atendimento"
              >
                <Bot className="h-3 w-3" />
                ISA
              </Badge>
            )}
            {isBentesRamos && (
              <Badge 
                variant="outline" 
                className="text-[10px] font-medium gap-0.5 rounded-lg h-[22px] border-linha-escritorio/20 bg-linha-escritorio-bg text-linha-escritorio"
              >
                <Building2 className="h-3 w-3" />
                BR
              </Badge>
            )}
            {!isIsa && !isBentesRamos && !isTraffic && lead.owner_tipo === 'humano' && (
              <Badge 
                variant="outline" 
                className="text-[10px] font-medium gap-0.5 rounded-lg h-[22px] border-origem-organico/20 bg-origem-organico-bg text-origem-organico"
              >
                <User className="h-3 w-3" />
              </Badge>
            )}
          </div>
        </td>

        {/* Telefone */}
        <td className="px-3 py-3.5">
          {lead.telefone ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleCopyPhone}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-1.5 group/phone"
                >
                  <span>{lead.telefone}</span>
                  <Copy className="h-3 w-3 opacity-0 group-hover/phone:opacity-100 transition-opacity" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copiar telefone</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </td>

        {/* Origem */}
        <td className="px-3 py-3.5">
          {lead.origem ? (
            <Badge 
              variant="secondary" 
              className={cn("text-[10px] font-medium rounded-lg h-[22px] border-0", origemColors.bg, origemColors.text)}
            >
              {lead.origem}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </td>

        {/* Etapa/Status */}
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColors.dot)} />
            <Badge 
              variant="secondary" 
              className={cn("text-[10px] font-medium rounded-lg h-[22px] border-0", statusColors.bg, statusColors.text)}
            >
              {lead.status || 'Lead Frio'}
            </Badge>
          </div>
        </td>

        {/* Último contato */}
        <td className="px-3 py-3.5">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(lastContact), { addSuffix: false, locale: ptBR })}
          </span>
        </td>

        {/* Valor */}
        <td className="px-3 py-3.5">
          <span className={cn("text-xs font-medium", lead.valor_causa ? 'text-stage-ganho' : 'text-muted-foreground/50')}>
            {formatCurrency(lead.valor_causa)}
          </span>
        </td>

        {/* Ações - Sticky */}
        <td className="sticky right-0 z-10 bg-card group-hover:bg-muted/20 px-3 py-3.5 transition-colors">
          <div className="flex items-center justify-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-action-chat hover:bg-action-chat-bg"
                  onClick={handleWhatsApp}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir chat</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-action-view hover:bg-action-view-bg"
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalhes</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-action-menu hover:bg-muted/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <ArrowRight className="h-3.5 w-3.5" />
                    Mover para etapa
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-xl">
                    {allStages.map(stage => (
                      <DropdownMenuItem
                        key={stage.status}
                        onClick={() => onMoveStage(lead.id, stage.status)}
                        disabled={lead.status === stage.status}
                        className="text-xs"
                      >
                        {stage.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Ganho')} className="text-xs gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-stage-ganho" />
                  Marcar como Ganho
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Perdido')} className="text-xs gap-2 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  Marcar como Perdido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    </TooltipProvider>
  );
}
