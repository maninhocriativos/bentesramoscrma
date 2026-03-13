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
  addWeeks,
  subWeeks,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';

const TIMEZONE = 'America/Manaus';
const parseLocalDate = (dateString: string): Date => toZonedTime(parseISO(dateString), TIMEZONE);

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

const BAR_COLORS = {
  green:   { background: '#22c55e', color: '#fff' },
  orange:  { background: '#f97316', color: '#fff' },
  pink:    { background: '#ec4899', color: '#fff' },
  amber:   { background: '#f59e0b', color: '#78350f' },
  red:     { background: '#ef4444', color: '#fff' },
  blue:    { background: '#3b82f6', color: '#fff' },
  gray:    { background: '#cbd5e1', color: '#334155' },
  outline: { background: '#fffbeb', color: '#92400e', border: '1px solid #f59e0b' },
} as const;

type BarKey = keyof typeof BAR_COLORS;

function getBarByTipo(c: Compromisso): BarKey {
  switch (c.tipo) {
    case 'Audiência': return 'pink';
    case 'Reunião':   return 'orange';
    case 'Prazo':     return 'amber';
    case 'Tarefa':    return 'green';
    default:          return 'gray';
  }
}

function getBarBySituacao(c: Compromisso): BarKey {
  switch (c.confirmacao_status || 'pendente') {
    case 'confirmado': return 'green';
    case 'cancelado':  return 'red';
    case 'remarcado':  return 'blue';
    default:           return 'amber';
  }
}

function getIntimacaoBarKey(titulo: string): { key: BarKey; isOutline: boolean } {
  const t = titulo.toLowerCase();
  if (t.includes('alvará') || t.includes('alvara'))
    return { key: 'green', isOutline: false };
  if (t.includes('sessão de julgamento') || t.includes('sessao de julgamento'))
    return { key: 'pink', isOutline: false };
  if (t.includes('ciência da sentença') || t.includes('ciencia da sentenca'))
    return { key: 'orange', isOutline: false };
  if (
    t.includes('manifestação') || t.includes('contestação') || t.includes('contrarrazões') ||
    t.includes('réplica') || t.includes('emenda') || t.includes('recurso') ||
    t.includes('embargos') || t.includes('alegações') || t.includes('apelação') ||
    t.includes('agravo') || t.includes('sine die') || t.includes('pagamento') ||
    t.includes('manifestacao') || t.includes('contestacao') || t.includes('contrarrazoes') ||
    t.includes('replica') || t.includes('alegacoes') || t.includes('apelacao')
  ) return { key: 'outline', isOutline: true };
  return { key: 'orange', isOutline: false };
}

interface CalendarEvent {
  id: string;
  title: string;
  time?: string;
  type: 'compromisso' | 'intimacao';
  barKey: BarKey;
  count?: number;
  isOutline?: boolean;
  original?: Compromisso;
  hasCheckmark?: boolean;
}

const BORDER = '#d4a574';
const HEADER_BG = '#fdf4e8';

// Hours for week/day views
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

