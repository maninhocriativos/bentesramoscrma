import { Lead, LeadStatus } from '@/types/leads';
import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import { Inbox, Snowflake, MessageSquare, Handshake, FileSignature, CheckCircle2, Trophy, XCircle, Building2, DollarSign } from 'lucide-react';

interface IsaInsight {
  sentimento: 'positivo' | 'neutro' | 'negativo' | null;
  urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
}

interface LeadExtra {
  leadId: string;
  ultimaInteracao: { resumo: string; data: string; } | null;
  temAgendamento: boolean;
  proximoAgendamento: { titulo: string; data: string; } | null;
}

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  isDragOver?: boolean;
  isaInsights?: Record<string, IsaInsight>;
  leadExtras?: Record<string, LeadExtra>;
}

const STATUS_CONFIG: Record<LeadStatus, { 
  icon: React.ElementType; 
  accentColor: string;
  iconColor: string;
  headerBg: string;
}> = {
  'Lead Frio': { 
    icon: Snowflake, 
    accentColor: 'bg-stage-frio',
    iconColor: 'text-stage-frio',
    headerBg: 'bg-stage-frio/5',
  },
  'Bentes Ramos': { 
    icon: Building2, 
    accentColor: 'bg-stage-bentes',
    iconColor: 'text-stage-bentes',
    headerBg: 'bg-stage-bentes/5',
  },
  'Em Atendimento': { 
    icon: MessageSquare, 
    accentColor: 'bg-stage-atendimento',
    iconColor: 'text-stage-atendimento',
    headerBg: 'bg-stage-atendimento/5',
  },
  'Em Negociação': { 
    icon: Handshake, 
    accentColor: 'bg-stage-negociacao',
    iconColor: 'text-stage-negociacao',
    headerBg: 'bg-stage-negociacao/5',
  },
  'Aguardando Contrato': { 
    icon: FileSignature, 
    accentColor: 'bg-stage-aguardando',
    iconColor: 'text-stage-aguardando',
    headerBg: 'bg-stage-aguardando/5',
  },
  'Contrato Assinado': { 
    icon: CheckCircle2, 
    accentColor: 'bg-stage-assinado',
    iconColor: 'text-stage-assinado',
    headerBg: 'bg-stage-assinado/5',
  },
  'Ganho': { 
    icon: Trophy, 
    accentColor: 'bg-stage-ganho',
    iconColor: 'text-stage-ganho',
    headerBg: 'bg-stage-ganho/5',
  },
  'Perdido': { 
    icon: XCircle, 
    accentColor: 'bg-stage-perdido',
    iconColor: 'text-stage-perdido',
    headerBg: 'bg-stage-perdido/5',
  },
};

const formatCurrencyCompact = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  if (value === 0) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

export function KanbanColumn({
  status,
  leads,
  onLeadClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragOver,
  isaInsights = {},
  leadExtras = {},
}: KanbanColumnProps) {
  const columnLeads = leads.filter((lead) => lead.status === status);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const totalValue = columnLeads.reduce((sum, l) => sum + (l.valor_causa || 0), 0);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "kanban-column flex flex-col rounded-xl overflow-hidden",
        "bg-muted/20 border border-border/30",
        "transition-all duration-200",
        isDragOver && "ring-2 ring-primary/40 bg-primary/3"
      )}
    >
      {/* Column Header */}
      <div className={cn("relative px-3 py-2.5 border-b border-border/30", config.headerBg)}>
        {/* Top accent line */}
        <div className={cn("absolute top-0 left-0 right-0 h-[2px]", config.accentColor)} />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", config.iconColor)} />
            <span className="text-[11px] font-semibold text-foreground truncate">
              {status}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center",
              "bg-card/80 text-muted-foreground border border-border/30"
            )}>
              {columnLeads.length}
            </span>
          </div>
        </div>

        {/* Value summary */}
        {totalValue > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
            <DollarSign className="h-2.5 w-2.5" />
            <span className="font-medium">{formatCurrencyCompact(totalValue)}</span>
          </div>
        )}
      </div>

      {/* Cards Container */}
      <div className="flex flex-col gap-1.5 p-1.5">
        {columnLeads.map((lead) => (
          <div
            key={lead.id}
            draggable
            onDragStart={(e) => onDragStart(e, lead)}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing"
          >
            <LeadCard 
              lead={lead} 
              onClick={() => onLeadClick(lead)} 
              isaInsight={isaInsights[lead.id]} 
              leadExtra={leadExtras[lead.id]}
            />
          </div>
        ))}
        
        {columnLeads.length === 0 && (
          <div className={cn(
            "flex flex-col items-center justify-center py-6 px-2",
            "text-muted-foreground/30 border border-dashed rounded-lg",
            "transition-all duration-200",
            isDragOver 
              ? "border-primary/40 bg-primary/3 text-primary/60" 
              : "border-border/30"
          )}>
            <Inbox className="w-4 h-4 mb-1" />
            <span className="text-[10px] font-medium">
              {isDragOver ? 'Solte aqui' : 'Vazio'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
