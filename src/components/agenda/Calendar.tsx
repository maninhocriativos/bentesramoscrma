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

// ── Colors matching ADVBOX/Astrea reference ──

// By TIPO (default mode)
function getBarByTipo(c: Compromisso): string {
  const tipo = c.tipo || 'Outro';
  switch (tipo) {
    case 'Audiência': return 'cal-bar-pink';   // pink/hot
    case 'Reunião':   return 'cal-bar-orange'; // orange (Atendimento Presencial)
    case 'Prazo':     return 'cal-bar-amber';  // amber outline
    case 'Tarefa':    return 'cal-bar-green';  // green
    default:          return 'cal-bar-gray';   // gray
  }
}

// By SITUAÇÃO/STATUS
function getBarBySituacao(c: Compromisso): string {
  const st = c.confirmacao_status || 'pendente';
  switch (st) {
    case 'confirmado': return 'cal-bar-green';
    case 'cancelado':  return 'cal-bar-red';
    case 'remarcado':  return 'cal-bar-blue';
    default:           return 'cal-bar-amber'; // pendente
  }
}

function getBarClass(c: Compromisso, mode: ColorMode): string {
  return mode === 'situacao' ? getBarBySituacao(c) : getBarByTipo(c);
}

// Intimação bar style
function getIntimacaoBar(titulo: string): { css: string; outline: boolean } {
  const t = titulo.toLowerCase();
  
  if (t.includes('alvará') || t.includes('alvara'))
    return { css: 'cal-bar-green', outline: false };
  
  if (t.includes('sessão de julgamento') || t.includes('sessao de julgamento'))
    return { css: 'cal-bar-pink', outline: false };
  
  // Outline (document) bars - white bg with amber border
  if (
    t.includes('manifestação') || t.includes('contestação') || t.includes('contrarrazões') ||
    t.includes('réplica') || t.includes('emenda') || t.includes('recurso') ||
    t.includes('embargos') || t.includes('alegações') || t.includes('apelação') ||
    t.includes('agravo') || t.includes('sine die') || t.includes('pagamento') ||
    t.includes('manifestacao') || t.includes('contestacao') || t.includes('contrarrazoes') ||
    t.includes('replica') || t.includes('alegacoes') || t.includes('apelacao')
  ) {
    return { css: 'cal-bar-outline', outline: true };
  }
  
  // Default: orange filled (like Ciência da Sentença, Alerta, etc.)
  return { css: 'cal-bar-orange', outline: false };
}

