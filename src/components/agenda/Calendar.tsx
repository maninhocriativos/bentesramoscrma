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
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

// ─── Paleta de eventos ─────────────────────────────────────────────────────────
// Fundo claro + dot + texto escuro — legível sobre fundo branco
const PALETTE: Record<string, { bg: string; dot: string; text: string }> = {
  audiencia:  { bg: '#fdf2f8', dot: '#db2777', text: '#9d174d' },
  reuniao:    { bg: '#fff7ed', dot: '#d97706', text: '#92400e' },
  prazo:      { bg: '#fefce8', dot: '#ca8a04', text: '#713f12' },
  tarefa:     { bg: '#f0fdf4', dot: '#16a34a', text: '#166534' },
  outro:      { bg: '#f8fafc', dot: '#64748b', text: '#475569' },
  // Intimações — cinza
  intim:      { bg: '#f1f5f9', dot: '#64748b', text: '#475569' },
  intim_prazo:{ bg: '#f8fafc', dot: '#94a3b8', text: '#64748b' },
  // Situação
  confirmado: { bg: '#f0fdf4', dot: '#16a34a', text: '#166534' },
  cancelado:  { bg: '#fef2f2', dot: '#dc2626', text: '#991b1b' },
  remarcado:  { bg: '#eff6ff', dot: '#2563eb', text: '#1e40af' },
  pendente:   { bg: '#fffbeb', dot: '#d97706', text: '#92400e' },
};

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
  ) return 'intim_prazo';
  return 'intim';
}

interface CalEvent {
  id: string;
  title: string;
  time?: string;
  pk: PaletteKey;
  count?: number;
  original?: Compromisso;
  isIntimacao?: boolean;
}

