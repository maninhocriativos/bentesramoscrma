import { useState, useEffect, useRef } from 'react';
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
  gradient: string; 
  dot: string;
  headerBg: string;
  countBg: string;
}> = {
  'Lead Frio': { 
    icon: Snowflake, 
    gradient: 'from-slate-500/10 to-transparent',
    dot: 'bg-slate-400',
    headerBg: 'bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900',
    countBg: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
  },
  'Bentes Ramos': { 
    icon: Building2, 
    gradient: 'from-indigo-500/10 to-transparent',
    dot: 'bg-indigo-500',
    headerBg: 'bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-900/10',
    countBg: 'bg-indigo-200 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200'
  },
  'Em Atendimento': { 
    icon: MessageSquare, 
    gradient: 'from-blue-500/10 to-transparent',
    dot: 'bg-blue-500',
    headerBg: 'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10',
    countBg: 'bg-blue-200 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
  },
  'Em Negociação': { 
    icon: Handshake, 
    gradient: 'from-cyan-500/10 to-transparent',
    dot: 'bg-cyan-500',
    headerBg: 'bg-gradient-to-r from-cyan-100 to-cyan-50 dark:from-cyan-900/30 dark:to-cyan-900/10',
    countBg: 'bg-cyan-200 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-200'
  },
  'Aguardando Contrato': { 
    icon: FileSignature, 
    gradient: 'from-amber-500/10 to-transparent',
    dot: 'bg-amber-500',
    headerBg: 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10',
    countBg: 'bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-200'
  },
  'Contrato Assinado': { 
    icon: CheckCircle2, 
    gradient: 'from-emerald-500/10 to-transparent',
    dot: 'bg-emerald-500',
    headerBg: 'bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10',
    countBg: 'bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200'
  },
  'Ganho': { 
    icon: Trophy, 
    gradient: 'from-green-500/15 to-transparent',
    dot: 'bg-green-600',
    headerBg: 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-900/10',
    countBg: 'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200'
  },
  'Perdido': { 
    icon: XCircle, 
    gradient: 'from-red-500/10 to-transparent',
    dot: 'bg-red-500',
    headerBg: 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/10',
    countBg: 'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200'
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

  // Calculate column value
  const totalValue = columnLeads.reduce((sum, lead) => sum + (lead.valor_causa || 0), 0);
  const formattedValue = totalValue >= 1000 
    ? `R$ ${(totalValue / 1000).toFixed(0)}k` 
    : totalValue > 0 
      ? `R$ ${totalValue}` 
      : null;

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "flex flex-col rounded-xl overflow-hidden h-full",
        "bg-card/50 backdrop-blur-sm border border-border/60",
        "w-full min-w-0",
        "transition-all duration-200 shadow-soft",
        isDragOver && "ring-2 ring-gold/50 shadow-glow-gold kanban-column-drag-over"
      )}
    >
      {/* Header with gradient - compacto */}
      <div className={cn("px-2 py-2", config.headerBg)}>
        <div className="flex items-center gap-1.5">
          <div className={cn("p-1 rounded-md bg-card/80 shadow-sm flex-shrink-0")}>
            <Icon className={cn("w-3 h-3", config.dot.replace('bg-', 'text-'))} />
          </div>
          <h3 className="font-semibold text-[10px] text-foreground truncate flex-1 min-w-0">
            {status}
          </h3>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center flex-shrink-0",
            config.countBg,
            showCountPulse && "animate-pulse ring-2 ring-gold/50"
          )}>
            {columnLeads.length}
          </span>
        </div>
        {formattedValue && (
          <p className="text-[9px] text-muted-foreground font-medium mt-0.5 pl-6 truncate">
            {formattedValue}
          </p>
        )}
      </div>

      {/* Cards with subtle gradient background */}
      <div className={cn(
        "flex flex-col gap-1.5 p-1.5 flex-1 overflow-y-auto",
        "max-h-[calc(100vh-280px)]",
        `bg-gradient-to-b ${config.gradient}`
      )}>
        {columnLeads.map((lead, index) => (
          <div
            key={lead.id}
            draggable
            onDragStart={(e) => onDragStart(e, lead)}
            onDragEnd={onDragEnd}
            style={{ animationDelay: `${index * 40}ms` }}
            className="animate-fade-in cursor-grab active:cursor-grabbing"
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
            "flex-1 flex flex-col items-center justify-center min-h-[140px]",
            "text-muted-foreground/50 border-2 border-dashed rounded-xl",
            "transition-all duration-200",
            isDragOver 
              ? "border-gold/50 bg-gold/5 text-gold" 
              : "border-border/40"
          )}>
            <div className={cn(
              "p-3 rounded-full mb-2",
              isDragOver ? "bg-gold/10" : "bg-muted/30"
            )}>
              <Inbox className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">
              {isDragOver ? 'Solte aqui' : 'Nenhum lead'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
