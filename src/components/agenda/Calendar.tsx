import { useState } from 'react';
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
  addWeeks, subWeeks,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';

const TIMEZONE = 'America/Manaus';
const parseLocalDate = (s: string) => toZonedTime(parseISO(s), TIMEZONE);

type ColorMode = 'tipo' | 'situacao';
type ViewMode  = 'mes' | 'semana' | 'dia';

interface CalendarProps {
  compromissos: Compromisso[];
  intimacoes?: IntimacaoEvent[];
  colorMode?: ColorMode;
  viewMode?: ViewMode;
  onViewModeChange?: (m: ViewMode) => void;
  onDayClick: (d: Date) => void;
  onEventClick: (c: Compromisso) => void;
  onStatusChange?: (id: string, s: ConfirmacaoStatus) => void;
}

// ─── Paleta de eventos ────────────────────────────────────────────────────────
const PALETTE = {
  audiencia:    { bg: '#be185d', text: '#fce7f3', dot: '#f472b6' },
  reuniao:      { bg: '#b45309', text: '#fef3c7', dot: '#fbbf24' },
  prazo:        { bg: '#92400e', text: '#fef3c7', dot: '#f59e0b' },
  tarefa:       { bg: '#065f46', text: '#d1fae5', dot: '#34d399' },
  outro:        { bg: '#374151', text: '#f3f4f6', dot: '#9ca3af' },
  intimacao:    { bg: '#7c3aed', text: '#ede9fe', dot: '#a78bfa' },
  int_prazo:    { bg: '#3d2b1f', text: '#c9a96e', dot: '#c9a96e', border: '1px solid #c9a96e40' },
  confirmado:   { bg: '#065f46', text: '#d1fae5', dot: '#34d399' },
  cancelado:    { bg: '#7f1d1d', text: '#fee2e2', dot: '#f87171' },
  remarcado:    { bg: '#1e3a5f', text: '#dbeafe', dot: '#60a5fa' },
  pendente:     { bg: '#78350f', text: '#fef3c7', dot: '#fbbf24' },
} as const;

type PaletteKey = keyof typeof PALETTE;

function getPaletteByTipo(c: Compromisso): PaletteKey {
  switch (c.tipo) {
    case 'Audiência': return 'audiencia';
    case 'Reunião':   return 'reuniao';
    case 'Prazo':     return 'prazo';
    case 'Tarefa':    return 'tarefa';
    default:          return 'outro';
  }
}

function getPaletteBySituacao(c: Compromisso): PaletteKey {
  switch (c.confirmacao_status || 'pendente') {
    case 'confirmado': return 'confirmado';
    case 'cancelado':  return 'cancelado';
    case 'remarcado':  return 'remarcado';
    default:           return 'pendente';
  }
}

function getIntimacaoPalette(titulo: string): PaletteKey {
  const t = titulo.toLowerCase();
  if (
    t.includes('manifestação') || t.includes('contestação') || t.includes('contrarrazões') ||
    t.includes('réplica') || t.includes('emenda') || t.includes('recurso') ||
    t.includes('embargos') || t.includes('alegações') || t.includes('apelação') ||
    t.includes('agravo') || t.includes('sine die') || t.includes('pagamento') ||
    t.includes('manifestacao') || t.includes('contestacao') || t.includes('contrarrazoes') ||
    t.includes('replica') || t.includes('alegacoes') || t.includes('apelacao')
  ) return 'int_prazo';
  if (t.includes('sessão') || t.includes('sessao') || t.includes('julgamento')) return 'audiencia';
  if (t.includes('alvará') || t.includes('alvara') || t.includes('sentença') || t.includes('sentenca')) return 'tarefa';
  return 'intimacao';
}

interface CalEvent {
  id: string;
  title: string;
  time?: string;
  paletteKey: PaletteKey;
  count?: number;
  hasBorder?: boolean;
  original?: Compromisso;
  isIntimacao?: boolean;
}

