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

const STATUS_COLORS: Record<LeadStatus, { bg: string; border: string }> = {
  'Lead Frio': { bg: 'bg-slate-500', border: 'border-slate-400' },
  'Em Atendimento': { bg: 'bg-blue-500', border: 'border-blue-400' },
  'Aguardando Contrato': { bg: 'bg-amber-500', border: 'border-amber-400' },
  'Contrato Assinado': { bg: 'bg-emerald-500', border: 'border-emerald-400' },
  'Ganho': { bg: 'bg-green-600', border: 'border-green-500' },
  'Perdido': { bg: 'bg-red-500', border: 'border-red-400' },
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
        "flex flex-col min-w-[280px] max-w-[320px] rounded-xl transition-all duration-200 overflow-hidden shadow-soft",
        "bg-card border-t-4",
        statusStyle.border,
        isDragOver && "ring-2 ring-gold/50 shadow-enterprise"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/50 to-transparent border-b">
        <div className={cn("w-2.5 h-2.5 rounded-full", statusStyle.bg)} />
        <h3 className="font-semibold text-sm">{status}</h3>
        <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
          {columnLeads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-400px)] bg-muted/20">
        {columnLeads.map((lead, index) => (
          <div
            key={lead.id}
            draggable
            onDragStart={(e) => onDragStart(e, lead)}
            onDragEnd={onDragEnd}
            style={{ animationDelay: `${index * 50}ms` }}
            className="animate-fade-in cursor-grab active:cursor-grabbing"
          >
            <LeadCard lead={lead} onClick={() => onLeadClick(lead)} />
          </div>
        ))}
        
        {columnLeads.length === 0 && (
          <div className="flex-1 flex items-center justify-center min-h-[100px] text-muted-foreground text-sm border-2 border-dashed border-muted rounded-lg">
            Arraste leads aqui
          </div>
        )}
      </div>
    </div>
  );
}
