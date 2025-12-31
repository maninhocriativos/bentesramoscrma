import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface IsaInsight {
  sentimento: 'positivo' | 'neutro' | 'negativo' | null;
  urgencia: 'baixa' | 'media' | 'alta' | 'urgente' | null;
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
}

const STATUS_COLORS: Record<LeadStatus, { 
  bg: string; 
  border: string; 
  indicator: string; 
  gradient: string;
  headerBg: string;
}> = {
  'Lead Frio': { 
    bg: 'bg-slate-50', 
    border: 'border-slate-200', 
    indicator: 'bg-slate-500',
    gradient: 'from-slate-500/10 to-transparent',
    headerBg: 'bg-gradient-to-r from-slate-100 to-slate-50'
  },
  'Em Atendimento': { 
    bg: 'bg-blue-50', 
    border: 'border-blue-200', 
    indicator: 'bg-blue-500',
    gradient: 'from-blue-500/10 to-transparent',
    headerBg: 'bg-gradient-to-r from-blue-100 to-blue-50'
  },
  'Aguardando Contrato': { 
    bg: 'bg-amber-50', 
    border: 'border-amber-200', 
    indicator: 'bg-amber-500',
    gradient: 'from-amber-500/10 to-transparent',
    headerBg: 'bg-gradient-to-r from-amber-100 to-amber-50'
  },
  'Contrato Assinado': { 
    bg: 'bg-emerald-50', 
    border: 'border-emerald-200', 
    indicator: 'bg-emerald-500',
    gradient: 'from-emerald-500/10 to-transparent',
    headerBg: 'bg-gradient-to-r from-emerald-100 to-emerald-50'
  },
  'Ganho': { 
    bg: 'bg-green-50', 
    border: 'border-green-300', 
    indicator: 'bg-green-600',
    gradient: 'from-green-500/15 to-transparent',
    headerBg: 'bg-gradient-to-r from-green-100 to-green-50'
  },
  'Perdido': { 
    bg: 'bg-red-50', 
    border: 'border-red-200', 
    indicator: 'bg-red-500',
    gradient: 'from-red-500/10 to-transparent',
    headerBg: 'bg-gradient-to-r from-red-100 to-red-50'
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
}: KanbanColumnProps) {
  const columnLeads = leads.filter((lead) => lead.status === status);
  const statusStyle = STATUS_COLORS[status];

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "flex flex-col min-w-[340px] w-[340px] rounded-2xl overflow-hidden",
        "bg-card border shadow-soft",
        "transition-all duration-300 ease-out",
        isDragOver && [
          "ring-2 ring-gold/60 shadow-card-hover border-gold/40",
          "kanban-column-drag-over scale-[1.02]"
        ]
      )}
    >
      {/* Header with gradient */}
      <div className={cn(
        "relative flex items-center gap-3 px-4 py-3.5 border-b",
        statusStyle.headerBg, statusStyle.border
      )}>
        {/* Indicator dot */}
        <div className={cn(
          "w-3 h-3 rounded-full shrink-0 transition-transform duration-200",
          statusStyle.indicator,
          isDragOver && "scale-125"
        )} />
        
        <h3 className="font-semibold text-sm text-foreground flex-1">{status}</h3>
        
        {/* Count badge */}
        <span className={cn(
          "text-xs px-2.5 py-1 rounded-full font-semibold",
          "bg-primary text-primary-foreground",
          "shadow-sm transition-all duration-300",
          isDragOver && "scale-110 shadow-md"
        )}>
          {columnLeads.length}
        </span>
      </div>

      {/* Cards Container with gradient fade */}
      <div className={cn(
        "relative flex flex-col gap-3 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]",
        "bg-gradient-to-b", statusStyle.gradient
      )}>
        {columnLeads.map((lead, index) => (
          <div
            key={lead.id}
            draggable
            onDragStart={(e) => {
              e.currentTarget.classList.add('kanban-card-dragging');
              onDragStart(e, lead);
            }}
            onDragEnd={(e) => {
              e.currentTarget.classList.remove('kanban-card-dragging');
              e.currentTarget.classList.add('kanban-card-dropped');
              setTimeout(() => {
                e.currentTarget?.classList.remove('kanban-card-dropped');
              }, 700);
              onDragEnd(e);
            }}
            style={{ animationDelay: `${index * 50}ms` }}
            className="kanban-card-wrapper animate-fade-in cursor-grab active:cursor-grabbing"
          >
            <LeadCard lead={lead} onClick={() => onLeadClick(lead)} isaInsight={isaInsights[lead.id]} />
          </div>
        ))}
        
        {columnLeads.length === 0 && (
          <div className={cn(
            "flex-1 flex flex-col items-center justify-center min-h-[150px]",
            "text-muted-foreground border-2 border-dashed border-border/60 rounded-xl",
            "bg-card/50 backdrop-blur-sm",
            "transition-all duration-300",
            isDragOver && "border-gold/50 bg-gold/5"
          )}>
            <Inbox className={cn(
              "w-8 h-8 mb-2 opacity-40",
              isDragOver && "opacity-60 text-gold"
            )} />
            <span className="text-sm text-center px-4">
              {isDragOver ? 'Solte aqui!' : 'Arraste leads para cá'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