const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export function Calendar({
  compromissos, intimacoes = [], colorMode = 'tipo',
  viewMode = 'mes', onViewModeChange, onDayClick, onEventClick,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // ── Eventos por dia ──────────────────────────────────────────────────────────
  const getEventsForDay = (date: Date): CalEvent[] => {
    const events: CalEvent[] = [];

    compromissos
      .filter(c => isSameDay(parseLocalDate(c.data_inicio), date))
      .forEach(c => events.push({
        id: c.id,
        title: c.titulo,
        time: format(parseLocalDate(c.data_inicio), 'HH:mm'),
        paletteKey: colorMode === 'situacao' ? getPaletteBySituacao(c) : getPaletteByTipo(c),
        original: c,
      }));

    const groups: Record<string, IntimacaoEvent[]> = {};
    intimacoes
      .filter(i => {
        const dt = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
        return dt && isSameDay(parseLocalDate(dt), date);
      })
      .forEach(i => {
        const k = i.tipo_intimacao || i.processo_titulo || 'Intimação';
        if (!groups[k]) groups[k] = [];
        groups[k].push(i);
      });

    Object.entries(groups).forEach(([tipo, items]) => {
      const pk = getIntimacaoPalette(tipo);
      events.push({
        id: items[0].id,
        title: tipo,
        paletteKey: pk,
        count: items.length,
        hasBorder: pk === 'int_prazo',
        isIntimacao: true,
      });
    });

    return events;
  };

  // ── Navegação ────────────────────────────────────────────────────────────────
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
  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    if (viewMode === 'dia') return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === 'semana') {
      const ws = startOfWeek(currentDate, { locale: ptBR });
      const we = endOfWeek(currentDate, { locale: ptBR });
      return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  // ── Render de chip de evento ─────────────────────────────────────────────────
  const renderChip = (ev: CalEvent, day: Date, size: 'sm' | 'md' = 'sm') => {
    const pal = PALETTE[ev.paletteKey];
    const isMd = size === 'md';
    return (
      <div
        key={ev.id}
        onClick={e => { e.stopPropagation(); ev.original ? onEventClick(ev.original) : onDayClick(day); }}
        title={ev.title}
        className="flex items-center gap-1 rounded cursor-pointer overflow-hidden select-none"
        style={{
          background: pal.bg,
          color: pal.text,
          border: ev.hasBorder ? (pal as any).border || 'none' : 'none',
          padding: isMd ? '3px 7px' : '2px 5px',
          fontSize: isMd ? 11 : 10,
          lineHeight: isMd ? '17px' : '15px',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}
      >
        {/* Dot colorido */}
        <span
          className="shrink-0 rounded-full"
          style={{ width: 5, height: 5, background: pal.dot, opacity: 0.9 }}
        />
        {/* Horário */}
        {ev.time && (
          <span style={{ fontWeight: 700, fontSize: isMd ? 10 : 9, opacity: 0.8, flexShrink: 0 }}>
            {ev.time}
          </span>
        )}
        {/* Ícone intimação */}
        {ev.isIntimacao && (
          <FileText style={{ width: 9, height: 9, opacity: 0.6, flexShrink: 0 }} />
        )}
        {/* Contagem */}
        {ev.count && ev.count > 1 && (
          <span style={{ fontWeight: 700, fontSize: 9, opacity: 0.8, flexShrink: 0 }}>
            {ev.count}×
          </span>
        )}
        <span className="truncate">{ev.title}</span>
      </div>
    );
  };

  // ── VIEW MÊS ─────────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd   = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { locale: ptBR });
    const end   = endOfWeek(monthEnd, { locale: ptBR });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    const rows = Math.ceil(days.length / 7);

    return (
      <div className="rounded-2xl overflow-hidden border border-[#c9a96e]/25 shadow-sm">
        {/* Header dos dias */}
        <div className="grid grid-cols-7 bg-[#3d2b1f]">
          {WEEK_DAYS_SHORT.map((wd, i) => (
            <div
              key={wd}
              className="py-2.5 text-center text-[11px] font-semibold text-[#c9a96e]/70 uppercase tracking-widest"
              style={i < 6 ? { borderRight: '1px solid rgba(201,169,110,0.15)' } : undefined}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7">
            {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
              const inMonth = isSameMonth(day, currentDate);
              const isNow   = isToday(day);
              const events  = getEventsForDay(day);
              const maxVis  = 4;
              const visible = events.slice(0, maxVis);
              const extra   = events.length - maxVis;

              return (
                <div
                  key={colIdx}
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'min-h-[110px] md:min-h-[128px] cursor-pointer transition-all relative',
                    !inMonth && 'opacity-25',
                    isNow
                      ? 'bg-[#3d2b1f]/8 dark:bg-[#c9a96e]/5'
                      : 'bg-card hover:bg-[#c9a96e]/4',
                  )}
                  style={{
                    borderBottom: '1px solid rgba(201,169,110,0.15)',
                    borderRight: colIdx < 6 ? '1px solid rgba(201,169,110,0.15)' : 'none',
                    padding: '4px 5px 4px 4px',
                  }}
                >
                  {/* Linha topo hoje */}
                  {isNow && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#c9a96e] rounded-t" />
                  )}

                  {/* Número do dia */}
                  <div className="flex justify-end mb-1">
                    {isNow ? (
                      <span
                        className="flex items-center justify-center text-[11px] font-black rounded-full"
                        style={{ background: '#3d2b1f', color: '#c9a96e', width: 22, height: 22 }}
                      >
                        {format(day, 'd')}
                      </span>
                    ) : (
                      <span className={cn(
                        'text-[12px] font-semibold leading-none',
                        inMonth ? 'text-foreground/60' : 'text-muted-foreground/20'
                      )}>
                        {format(day, 'd')}
                      </span>
                    )}
                  </div>

                  {/* Eventos */}
                  <div className="space-y-[2px]">
                    {visible.map(ev => renderChip(ev, day))}
                    {extra > 0 && (
                      <div
                        className="text-[9px] font-bold cursor-pointer hover:underline pl-1"
                        style={{ color: '#c9a96e' }}
                      >
                        +{extra} mais
                      </div>
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

  // ── VIEW SEMANA ───────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { locale: ptBR });
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

    return (
      <div className="rounded-2xl overflow-hidden border border-[#c9a96e]/25 shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-7 bg-[#3d2b1f]">
          {weekDates.map((d, i) => {
            const isNow = isToday(d);
            return (
              <div
                key={i}
                onClick={() => onDayClick(d)}
                className="py-3 text-center cursor-pointer hover:bg-[#c9a96e]/10 transition-colors"
                style={i < 6 ? { borderRight: '1px solid rgba(201,169,110,0.15)' } : undefined}
              >
                <div className="text-[9px] font-semibold text-[#c9a96e]/50 uppercase tracking-widest">
                  {WEEK_DAYS_SHORT[d.getDay()]}
                </div>
                {isNow ? (
                  <span
                    className="inline-flex items-center justify-center text-sm font-black rounded-full mt-1"
                    style={{ background: '#c9a96e', color: '#3d2b1f', width: 28, height: 28 }}
                  >
                    {format(d, 'd')}
                  </span>
                ) : (
                  <div className="text-lg font-bold mt-0.5 text-[#c9a96e]/70">{format(d, 'd')}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Colunas */}
        <div className="grid grid-cols-7">
          {weekDates.map((d, i) => {
            const isNow = isToday(d);
            const events = getEventsForDay(d);
            const maxVis = 10;
            const visible = events.slice(0, maxVis);
            const extra = events.length - maxVis;

            return (
              <div
                key={i}
                onClick={() => onDayClick(d)}
                className={cn(
                  'min-h-[300px] p-1.5 cursor-pointer transition-colors',
                  isNow ? 'bg-[#3d2b1f]/6' : 'bg-card hover:bg-[#c9a96e]/4',
                )}
                style={i < 6 ? { borderRight: '1px solid rgba(201,169,110,0.15)' } : undefined}
              >
                <div className="space-y-[3px]">
                  {visible.map(ev => renderChip(ev, d, 'md'))}
                  {extra > 0 && (
                    <div className="text-[10px] font-bold text-center pt-1" style={{ color: '#c9a96e' }}>
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

  // ── VIEW DIA ──────────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const isNow = isToday(currentDate);
    return (
      <div className="rounded-2xl overflow-hidden border border-[#c9a96e]/25 shadow-sm">
        {/* Header */}
        <div className="grid grid-cols-[64px_1fr] bg-[#3d2b1f]">
          <div className="py-3 text-center text-[10px] text-[#c9a96e]/40 border-r border-[#c9a96e]/15">Hora</div>
          <div className="py-3 text-center">
            <div className="text-[10px] font-semibold text-[#c9a96e]/50 uppercase tracking-widest capitalize">
              {format(currentDate, 'EEEE', { locale: ptBR })}
            </div>
            <div className={cn('text-lg font-bold mt-0.5', isNow ? 'text-[#c9a96e]' : 'text-[#c9a96e]/60')}>
              {format(currentDate, 'd')}
            </div>
          </div>
        </div>
        {/* Horários */}
        <div className="max-h-[600px] overflow-y-auto">
          {HOURS.map(hour => {
            const hourEvents = getEventsForDay(currentDate).filter(ev => {
              if (!ev.time) return hour === 7;
              return parseInt(ev.time.split(':')[0], 10) === hour;
            });
            return (
              <div
                key={hour}
                className="grid grid-cols-[64px_1fr]"
                style={{ borderBottom: '1px solid rgba(201,169,110,0.12)' }}
              >
                <div
                  className="py-3 text-[11px] text-[#3d2b1f]/40 text-right pr-3 font-mono font-medium"
                  style={{ borderRight: '1px solid rgba(201,169,110,0.12)' }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div
                  className="min-h-[52px] p-1.5 cursor-pointer hover:bg-[#c9a96e]/4 transition-colors"
                  onClick={() => onDayClick(currentDate)}
                >
                  <div className="space-y-[2px]">
                    {hourEvents.map(ev => renderChip(ev, currentDate, 'md'))}
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
      {/* Barra de navegação */}
      <div className="flex items-center justify-between gap-3">

        {/* Setas + Hoje */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xl overflow-hidden border border-[#c9a96e]/25 bg-card">
            <button
              onClick={goPrev}
              className="px-3 py-2 hover:bg-[#c9a96e]/10 transition-colors border-r border-[#c9a96e]/20"
            >
              <ChevronLeft className="h-4 w-4 text-[#3d2b1f]/60 dark:text-[#c9a96e]/60" />
            </button>
            <button onClick={goNext} className="px-3 py-2 hover:bg-[#c9a96e]/10 transition-colors">
              <ChevronRight className="h-4 w-4 text-[#3d2b1f]/60 dark:text-[#c9a96e]/60" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-[#3d2b1f] text-[#c9a96e] border border-[#c9a96e]/30 hover:bg-[#5c3d2e] transition-colors"
          >
            Hoje
          </button>
        </div>

        {/* Título */}
        <h2 className="text-base md:text-lg font-bold text-[#3d2b1f] dark:text-[#c9a96e] capitalize tracking-tight">
          {getTitle()}
        </h2>

        {/* Toggle view */}
        <div className="inline-flex items-center rounded-xl overflow-hidden border border-[#c9a96e]/25 bg-card">
          {([
            { label: 'Mês',    value: 'mes'    as ViewMode },
            { label: 'Semana', value: 'semana' as ViewMode },
            { label: 'Dia',    value: 'dia'    as ViewMode },
          ]).map(({ label, value }, i) => (
            <button
              key={value}
              onClick={() => onViewModeChange?.(value)}
              className={cn(
                'px-3.5 py-2 text-xs font-semibold transition-all',
                viewMode === value
                  ? 'bg-[#3d2b1f] text-[#c9a96e]'
                  : 'text-muted-foreground hover:bg-[#c9a96e]/8 hover:text-[#3d2b1f] dark:hover:text-[#c9a96e]'
              )}
              style={i < 2 ? { borderRight: '1px solid rgba(201,169,110,0.2)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {viewMode === 'mes'    && renderMonthView()}
      {viewMode === 'semana' && renderWeekView()}
      {viewMode === 'dia'    && renderDayView()}
    </div>
  );
}