export function Calendar({ compromissos, intimacoes = [], colorMode = 'tipo', viewMode = 'mes', onViewModeChange, onDayClick, onEventClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const dayComps = compromissos.filter(c => isSameDay(parseLocalDate(c.data_inicio), date));
    dayComps.forEach(c => {
      events.push({
        id: c.id,
        title: c.titulo,
        time: format(parseLocalDate(c.data_inicio), 'HH:mm'),
        type: 'compromisso',
        barKey: colorMode === 'situacao' ? getBarBySituacao(c) : getBarByTipo(c),
        original: c,
      });
    });
    const dayInt = intimacoes.filter(i => {
      const dt = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
      return dt && isSameDay(parseLocalDate(dt), date);
    });
    const groups: Record<string, IntimacaoEvent[]> = {};
    dayInt.forEach(i => {
      const k = i.tipo_intimacao || i.processo_titulo || 'Intimação';
      if (!groups[k]) groups[k] = [];
      groups[k].push(i);
    });
    Object.entries(groups).forEach(([tipo, items]) => {
      const { key, isOutline } = getIntimacaoBarKey(tipo);
      events.push({
        id: items[0].id, title: tipo, type: 'intimacao',
        barKey: key, isOutline, count: items.length,
        hasCheckmark: items.some(i => i.lida),
      });
    });
    return events;
  };

  const getEventsForHour = (date: Date, hour: number): CalendarEvent[] => {
    return getEventsForDay(date).filter(ev => {
      if (!ev.time) return hour === 7; // no-time events at top
      const h = parseInt(ev.time.split(':')[0], 10);
      return h === hour;
    });
  };

  // Navigation
  const goToToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    if (viewMode === 'mes') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'semana') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const goNext = () => {
    if (viewMode === 'mes') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'semana') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  // Title
  const getTitle = () => {
    if (viewMode === 'dia') return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === 'semana') {
      const ws = startOfWeek(currentDate, { locale: ptBR });
      const we = endOfWeek(currentDate, { locale: ptBR });
      return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, "d MMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  // Event bar renderer
  const renderEventBar = (ev: CalendarEvent, day: Date, compact = false) => {
    const colors = BAR_COLORS[ev.barKey];
    return (
      <div
        key={ev.id}
        className="flex items-center gap-1 rounded-[3px] cursor-pointer overflow-hidden whitespace-nowrap"
        style={{
          background: colors.background,
          color: colors.color,
          border: 'border' in colors ? (colors as any).border : 'none',
          padding: compact ? '1px 4px' : '2px 5px',
          fontSize: compact ? 10 : 11,
          lineHeight: '16px',
          fontWeight: 500,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (ev.original) onEventClick(ev.original);
          else onDayClick(day);
        }}
        title={ev.title}
      >
        {ev.count && ev.count > 0 && (
          <span style={{ fontWeight: 700, fontSize: 10, opacity: ev.isOutline ? 1 : 0.85 }}>{ev.count}</span>
        )}
        {ev.time && <span style={{ fontWeight: 700, fontSize: 10 }}>{ev.time}</span>}
        {ev.isOutline && <FileText style={{ width: 10, height: 10, opacity: 0.6, flexShrink: 0 }} />}
        {ev.time && !compact && <CalendarDays style={{ width: 10, height: 10, opacity: 0.7, flexShrink: 0 }} />}
        {ev.hasCheckmark && <CheckCircle2 style={{ width: 10, height: 10, color: '#22c55e', flexShrink: 0 }} />}
        <span className="truncate">{ev.title}</span>
      </div>
    );
  };

  // ── MONTH VIEW ──
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });
    const days: Date[] = [];
    let d = startDate;
    while (d <= endDate) { days.push(d); d = addDays(d, 1); }
    const rows = Math.ceil(days.length / 7);

    return (
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <div className="grid grid-cols-7" style={{ background: HEADER_BG, borderBottom: `1px solid ${BORDER}` }}>
          {weekDays.map((wd, i) => (
            <div key={wd} className="py-2 text-center text-[11px] font-semibold text-muted-foreground italic tracking-wide"
              style={i < 6 ? { borderRight: `1px solid ${BORDER}` } : undefined}>
              {wd}
            </div>
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7">
            {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
              const isCurMonth = isSameMonth(day, currentDate);
              const isCurDay = isToday(day);
              const events = getEventsForDay(day);
              const maxVis = 5;
              const visible = events.slice(0, maxVis);
              const extra = events.length - maxVis;
              return (
                <div key={colIdx}
                  className={cn("min-h-[108px] md:min-h-[130px] cursor-pointer transition-colors relative bg-card",
                    !isCurMonth && "opacity-30",
                    isCurMonth && !isCurDay && "hover:bg-amber-50/40 dark:hover:bg-amber-500/5",
                    isCurDay && "bg-emerald-50/50 dark:bg-emerald-500/5"
                  )}
                  style={{ borderBottom: `1px solid ${BORDER}`, ...(colIdx < 6 ? { borderRight: `1px solid ${BORDER}` } : {}), padding: '3px 4px' }}
                  onClick={() => onDayClick(day)}
                >
                  {isCurDay && <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: '#22c55e' }} />}
                  <div className="flex justify-end mb-[2px]">
                    {isCurDay ? (
                      <span className="flex items-center justify-center text-[11px] font-bold rounded-full"
                        style={{ background: '#22c55e', color: '#fff', width: 22, height: 22 }}>{format(day, 'd')}</span>
                    ) : (
                      <span className={cn("text-[13px] font-semibold", isCurMonth ? "text-foreground/70" : "text-muted-foreground/30")}>{format(day, 'd')}</span>
                    )}
                  </div>
                  <div className="space-y-[2px]">
                    {visible.map(ev => renderEventBar(ev, day))}
                    {extra > 0 && (
                      <div className="cursor-pointer hover:underline" style={{ fontSize: 9, fontWeight: 700, color: '#ea580c', paddingLeft: 4 }}>+{extra} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ── WEEK VIEW (column-based, like Google Calendar) ──
  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { locale: ptBR });
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

    return (
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        {/* Sticky header */}
        <div className="grid grid-cols-7" style={{ background: HEADER_BG, borderBottom: `1px solid ${BORDER}` }}>
          {weekDates.map((d, i) => {
            const isCurDay = isToday(d);
            return (
              <div key={i}
                className={cn("py-3 text-center cursor-pointer transition-colors",
                  isCurDay && "bg-emerald-50/60 dark:bg-emerald-500/5"
                )}
                style={i < 6 ? { borderRight: `1px solid ${BORDER}` } : undefined}
                onClick={() => onDayClick(d)}
              >
                <div className="text-[10px] font-semibold text-muted-foreground italic uppercase tracking-wide">
                  {weekDays[d.getDay()]}
                </div>
                {isCurDay ? (
                  <span className="inline-flex items-center justify-center text-sm font-bold rounded-full mt-1"
                    style={{ background: '#22c55e', color: '#fff', width: 28, height: 28 }}>
                    {format(d, 'd')}
                  </span>
                ) : (
                  <div className="text-lg font-bold mt-0.5 text-foreground/70">
                    {format(d, 'd')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Day columns with all events */}
        <div className="grid grid-cols-7">
          {weekDates.map((d, i) => {
            const isCurDay = isToday(d);
            const events = getEventsForDay(d);
            const maxVis = 8;
            const visible = events.slice(0, maxVis);
            const extra = events.length - maxVis;

            return (
              <div key={i}
                className={cn(
                  "min-h-[320px] p-1.5 cursor-pointer transition-colors bg-card",
                  isCurDay && "bg-emerald-50/30 dark:bg-emerald-500/3",
                  !isCurDay && "hover:bg-amber-50/20 dark:hover:bg-amber-500/3",
                )}
                style={i < 6 ? { borderRight: `1px solid ${BORDER}` } : undefined}
                onClick={() => onDayClick(d)}
              >
                <div className="space-y-[3px]">
                  {visible.map(ev => {
                    const colors = BAR_COLORS[ev.barKey];
                    return (
                      <div key={ev.id}
                        className="flex items-start gap-1 rounded-md cursor-pointer overflow-hidden"
                        style={{
                          background: colors.background,
                          color: colors.color,
                          border: 'border' in colors ? (colors as any).border : 'none',
                          padding: '4px 6px',
                          fontSize: 11,
                          lineHeight: '15px',
                          fontWeight: 500,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ev.original) onEventClick(ev.original);
                          else onDayClick(d);
                        }}
                        title={ev.title}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          {ev.time && (
                            <span style={{ fontWeight: 700, fontSize: 10, opacity: 0.9 }}>{ev.time}</span>
                          )}
                          <span className="truncate">{ev.title}</span>
                        </div>
                        {ev.count && ev.count > 1 && (
                          <span className="shrink-0 rounded-full text-[9px] font-bold px-1.5 py-0.5"
                            style={{ background: 'rgba(255,255,255,0.25)' }}>
                            {ev.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {extra > 0 && (
                    <div className="cursor-pointer hover:underline text-center pt-1"
                      style={{ fontSize: 10, fontWeight: 700, color: '#ea580c' }}>
                      +{extra} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── DAY VIEW ──
  const renderDayView = () => {
    const isCurDay = isToday(currentDate);

    return (
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        {/* Header */}
        <div className="grid grid-cols-[60px_1fr]" style={{ background: HEADER_BG, borderBottom: `1px solid ${BORDER}` }}>
          <div className="py-2 text-center text-[10px] text-muted-foreground" style={{ borderRight: `1px solid ${BORDER}` }}>Hora</div>
          <div className={cn("py-3 text-center", isCurDay && "bg-emerald-50/50 dark:bg-emerald-500/5")}>
            <div className="text-[11px] font-semibold text-muted-foreground italic capitalize">
              {format(currentDate, 'EEEE', { locale: ptBR })}
            </div>
            <div className={cn("text-lg font-bold mt-0.5", isCurDay ? "text-emerald-600" : "text-foreground/70")}>
              {format(currentDate, 'd')}
            </div>
          </div>
        </div>
        {/* Time slots */}
        <div className="max-h-[600px] overflow-y-auto">
          {HOURS.map(hour => {
            const hourEvents = getEventsForHour(currentDate, hour);
            return (
              <div key={hour} className="grid grid-cols-[60px_1fr]" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="py-3 px-1 text-[11px] text-muted-foreground text-right pr-2 font-medium"
                  style={{ borderRight: `1px solid ${BORDER}` }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div
                  className={cn("min-h-[56px] p-1 cursor-pointer hover:bg-amber-50/30 dark:hover:bg-amber-500/5 transition-colors",
                    isCurDay && "bg-emerald-50/20 dark:bg-emerald-500/3"
                  )}
                  onClick={() => onDayClick(currentDate)}
                >
                  <div className="space-y-[2px]">
                    {hourEvents.map(ev => renderEventBar(ev, currentDate))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md overflow-hidden bg-card" style={{ border: `1px solid ${BORDER}` }}>
            <button className="px-2.5 py-1.5 hover:bg-muted/50 transition-colors" style={{ borderRight: `1px solid ${BORDER}` }}
              onClick={goPrev}>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="px-2.5 py-1.5 hover:bg-muted/50 transition-colors" onClick={goNext}>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <Button variant="default" size="sm" onClick={goToToday} className="text-xs font-bold px-4 h-8 rounded-md">
            Hoje
          </Button>
        </div>

        <h2 className="text-lg md:text-xl font-semibold text-foreground capitalize tracking-tight">
          {getTitle()}
        </h2>

        <div className="inline-flex items-center rounded-md overflow-hidden bg-card" style={{ border: `1px solid ${BORDER}` }}>
          {([
            { label: 'Mês', value: 'mes' as ViewMode },
            { label: 'Semana', value: 'semana' as ViewMode },
            { label: 'Dia', value: 'dia' as ViewMode },
          ]).map(({ label, value }, i) => (
            <button key={value} onClick={() => onViewModeChange?.(value)}
              className={cn("px-3 py-1.5 text-xs font-medium transition-all",
                viewMode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
              )}
              style={i < 2 ? { borderRight: `1px solid ${BORDER}` } : undefined}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {viewMode === 'mes' && renderMonthView()}
      {viewMode === 'semana' && renderWeekView()}
      {viewMode === 'dia' && renderDayView()}
    </div>
  );
}
