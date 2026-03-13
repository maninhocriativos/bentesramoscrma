import { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';

const TIMEZONE = 'America/Manaus';

const parseLocalDate = (dateString: string): Date => {
  const utcDate = parseISO(dateString);
  return toZonedTime(utcDate, TIMEZONE);
};

type ColorMode = 'tipo' | 'situacao';
type ViewMode = 'mes' | 'semana' | 'dia';

interface CalendarProps {
  compromissos: Compromisso[];
  intimacoes?: IntimacaoEvent[];
  colorMode?: ColorMode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onDayClick: (date: Date) => void;
  onEventClick: (compromisso: Compromisso) => void;
  onStatusChange?: (id: string, newStatus: ConfirmacaoStatus) => void;
}

// ── Color helpers matching reference images ──

// Compromisso bar colors by tipo
function getCompromissoBarStyleByTipo(c: Compromisso): string {
  if (c.tipo === 'Audiência') return 'bg-[#f472b6] text-white'; // pink
  if (c.tipo === 'Reunião') return 'bg-[#60a5fa] text-white'; // blue
  if (c.tipo === 'Tarefa') return 'bg-[#34d399] text-white'; // green
  if (c.tipo === 'Prazo') return 'bg-[#fbbf24] text-[#78350f]'; // amber
  return 'bg-[#e2e8f0] text-[#334155]';
}

// Compromisso bar colors by situação/status
function getCompromissoBarStyleBySituacao(c: Compromisso): string {
  const st = c.confirmacao_status || 'pendente';
  if (st === 'confirmado') return 'bg-[#34d399] text-white'; // green
  if (st === 'cancelado') return 'bg-[#f87171] text-white'; // red
  if (st === 'remarcado') return 'bg-[#60a5fa] text-white'; // blue
  return 'bg-[#fbbf24] text-[#78350f]'; // pendente = amber
}

function getCompromissoBarStyle(c: Compromisso, colorMode: ColorMode): string {
  return colorMode === 'situacao' 
    ? getCompromissoBarStyleBySituacao(c) 
    : getCompromissoBarStyleByTipo(c);
}

// Intimações: determine style based on content
function getIntimacaoBarStyle(tipo: string): { filled: boolean; className: string } {
  const t = tipo.toLowerCase();
  
  // Green filled bars
  if (t.includes('alvará') || t.includes('alvara')) {
    return { filled: true, className: 'bg-[#34d399] text-white' };
  }
  // Pink filled bars  
  if (t.includes('sessão de julgamento') || t.includes('sessao de julgamento') || t.includes('audiência') || t.includes('audiencia')) {
    return { filled: true, className: 'bg-[#f472b6] text-white' };
  }
  // Orange filled bars (main intimações)
  if (t.includes('ciência da sentença') || t.includes('ciencia da sentenca')) {
    return { filled: true, className: 'bg-[#fb923c] text-white' };
  }
  // White/outline bars (document type intimações)
  if (
    t.includes('manifestação') || t.includes('contestação') || t.includes('contrarrazões') ||
    t.includes('réplica') || t.includes('emenda') || t.includes('manifestacao') ||
    t.includes('contestacao') || t.includes('contrarrazoes') || t.includes('replica')
  ) {
    return { filled: false, className: 'bg-white dark:bg-card border border-[#fbbf24]/60 text-[#92400e] dark:text-amber-400' };
  }
  
  // Default: orange filled
  return { filled: true, className: 'bg-[#fb923c] text-white' };
}

interface CalendarEvent {
  id: string;
  title: string;
  time?: string;
  type: 'compromisso' | 'intimacao';
  className: string;
  count?: number;
  isOutline?: boolean;
  original?: Compromisso;
  hasCheckmark?: boolean;
}

export function Calendar({ compromissos, intimacoes = [], colorMode = 'tipo', viewMode = 'mes', onViewModeChange, onDayClick, onEventClick }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });

  const days: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    // Compromissos
    const dayComps = compromissos.filter(c => isSameDay(parseLocalDate(c.data_inicio), date));
    dayComps.forEach(c => {
      const isAudiencia = c.tipo === 'Audiência';
      events.push({
        id: c.id,
        title: c.titulo,
        time: isAudiencia ? format(parseLocalDate(c.data_inicio), 'HH:mm') : undefined,
        type: 'compromisso',
        className: getCompromissoBarStyle(c, colorMode),
        original: c,
      });
    });

    // Intimações - group by tipo_intimacao
    const dayIntimacoes = intimacoes.filter(i => {
      const d = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
      return d && isSameDay(parseLocalDate(d), date);
    });

    // Group intimações by tipo
    const intimacaoGroups: Record<string, IntimacaoEvent[]> = {};
    dayIntimacoes.forEach(i => {
      const key = i.tipo_intimacao || i.processo_titulo || 'Intimação';
      if (!intimacaoGroups[key]) intimacaoGroups[key] = [];
      intimacaoGroups[key].push(i);
    });

    Object.entries(intimacaoGroups).forEach(([tipo, items]) => {
      const style = getIntimacaoBarStyle(tipo);
      events.push({
        id: items[0].id,
        title: tipo,
        type: 'intimacao',
        className: style.className,
        isOutline: !style.filled,
        count: items.length,
        hasCheckmark: items.some(i => i.lida),
      });
    });

    return events;
  };

  const goToToday = () => setCurrentMonth(new Date());
  const rows = Math.ceil(days.length / 7);

  return (
    <div className="space-y-3">
      {/* Navigation Bar - matching reference exactly */}
      <div className="flex items-center justify-between">
        {/* Left: nav arrows + Hoje */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center border border-border/70 rounded-md overflow-hidden bg-card">
            <button
              className="px-2 py-1.5 hover:bg-muted/50 transition-colors border-r border-border/70"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              className="px-2 py-1.5 hover:bg-muted/50 transition-colors"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={goToToday}
            className="text-xs font-bold px-4 h-8 rounded-md"
          >
            Hoje
          </Button>
        </div>

        {/* Center: Month title */}
        <h2 className="text-lg md:text-xl font-semibold text-foreground capitalize tracking-tight">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>

        {/* Right: view toggles */}
        <div className="inline-flex items-center border border-border/70 rounded-md overflow-hidden bg-card">
          {['Mês', 'Semana', 'Dia'].map((label, i) => (
            <button
              key={label}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                i < 2 && "border-r border-border/70",
                label === 'Mês'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-lg border border-border/70 overflow-hidden">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 bg-muted/30 border-b border-border/70">
          {weekDays.map((wd, i) => (
            <div
              key={wd}
              className={cn(
                "py-2 text-center text-[11px] font-semibold text-muted-foreground italic tracking-wide",
                i < 6 && "border-r border-border/40"
              )}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7">
            {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              const events = getEventsForDay(day);
              const maxVisible = 5;
              const visibleEvents = events.slice(0, maxVisible);
              const remaining = events.length - maxVisible;
              const globalIdx = rowIdx * 7 + colIdx;

              return (
                <div
                  key={globalIdx}
                  className={cn(
                    "min-h-[100px] md:min-h-[125px] border-b border-border/40 p-[3px] md:p-1 cursor-pointer transition-colors relative",
                    colIdx < 6 && "border-r border-border/40",
                    !isCurrentMonth && "bg-muted/10",
                    isCurrentMonth && "hover:bg-amber-50/20 dark:hover:bg-amber-500/5",
                    isCurrentDay && "bg-emerald-50/50 dark:bg-emerald-500/5"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Today green bar at top */}
                  {isCurrentDay && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500 rounded-b-sm" />
                  )}

                  {/* Day Number - top right */}
                  <div className="flex justify-end mb-0.5 pr-0.5">
                    <span
                      className={cn(
                        "text-[13px] font-semibold leading-none",
                        isCurrentDay && "bg-emerald-500 text-white min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold",
                        !isCurrentDay && isCurrentMonth && "text-foreground/80",
                        !isCurrentMonth && "text-muted-foreground/40"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-[1px]">
                    {visibleEvents.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-center gap-[3px] px-1 py-[1.5px] rounded-[3px] text-[10px] md:text-[11px] leading-tight cursor-pointer transition-all hover:brightness-[0.92] overflow-hidden",
                          event.className
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (event.original) onEventClick(event.original);
                          else onDayClick(day);
                        }}
                        title={event.title}
                      >
                        {/* Count badge */}
                        {event.count && event.count > 0 && (
                          <span className={cn(
                            "font-bold text-[9px] shrink-0 min-w-[12px] h-[12px] rounded-full flex items-center justify-center",
                            event.isOutline 
                              ? "bg-amber-500 text-white" 
                              : "bg-white/30 text-inherit"
                          )}>
                            {event.count}
                          </span>
                        )}
                        
                        {/* Time for audiências */}
                        {event.time && (
                          <span className="font-bold text-[9px] shrink-0">{event.time}</span>
                        )}
                        
                        {/* Folder icon for outline intimações */}
                        {event.isOutline && (
                          <FileText className="h-[10px] w-[10px] shrink-0 opacity-60" />
                        )}
                        
                        {/* Checkmark for read */}
                        {event.hasCheckmark && (
                          <CheckCircle2 className="h-[10px] w-[10px] shrink-0 text-emerald-500" />
                        )}
                        
                        <span className="truncate font-medium">{event.title}</span>
                      </div>
                    ))}
                    {remaining > 0 && (
                      <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold px-1 cursor-pointer hover:underline">
                        +{remaining} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