const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export function Calendar({
  compromissos, intimacoes = [], colorMode = 'tipo',
  viewMode = 'mes', onViewModeChange, onDayClick, onEventClick,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getEventsForDay = (date: Date): CalEvent[] => {
    const events: CalEvent[] = [];

    compromissos
      .filter(c => isSameDay(parseLocalDate(c.data_inicio), date))
      .forEach(c => events.push({
        id: c.id,
        title: c.titulo,
        time: format(parseLocalDate(c.data_inicio), 'HH:mm'),
        pk: colorMode === 'situacao' ? getPaletteBySituacao(c) : getPaletteByTipo(c),
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
      events.push({
        id: items[0].id,
        title: tipo,
        pk: getIntimacaoPalette(tipo),
        count: items.length,
        isIntimacao: true,
      });
    });

    return events;
  };

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

  // ─── Chip de evento ─────────────────────────────────────────────────────────
  const renderChip = (ev: CalEvent, day: Date) => {
    const p = PALETTE[ev.pk];
    return (
      <div
        key={ev.id}
        onClick={e => { e.stopPropagation(); ev.original ? onEventClick(ev.original) : onDayClick(day); }}
        title={ev.title}
        className="flex items-center gap-1 rounded overflow-hidden cursor-pointer select-none w-full"
        style={{
          background: p.bg,
          color: p.text,
          padding: '2px 5px',
          fontSize: 10,
          lineHeight: '15px',
          fontWeight: 500,
          marginBottom: 2,
        }}
      >
        <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, background: p.dot, flexShrink: 0 }} />
        {ev.time && (
          <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.8, flexShrink: 0 }}>{ev.time}</span>
        )}
        {ev.count && ev.count > 1 && (
          <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.75, flexShrink: 0 }}>{ev.count}×</span>
        )}
        <span className="truncate min-w-0">{ev.title}</span>
      </div>
    );
  };

  // ─── View mês ────────────────────────────────────────────────────────────────
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
      <div className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.3)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Cabeçalho */}
        <div className="grid grid-cols-7" style={{ background: '#3d2b1f' }}>
          {WEEK_SHORT.map((wd, i) => (
            <div
              key={wd}
              className="py-2.5 text-center"
              style={{
                fontSize: 11, fontWeight: 500,
                color: 'rgba(201,169,110,0.65)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                borderRight: i < 6 ? '0.5px solid rgba(201,169,110,0.12)' : 'none',
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Dias */}
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
                    'cursor-pointer transition-colors relative',
                    !inMonth && 'opacity-25',
                    isNow ? 'bg-amber-50/40' : 'bg-white dark:bg-card hover:bg-stone-50 dark:hover:bg-[#c9a96e]/4',
                  )}
                  style={{
                    minHeight: 110,
                    padding: '5px 5px 4px 5px',
                    borderBottom: '0.5px solid rgba(201,169,110,0.15)',
                    borderRight: colIdx < 6 ? '0.5px solid rgba(201,169,110,0.15)' : 'none',
                  }}
                >
                  {/* Indicador dia atual */}
                  {isNow && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#3d2b1f', borderRadius: '2px 2px 0 0' }} />
                  )}
                  {/* Número */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 3 }}>
                    {isNow ? (
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#3d2b1f', color: '#c9a96e',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {format(day, 'd')}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 500, color: inMonth ? '#6b7280' : '#d1d5db' }}>
                        {format(day, 'd')}
                      </span>
                    )}
                  </div>
                  {/* Eventos */}
                  <div>
                    {visible.map(ev => renderChip(ev, day))}
                    {extra > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#c9a96e', paddingLeft: 2 }}>
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

  // ─── View semana ─────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { locale: ptBR });
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.3)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Cabeçalho */}
        <div className="grid grid-cols-7" style={{ background: '#3d2b1f' }}>
          {weekDates.map((d, i) => {
            const isNow = isToday(d);
            return (
              <div
                key={i}
                onClick={() => onDayClick(d)}
                className="py-3 text-center cursor-pointer transition-colors"
                style={{ borderRight: i < 6 ? '0.5px solid rgba(201,169,110,0.12)' : 'none' }}
              >
                <div style={{ fontSize: 9, fontWeight: 500, color: 'rgba(201,169,110,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {WEEK_SHORT[d.getDay()]}
                </div>
                {isNow ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%', marginTop: 2,
                    background: '#c9a96e', color: '#3d2b1f',
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {format(d, 'd')}
                  </span>
                ) : (
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2, color: 'rgba(201,169,110,0.6)' }}>
                    {format(d, 'd')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Células */}
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
                className="cursor-pointer transition-colors"
                style={{
                  minHeight: 280, padding: 6,
                  background: isNow ? 'rgba(201,169,110,0.04)' : 'white',
                  borderRight: i < 6 ? '0.5px solid rgba(201,169,110,0.15)' : 'none',
                }}
              >
                {visible.map(ev => renderChip(ev, d))}
                {extra > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#c9a96e', textAlign: 'center', paddingTop: 4 }}>
                    +{extra} mais
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── View dia ────────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const isNow = isToday(currentDate);
    return (
      <div className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.3)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="grid" style={{ gridTemplateColumns: '64px 1fr', background: '#3d2b1f' }}>
          <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 10, color: 'rgba(201,169,110,0.4)', borderRight: '0.5px solid rgba(201,169,110,0.12)' }}>
            Hora
          </div>
          <div style={{ padding: '10px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(201,169,110,0.5)', textTransform: 'capitalize', letterSpacing: '0.05em' }}>
              {format(currentDate, 'EEEE', { locale: ptBR })}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: isNow ? '#c9a96e' : 'rgba(201,169,110,0.6)', marginTop: 2 }}>
              {format(currentDate, 'd')}
            </div>
          </div>
        </div>
        <div style={{ maxHeight: 580, overflowY: 'auto' }}>
          {HOURS.map(hour => {
            const hourEvents = getEventsForDay(currentDate).filter(ev => {
              if (!ev.time) return hour === 7;
              return parseInt(ev.time.split(':')[0], 10) === hour;
            });
            return (
              <div key={hour} className="grid" style={{ gridTemplateColumns: '64px 1fr', borderBottom: '0.5px solid rgba(201,169,110,0.1)' }}>
                <div style={{ padding: '10px 8px 10px 0', textAlign: 'right', fontSize: 11, color: '#9ca3af', fontWeight: 500, borderRight: '0.5px solid rgba(201,169,110,0.1)' }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div
                  className="transition-colors hover:bg-stone-50"
                  style={{ minHeight: 52, padding: 6, cursor: 'pointer' }}
                  onClick={() => onDayClick(currentDate)}
                >
                  {hourEvents.map(ev => renderChip(ev, currentDate))}
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
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center rounded-xl overflow-hidden bg-card"
            style={{ border: '0.5px solid rgba(201,169,110,0.3)' }}
          >
            <button
              onClick={goPrev}
              className="px-3 py-2 transition-colors hover:bg-stone-50 dark:hover:bg-[#c9a96e]/8"
              style={{ borderRight: '0.5px solid rgba(201,169,110,0.2)' }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: '#6b7280' }} />
            </button>
            <button
              onClick={goNext}
              className="px-3 py-2 transition-colors hover:bg-stone-50 dark:hover:bg-[#c9a96e]/8"
            >
              <ChevronRight className="h-4 w-4" style={{ color: '#6b7280' }} />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-xl transition-colors"
            style={{
              fontSize: 12, fontWeight: 600,
              background: '#3d2b1f', color: '#c9a96e',
              border: '0.5px solid rgba(201,169,110,0.3)',
            }}
          >
            Hoje
          </button>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#3d2b1f' }} className="capitalize dark:text-[#c9a96e]">
          {getTitle()}
        </h2>

        <div
          className="inline-flex items-center rounded-xl overflow-hidden bg-card"
          style={{ border: '0.5px solid rgba(201,169,110,0.3)' }}
        >
          {([
            { label: 'Mês',    value: 'mes'    as ViewMode },
            { label: 'Semana', value: 'semana' as ViewMode },
            { label: 'Dia',    value: 'dia'    as ViewMode },
          ]).map(({ label, value }, i) => (
            <button
              key={value}
              onClick={() => onViewModeChange?.(value)}
              className="transition-colors"
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: viewMode === value ? '#3d2b1f' : 'transparent',
                color: viewMode === value ? '#c9a96e' : '#6b7280',
                borderRight: i < 2 ? '0.5px solid rgba(201,169,110,0.2)' : 'none',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'mes'    && renderMonthView()}
      {viewMode === 'semana' && renderWeekView()}
      {viewMode === 'dia'    && renderDayView()}
    </div>
  );
}
