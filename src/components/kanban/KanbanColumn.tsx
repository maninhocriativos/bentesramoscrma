import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  isDragOver?: boolean;
}

const STATUS_COLORS: Record<LeadStatus, { bg: string; border: string; indicator: string }> = {
  'Lead Frio': { bg: 'bg-slate-50', border: 'border-slate-300', indicator: 'bg-slate-500' },
  'Em Atendimento': { bg: 'bg-blue-50', border: 'border-blue-300', indicator: 'bg-blue-500' },
  'Aguardando Contrato': { bg: 'bg-amber-50', border: 'border-amber-300', indicator: 'bg-amber-500' },
  'Contrato Assinado': { bg: 'bg-emerald-50', border: 'border-emerald-300', indicator: 'bg-emerald-500' },
  'Ganho': { bg: 'bg-green-50', border: 'border-green-400', indicator: 'bg-green-600' },
  'Perdido': { bg: 'bg-red-50', border: 'border-red-300', indicator: 'bg-red-500' },
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
}: KanbanColumnProps) {
  const columnLeads = leads.filter((lead) => lead.status === status);
  const statusStyle = STATUS_COLORS[status];

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "flex flex-col min-w-[320px] w-[320px] rounded-xl transition-all duration-300 overflow-hidden",
        "bg-card border shadow-soft",
        isDragOver && "ring-2 ring-gold/60 shadow-enterprise border-gold/40 kanban-column-drag-over scale-[1.01]"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-3 border-b",
        statusStyle.bg, statusStyle.border
      )}>
        <div className={cn("w-2.5 h-2.5 rounded-full", statusStyle.indicator)} />
        <h3 className="font-semibold text-sm text-foreground flex-1">{status}</h3>
        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
          {columnLeads.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] bg-muted/30">
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
              }, 600);
              onDragEnd(e);
            }}
            style={{ animationDelay: `${index * 40}ms` }}
            className="kanban-card-wrapper animate-fade-in cursor-grab active:cursor-grabbing"
          >
            <LeadCard lead={lead} onClick={() => onLeadClick(lead)} />
          </div>
        ))}
        
        {columnLeads.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[120px] text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg bg-card/50">
            <span className="text-center px-4">
              Arraste leads aqui
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