interface CalendarEvent {
  id: string;
  title: string;
  time?: string;
  type: 'compromisso' | 'intimacao';
  barCss: string;
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
        barCss: getBarClass(c, colorMode),
        original: c,
      });
    });

    // Intimações - group by tipo_intimacao
    const dayIntimacoes = intimacoes.filter(i => {
      const d = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
      return d && isSameDay(parseLocalDate(d), date);
    });

    const intimacaoGroups: Record<string, IntimacaoEvent[]> = {};
    dayIntimacoes.forEach(i => {
      const key = i.tipo_intimacao || i.processo_titulo || 'Intimação';
      if (!intimacaoGroups[key]) intimacaoGroups[key] = [];
      intimacaoGroups[key].push(i);
    });

    Object.entries(intimacaoGroups).forEach(([tipo, items]) => {
      const style = getIntimacaoBar(tipo);
      events.push({
        id: items[0].id,
        title: tipo,
        type: 'intimacao',
        barCss: style.css,
        isOutline: style.outline,
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
      {/* ── CSS for calendar bar colors ── */}
      <style>{`
        .cal-bar-orange { background: #f97316; color: #fff; }
        .cal-bar-pink   { background: #ec4899; color: #fff; }
        .cal-bar-green  { background: #22c55e; color: #fff; }
        .cal-bar-amber  { background: #f59e0b; color: #78350f; }
        .cal-bar-red    { background: #ef4444; color: #fff; }
        .cal-bar-blue   { background: #3b82f6; color: #fff; }
        .cal-bar-gray   { background: #cbd5e1; color: #334155; }
        .cal-bar-outline { background: #fffbeb; color: #92400e; border: 1px solid #f59e0b; }
        .dark .cal-bar-outline { background: rgba(245,158,11,0.1); color: #fbbf24; border-color: rgba(245,158,11,0.4); }
        .cal-grid-border { border-color: #e2c9a0; }
        .dark .cal-grid-border { border-color: rgba(226,201,160,0.2); }
        .cal-header-bg { background: #fef7ed; }
        .dark .cal-header-bg { background: rgba(254,247,237,0.05); }
      `}</style>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center border cal-grid-border rounded-md overflow-hidden bg-card">
            <button
              className="px-2 py-1.5 hover:bg-muted/50 transition-colors border-r cal-grid-border"
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

        <h2 className="text-lg md:text-xl font-semibold text-foreground capitalize tracking-tight">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>

        <div className="inline-flex items-center border cal-grid-border rounded-md overflow-hidden bg-card">
          {([
            { label: 'Mês', value: 'mes' as ViewMode },
            { label: 'Semana', value: 'semana' as ViewMode },
            { label: 'Dia', value: 'dia' as ViewMode },
          ]).map(({ label, value }, i) => (
            <button
              key={value}
              onClick={() => onViewModeChange?.(value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                i < 2 && "border-r cal-grid-border",
                viewMode === value
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
      <div className="bg-card rounded-lg border cal-grid-border overflow-hidden">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 cal-header-bg border-b cal-grid-border">
          {weekDays.map((wd, i) => (
            <div
              key={wd}
              className={cn(
                "py-2.5 text-center text-[11px] font-semibold text-muted-foreground italic tracking-wide",
                i < 6 && "border-r cal-grid-border"
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
                    "min-h-[105px] md:min-h-[128px] border-b cal-grid-border p-[3px] md:p-1 cursor-pointer transition-colors relative",
                    colIdx < 6 && "border-r cal-grid-border",
                    !isCurrentMonth && "bg-muted/8",
                    isCurrentMonth && "hover:bg-amber-50/30 dark:hover:bg-amber-500/5",
                    isCurrentDay && "bg-emerald-50/40 dark:bg-emerald-500/5"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Today green accent */}
                  {isCurrentDay && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500" />
                  )}

                  {/* Day Number - top right */}
                  <div className="flex justify-end mb-0.5 pr-0.5">
                    <span
                      className={cn(
                        "text-[13px] font-semibold leading-none",
                        isCurrentDay && "bg-emerald-500 text-white min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold",
                        !isCurrentDay && isCurrentMonth && "text-foreground/70",
                        !isCurrentMonth && "text-muted-foreground/30"
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
                          "flex items-center gap-[3px] px-1 py-[1.5px] rounded-[3px] text-[10px] md:text-[11px] leading-tight cursor-pointer transition-all hover:brightness-[0.88] overflow-hidden whitespace-nowrap",
                          event.barCss
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (event.original) onEventClick(event.original);
                          else onDayClick(day);
                        }}
                        title={event.title}
                      >
                        {/* Count badge for intimações */}
                        {event.count && event.count > 1 && (
                          <span className={cn(
                            "font-bold text-[9px] shrink-0 min-w-[13px] h-[13px] rounded-full flex items-center justify-center",
                            event.isOutline 
                              ? "bg-amber-500 text-white" 
                              : "bg-white/25"
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
                        
                        {/* Checkmark for read intimações */}
                        {event.hasCheckmark && (
                          <CheckCircle2 className="h-[10px] w-[10px] shrink-0 text-emerald-500" />
                        )}
                        
                        <span className="truncate font-medium">{event.title}</span>
                      </div>
                    ))}
                    {remaining > 0 && (
                      <div className="text-[9px] font-bold px-1 cursor-pointer hover:underline" style={{ color: '#ea580c' }}>
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
