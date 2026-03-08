import { Lead, LeadStatus } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, Eye, MoreHorizontal, CheckCircle, XCircle, Building2, Megaphone, Bot, User } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface LeadsTableRowProps {
  lead: Lead;
  onClick: () => void;
  onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
  allStages: { status: LeadStatus; label: string }[];
}

// Status colors usando tokens do design system (mesma cor da etapa)
const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  'Lead Frio': { text: 'text-stage-frio', bg: 'bg-stage-frio-bg' },
  'Bentes Ramos': { text: 'text-stage-bentes', bg: 'bg-stage-bentes-bg' },
  'Em Atendimento': { text: 'text-stage-atendimento', bg: 'bg-stage-atendimento-bg' },
  'Em Negociação': { text: 'text-stage-negociacao', bg: 'bg-stage-negociacao-bg' },
  'Aguardando Contrato': { text: 'text-stage-aguardando', bg: 'bg-stage-aguardando-bg' },
  'Contrato Assinado': { text: 'text-stage-assinado', bg: 'bg-stage-assinado-bg' },
  'Ganho': { text: 'text-stage-ganho', bg: 'bg-stage-ganho-bg' },
  'Perdido': { text: 'text-stage-perdido', bg: 'bg-stage-perdido-bg' },
};

// Origem colors usando tokens do design system
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
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

// Determinar se é lead Bentes Ramos ou Tráfego
function getLeadLineInfo(lead: Lead): { isBentesRamos: boolean; isTraffic: boolean; isIsa: boolean } {
  const isBentesRamos = lead.linha_whatsapp === 'bentes_ramos_antigo' || 
                        lead.empresa_tag === 'BENTES_RAMOS' ||
                        lead.tipo_origem === 'whatsapp_direto';
  const isTraffic = lead.linha_whatsapp === 'trafego_isa' || 
                    lead.tipo_origem === 'trafego';
  const isIsa = lead.isa_ativa === true || lead.owner_tipo === 'isa';
  return { isBentesRamos, isTraffic, isIsa };
}
 
export function LeadsTableRow({ lead, onClick, onMoveStage, allStages }: LeadsTableRowProps) {
  const navigate = useNavigate();

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/chat?lead_id=${lead.id}`);
  };

  const handleCall = (e: React.MouseEvent) => {
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

  const statusColors = STATUS_COLORS[lead.status || ''] || { text: 'text-muted-foreground', bg: 'bg-muted' };
  const origemColors = ORIGEM_COLORS[lead.origem || ''] || { text: 'text-muted-foreground', bg: 'bg-muted' };

  const lastContact = lead.last_contact_at || lead.updated_at || lead.created_at;

  // Badges de linha
  const { isBentesRamos, isTraffic, isIsa } = getLeadLineInfo(lead);
 
  return (
    <tr 
      className="border-b hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Lead - Sticky */}
      <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <span className="font-medium truncate max-w-[140px]">{lead.nome || 'Sem nome'}</span>
        </div>
      </td>

      {/* Linha WhatsApp Badge - usando tokens */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          {isBentesRamos && (
            <Badge 
              variant="outline" 
              className="text-[10px] font-normal gap-0.5 rounded-full h-[22px] border-linha-escritorio/30 bg-linha-escritorio-bg text-linha-escritorio"
            >
              <Building2 className="h-3 w-3" />
              BR
            </Badge>
          )}
          {isTraffic && (
            <Badge 
              variant="outline" 
              className="text-[10px] font-normal gap-0.5 rounded-full h-[22px] border-linha-trafego/30 bg-linha-trafego-bg text-linha-trafego"
            >
              <Megaphone className="h-3 w-3" />
              ADS
            </Badge>
          )}
          {isIsa && !isBentesRamos && (
            <Badge 
              variant="outline" 
              className="text-[10px] font-normal gap-0.5 rounded-full h-[22px] border-linha-trafego/30 bg-linha-trafego-bg text-linha-trafego"
            >
              <Bot className="h-3 w-3" />
              ISA
            </Badge>
          )}
          {!isIsa && !isBentesRamos && lead.owner_tipo === 'humano' && (
            <Badge 
              variant="outline" 
              className="text-[10px] font-normal gap-0.5 rounded-full h-[22px] border-origem-organico/30 bg-origem-organico-bg text-origem-organico"
            >
              <User className="h-3 w-3" />
            </Badge>
          )}
        </div>
      </td>

      {/* WhatsApp */}
      <td className="px-3 py-3">
        {lead.telefone ? (
          <button 
            onClick={handleCall}
            className="text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            {lead.telefone}
          </button>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Origem - usando tokens */}
      <td className="px-3 py-3">
        {lead.origem ? (
          <Badge 
            variant="secondary" 
            className={cn("text-[10px] font-normal rounded-full h-[22px]", origemColors.bg, origemColors.text)}
          >
            {lead.origem}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      {/* Status - usando tokens (mesma cor da etapa) */}
      <td className="px-3 py-3">
        <Badge 
          variant="secondary" 
          className={cn("text-[10px] font-normal rounded-full h-[22px]", statusColors.bg, statusColors.text)}
        >
          {lead.status || 'Lead Frio'}
        </Badge>
      </td>

      {/* Último contato */}
      <td className="px-3 py-3 text-muted-foreground">
        {formatDistanceToNow(new Date(lastContact), { addSuffix: true, locale: ptBR })}
      </td>

      {/* Valor estimado */}
      <td className="px-3 py-3">
        <span className={cn(lead.valor_causa ? 'text-stage-ganho font-medium' : 'text-muted-foreground')}>
          {formatCurrency(lead.valor_causa)}
        </span>
      </td>

      {/* Ações - Sticky - usando tokens */}
      <td className="sticky right-0 z-10 bg-card group-hover:bg-muted/30 px-3 py-3">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-action-chat hover:bg-action-chat-bg"
            onClick={handleWhatsApp}
            title="Abrir WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-action-view hover:bg-action-view-bg"
            onClick={onClick}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-action-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Mover para etapa</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {allStages.map(stage => (
                    <DropdownMenuItem
                      key={stage.status}
                      onClick={() => onMoveStage(lead.id, stage.status)}
                      disabled={lead.status === stage.status}
                    >
                      {stage.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Ganho')}>
                <CheckCircle className="h-4 w-4 mr-2 text-stage-ganho" />
                Marcar como Ganho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Perdido')}>
                <XCircle className="h-4 w-4 mr-2 text-stage-perdido" />
                Marcar como Perdido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}
