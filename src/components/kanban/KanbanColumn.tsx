import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  isDragOver?: boolean;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  'Lead Frio': 'bg-slate-500',
  'Em Atendimento': 'bg-blue-500',
  'Aguardando Contrato': 'bg-amber-500',
  'Contrato Assinado': 'bg-emerald-500',
  'Ganho': 'bg-green-600',
  'Perdido': 'bg-red-500',
};

export function KanbanColumn({
  status,
  leads,
  onLeadClick,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: KanbanColumnProps) {
  const columnLeads = leads.filter((lead) => lead.status === status);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "flex flex-col min-w-[280px] max-w-[320px] bg-muted/50 rounded-xl p-3 transition-colors duration-200",
        isDragOver && "bg-accent/20 ring-2 ring-accent/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className={cn("w-3 h-3 rounded-full", STATUS_COLORS[status])} />
        <h3 className="font-semibold text-sm">{status}</h3>
        <span className="ml-auto text-xs bg-background px-2 py-0.5 rounded-full font-medium">
          {columnLeads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[calc(100vh-400px)]">
        {columnLeads.map((lead) => (
          <div
            key={lead.id}
            draggable
            onDragStart={(e) => onDragStart(e, lead)}
          >
            <LeadCard lead={lead} onClick={() => onLeadClick(lead)} />
          </div>
        ))}
        
        {columnLeads.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[100px] text-muted-foreground text-sm">
            Arraste leads aqui
          </div>
        )}
      </div>
    </div>
  );
}
