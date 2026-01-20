import { useState, useEffect, useRef } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { LeadFollowupInfo } from '@/hooks/useLeadFollowups';

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
  leadFollowups?: Record<string, LeadFollowupInfo>;
}

const STATUS_STYLES: Record<LeadStatus, { dot: string; accent: string }> = {
  'Lead Frio': { dot: 'bg-slate-400', accent: 'border-t-slate-400' },
  'Em Atendimento': { dot: 'bg-blue-500', accent: 'border-t-blue-500' },
  'Em Negociação': { dot: 'bg-cyan-500', accent: 'border-t-cyan-500' },
  'Aguardando Contrato': { dot: 'bg-amber-500', accent: 'border-t-amber-500' },
  'Contrato Assinado': { dot: 'bg-emerald-500', accent: 'border-t-emerald-500' },
  'Ganho': { dot: 'bg-green-600', accent: 'border-t-green-600' },
  'Perdido': { dot: 'bg-red-500', accent: 'border-t-red-500' },
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
  leadFollowups = {},
}: KanbanColumnProps) {
  const columnLeads = leads.filter((lead) => lead.status === status);
  const style = STATUS_STYLES[status];
  
  const [showCountPulse, setShowCountPulse] = useState(false);
  const prevCountRef = useRef(columnLeads.length);
  
  useEffect(() => {
    if (prevCountRef.current !== columnLeads.length) {
      setShowCountPulse(true);
      const timer = setTimeout(() => setShowCountPulse(false), 1000);
      prevCountRef.current = columnLeads.length;
      return () => clearTimeout(timer);
    }
  }, [columnLeads.length]);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "flex flex-col rounded-xl overflow-hidden",
        "bg-muted/30 border border-border/50",
        "min-w-[240px] w-[240px] lg:min-w-[260px] lg:w-[260px]",
        "transition-all duration-200",
        "border-t-2",
        style.accent,
        isDragOver && "ring-2 ring-primary/40 bg-primary/5"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card/50">
        <div className={cn("w-2 h-2 rounded-full shrink-0", style.dot)} />
        <h3 className="font-medium text-xs text-foreground flex-1 truncate">
          {status}
        </h3>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center",
          "bg-foreground/10 text-foreground",
          showCountPulse && "animate-pulse ring-2 ring-primary/50"
        )}>
          {columnLeads.length}
        </span>
      </div>

      {/* Cards */}
      <div className={cn(
        "flex flex-col gap-2 p-2 flex-1 overflow-y-auto",
        "max-h-[calc(100vh-280px)]"
      )}>
        {columnLeads.map((lead, index) => (
          <div
            key={lead.id}
            draggable
            onDragStart={(e) => onDragStart(e, lead)}
            onDragEnd={onDragEnd}
            style={{ animationDelay: `${index * 30}ms` }}
            className="animate-fade-in cursor-grab active:cursor-grabbing"
          >
            <LeadCard 
              lead={lead} 
              onClick={() => onLeadClick(lead)} 
              isaInsight={isaInsights[lead.id]} 
              leadExtra={leadExtras[lead.id]}
              followupInfo={leadFollowups[lead.id]}
            />
          </div>
        ))}
        
        {columnLeads.length === 0 && (
          <div className={cn(
            "flex-1 flex flex-col items-center justify-center min-h-[120px]",
            "text-muted-foreground/60 border-2 border-dashed border-border/40 rounded-lg",
            isDragOver && "border-primary/40 bg-primary/5"
          )}>
            <Inbox className="w-6 h-6 mb-1.5" />
            <span className="text-xs">
              {isDragOver ? 'Solte aqui' : 'Vazio'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
