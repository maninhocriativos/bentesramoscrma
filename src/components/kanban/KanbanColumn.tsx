import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';
import { Inbox, Snowflake, MessageSquare, Handshake, FileSignature, CheckCircle2, Trophy, XCircle, Building2 } from 'lucide-react';

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
}> = {
  'Lead Frio': { 
    icon: Snowflake, 
    accentColor: 'bg-slate-400',
    iconColor: 'text-slate-500',
  },
  'Bentes Ramos': { 
    icon: Building2, 
    accentColor: 'bg-indigo-500',
    iconColor: 'text-indigo-500',
  },
  'Em Atendimento': { 
    icon: MessageSquare, 
    accentColor: 'bg-blue-500',
    iconColor: 'text-blue-500',
  },
  'Em Negociação': { 
    icon: Handshake, 
    accentColor: 'bg-cyan-500',
    iconColor: 'text-cyan-500',
  },
  'Aguardando Contrato': { 
    icon: FileSignature, 
    accentColor: 'bg-amber-500',
    iconColor: 'text-amber-500',
  },
  'Contrato Assinado': { 
    icon: CheckCircle2, 
    accentColor: 'bg-emerald-500',
    iconColor: 'text-emerald-500',
  },
  'Ganho': { 
    icon: Trophy, 
    accentColor: 'bg-green-600',
    iconColor: 'text-green-600',
  },
  'Perdido': { 
    icon: XCircle, 
    accentColor: 'bg-red-500',
    iconColor: 'text-red-500',
  },
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

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "kanban-column flex flex-col rounded-2xl overflow-hidden",
        "bg-muted/40 border border-border/50",
        "transition-all duration-200",
        isDragOver && "ring-2 ring-primary/50 bg-primary/5"
      )}
    >
      {/* Column Header */}
      <div className="relative px-3 py-3 bg-card border-b border-border/50">
        {/* Top accent bar */}
        <div className={cn("absolute top-0 left-0 right-0 h-[3px]", config.accentColor)} />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={cn("h-4 w-4 shrink-0", config.iconColor)} />
            <span className="text-xs font-semibold text-foreground truncate">
              {status}
            </span>
          </div>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center",
            "bg-muted text-muted-foreground"
          )}>
            {columnLeads.length}
          </span>
        </div>
      </div>

      {/* Cards Container - no internal scroll */}
      <div className="flex flex-col gap-2 p-2">
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
            "flex flex-col items-center justify-center py-8 px-2",
            "text-muted-foreground/50 border-2 border-dashed rounded-xl",
            "transition-all duration-200",
            isDragOver 
              ? "border-primary/50 bg-primary/5 text-primary" 
              : "border-border/40"
          )}>
            <Inbox className="w-5 h-5 mb-1.5" />
            <span className="text-[11px] font-medium">
              {isDragOver ? 'Solte aqui' : 'Vazio'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
