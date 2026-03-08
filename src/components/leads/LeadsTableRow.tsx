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
  'Lead Frio': { text: 'text-stage-frio', bg: 'bg-stage-frio/8', dot: 'bg-stage-frio' },
  'Bentes Ramos': { text: 'text-stage-bentes', bg: 'bg-stage-bentes/8', dot: 'bg-stage-bentes' },
  'Em Atendimento': { text: 'text-stage-atendimento', bg: 'bg-stage-atendimento/8', dot: 'bg-stage-atendimento' },
  'Em Negociação': { text: 'text-stage-negociacao', bg: 'bg-stage-negociacao/8', dot: 'bg-stage-negociacao' },
  'Aguardando Contrato': { text: 'text-stage-aguardando', bg: 'bg-stage-aguardando/8', dot: 'bg-stage-aguardando' },
  'Contrato Assinado': { text: 'text-stage-assinado', bg: 'bg-stage-assinado/8', dot: 'bg-stage-assinado' },
  'Ganho': { text: 'text-stage-ganho', bg: 'bg-stage-ganho/8', dot: 'bg-stage-ganho' },
  'Perdido': { text: 'text-stage-perdido', bg: 'bg-stage-perdido/8', dot: 'bg-stage-perdido' },
};

const ORIGEM_COLORS: Record<string, { text: string; bg: string }> = {
  'Instagram': { text: 'text-origem-ads', bg: 'bg-origem-ads/8' },
  'Google': { text: 'text-origem-site', bg: 'bg-origem-site/8' },
  'Site': { text: 'text-origem-site', bg: 'bg-origem-site/8' },
  'Indicação': { text: 'text-origem-organico', bg: 'bg-origem-organico/8' },
  'WhatsApp Z-API': { text: 'text-stage-ganho', bg: 'bg-stage-ganho/8' },
  'Tráfego Pago': { text: 'text-origem-ads', bg: 'bg-origem-ads/8' },
  'Escritório': { text: 'text-linha-escritorio', bg: 'bg-linha-escritorio/8' },
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

function getAvatarColor(name: string): string {
  const colors = [
    'bg-stage-frio/12 text-stage-frio',
    'bg-stage-atendimento/12 text-stage-atendimento',
    'bg-stage-negociacao/12 text-stage-negociacao',
    'bg-stage-aguardando/12 text-stage-aguardando',
    'bg-stage-assinado/12 text-stage-assinado',
    'bg-stage-ganho/12 text-stage-ganho',
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
  const origemColors = ORIGEM_COLORS[lead.origem || ''] || { text: 'text-muted-foreground', bg: 'bg-muted/50' };
  const lastContact = lead.last_contact_at || lead.updated_at || lead.created_at;
  const { isBentesRamos, isTraffic, isIsa } = getLeadLineInfo(lead);
  const avatarColor = getAvatarColor(lead.nome || '');

  return (
    <TooltipProvider delayDuration={300}>
      <tr 
        className="group hover:bg-muted/15 transition-colors duration-100 cursor-pointer"
        onClick={onClick}
      >
        {/* Lead - Sticky */}
        <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/15 px-4 py-3 transition-colors">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={cn("text-[10px] font-semibold", avatarColor)}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate max-w-[160px] text-xs leading-tight">
                {lead.nome || 'Sem nome'}
              </p>
              {lead.tipo_acao && (
                <p className="text-[10px] text-muted-foreground truncate max-w-[160px] mt-0.5">
                  {lead.tipo_acao}
                </p>
              )}
            </div>
          </div>
        </td>

        {/* Linha WhatsApp */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            {isTraffic && (
              <Badge 
                variant="outline" 
                className="text-[9px] font-medium gap-0.5 rounded-md h-5 border-linha-trafego/15 bg-linha-trafego/5 text-linha-trafego px-1.5"
              >
                <Megaphone className="h-2.5 w-2.5" />
                ADS
              </Badge>
            )}
            {isIsa && (
              <Badge 
                variant="outline" 
                className="text-[9px] font-medium gap-0.5 rounded-md h-5 border-stage-atendimento/15 bg-stage-atendimento/5 text-stage-atendimento px-1.5"
              >
                <Bot className="h-2.5 w-2.5" />
                ISA
              </Badge>
            )}
            {isBentesRamos && (
              <Badge 
                variant="outline" 
                className="text-[9px] font-medium gap-0.5 rounded-md h-5 border-linha-escritorio/15 bg-linha-escritorio/5 text-linha-escritorio px-1.5"
              >
                <Building2 className="h-2.5 w-2.5" />
                BR
              </Badge>
            )}
            {!isIsa && !isBentesRamos && !isTraffic && lead.owner_tipo === 'humano' && (
              <Badge 
                variant="outline" 
                className="text-[9px] font-medium gap-0.5 rounded-md h-5 border-origem-organico/15 bg-origem-organico/5 text-origem-organico px-1.5"
              >
                <User className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>
        </td>

        {/* Telefone */}
        <td className="px-3 py-3">
          {lead.telefone ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleCopyPhone}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-1 group/phone"
                >
                  <span className="font-mono">{lead.telefone}</span>
                  <Copy className="h-2.5 w-2.5 opacity-0 group-hover/phone:opacity-60 transition-opacity" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copiar telefone</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-[11px] text-muted-foreground/40">—</span>
          )}
        </td>

        {/* Origem */}
        <td className="px-3 py-3">
          {lead.origem ? (
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md inline-flex", origemColors.bg, origemColors.text)}>
              {lead.origem}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/40">—</span>
          )}
        </td>

        {/* Etapa/Status */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColors.dot)} />
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-md", statusColors.bg, statusColors.text)}>
              {lead.status || 'Lead Frio'}
            </span>
          </div>
        </td>

        {/* Último contato */}
        <td className="px-3 py-3">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(lastContact), { addSuffix: false, locale: ptBR })}
          </span>
        </td>

        {/* Valor */}
        <td className="px-3 py-3">
          <span className={cn("text-[11px] font-medium", lead.valor_causa ? 'text-stage-ganho' : 'text-muted-foreground/40')}>
            {formatCurrency(lead.valor_causa)}
          </span>
        </td>

        {/* Ações - Sticky */}
        <td className="sticky right-0 z-10 bg-card group-hover:bg-muted/15 px-3 py-3 transition-colors">
          <div className="flex items-center justify-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-action-chat hover:bg-action-chat/8"
                  onClick={handleWhatsApp}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir chat</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-action-view hover:bg-action-view/8"
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalhes</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-lg" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 text-xs">
                    <ArrowRight className="h-3 w-3" />
                    Mover para etapa
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-lg">
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
                  <CheckCircle className="h-3 w-3 text-stage-ganho" />
                  Marcar como Ganho
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Perdido')} className="text-xs gap-2 text-destructive">
                  <XCircle className="h-3 w-3" />
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
