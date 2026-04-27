import { useState, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays,
  isSameMonth, isToday,
  addMonths, subMonths, addWeeks, subWeeks,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const TZ = 'America/Manaus';

const eventDateStr = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, TZ, 'yyyy-MM-dd');
  } catch { return ''; }
};

const cellDateStr = (d: Date): string => {
  try {
    if (isNaN(d.getTime())) return '';
    return format(d, 'yyyy-MM-dd');
  } catch { return ''; }
};

const eventTimeStr = (isoStr: string | null | undefined): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, TZ, 'HH:mm');
  } catch { return ''; }
};

// ─── TIPOS ───────────────────────────────────────────────────────────────────

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

interface CalEvent {
  id: string;
  title: string;
  time?: string;
  pk: PaletteKey;
  count?: number;
  original?: Compromisso;
  isIntimacao?: boolean;
}

// ─── PALETA PREMIUM ──────────────────────────────────────────────────────────
// Identidade: marrom escuro #3d2b1f + dourado #c9a96e
// Chips com borda colorida lateral + fundo ultra-suave

const PALETTE = {
  audiencia:   { bar: '#e11d48', bg: 'rgba(225,29,72,0.07)',   text: '#9f1239' },
  reuniao:     { bar: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  text: '#78350f' },
  prazo:       { bar: '#ca8a04', bg: 'rgba(202,138,4,0.07)',   text: '#713f12' },
  tarefa:      { bar: '#16a34a', bg: 'rgba(22,163,74,0.07)',   text: '#14532d' },
  outro:       { bar: '#64748b', bg: 'rgba(100,116,139,0.07)', text: '#334155' },
  intim:       { bar: '#7c3aed', bg: 'rgba(124,58,237,0.07)',  text: '#4c1d95' },
  intim_prazo: { bar: '#9333ea', bg: 'rgba(147,51,234,0.07)',  text: '#581c87' },
  confirmado:  { bar: '#059669', bg: 'rgba(5,150,105,0.07)',   text: '#064e3b' },
  cancelado:   { bar: '#dc2626', bg: 'rgba(220,38,38,0.07)',   text: '#7f1d1d' },
  remarcado:   { bar: '#2563eb', bg: 'rgba(37,99,235,0.07)',   text: '#1e3a8a' },
  pendente:    { bar: '#d97706', bg: 'rgba(217,119,6,0.07)',   text: '#78350f' },
} as const;

type PaletteKey = keyof typeof PALETTE;

const pkByTipo = (c: Compromisso): PaletteKey => {
  switch (c.tipo) {
    case 'Audiência': return 'audiencia';
    case 'Reunião':   return 'reuniao';
    case 'Prazo':     return 'prazo';
    case 'Tarefa':    return 'tarefa';
    default:          return 'outro';
  }
};

const pkBySituacao = (c: Compromisso): PaletteKey => {
  switch (c.confirmacao_status || 'pendente') {
    case 'confirmado': return 'confirmado';
    case 'cancelado':  return 'cancelado';
    case 'remarcado':  return 'remarcado';
    default:           return 'pendente';
  }
};

const pkIntimacao = (titulo: string): PaletteKey => {
  const kw = [
    'manifestação','contestação','contrarrazões','réplica','emenda',
    'recurso','embargos','alegações','apelação','agravo','sine die',
    'pagamento','manifestacao','contestacao','contrarrazoes','replica',
    'alegacoes','apelacao',
  ];
  return kw.some(k => titulo.toLowerCase().includes(k)) ? 'intim_prazo' : 'intim';
};

const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

// ─── ESTILOS COMPARTILHADOS ───────────────────────────────────────────────────

const CARD_STYLE = {
  border: '0.5px solid rgba(201,169,110,0.22)',
  boxShadow: '0 4px 20px rgba(61,43,31,0.07), 0 1px 4px rgba(61,43,31,0.04)',
  borderRadius: 16,
  overflow: 'hidden',
} as const;

const HEADER_CELL_STYLE = {
  background: '#3d2b1f',
} as const;

// =============================================================================
// COMPONENTE
// =============================================================================

export function Calendar({
  compromissos, intimacoes = [], colorMode = 'tipo',
  viewMode = 'mes', onViewModeChange, onDayClick, onEventClick,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // ─── INDEX ────────────────────────────────────────────────────────────────
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();

    for (const c of compromissos) {
      const key = eventDateStr(c.data_inicio);
      if (!key) continue;
      const ev: CalEvent = {
        id: c.id,
        title: c.titulo || '(sem título)',
        time: eventTimeStr(c.data_inicio),
        pk: colorMode === 'situacao' ? pkBySituacao(c) : pkByTipo(c),
        original: c,
      };
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }

    const intimByDay: Record<string, Record<string, IntimacaoEvent[]>> = {};
    for (const i of intimacoes) {
      const raw = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
      const key = eventDateStr(raw);
      if (!key) continue;
      const grp = i.tipo_intimacao || i.processo_titulo || 'Intimação';
      if (!intimByDay[key]) intimByDay[key] = {};
      if (!intimByDay[key][grp]) intimByDay[key][grp] = [];
      intimByDay[key][grp].push(i);
    }
    for (const [dayK, groups] of Object.entries(intimByDay)) {
      if (!map.has(dayK)) map.set(dayK, []);
      for (const [tipo, items] of Object.entries(groups)) {
        map.get(dayK)!.push({
          id: items[0].id,
          title: tipo,
          pk: pkIntimacao(tipo),
          count: items.length,
          isIntimacao: true,
        });
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    }

    return map;
  }, [compromissos, intimacoes, colorMode]);

  const getDayEvents = (day: Date): CalEvent[] =>
    eventsByDay.get(cellDateStr(day)) || [];

  // ─── NAVEGAÇÃO ─────────────────────────────────────────────────────────────
  const goPrev = () => {
    if (viewMode === 'mes')         setCurrentDate(d => subMonths(d, 1));
    else if (viewMode === 'semana') setCurrentDate(d => subWeeks(d, 1));
    else                            setCurrentDate(d => addDays(d, -1));
  };
  const goNext = () => {
    if (viewMode === 'mes')         setCurrentDate(d => addMonths(d, 1));
    else if (viewMode === 'semana') setCurrentDate(d => addWeeks(d, 1));
    else                            setCurrentDate(d => addDays(d, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    if (viewMode === 'dia') return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === 'semana') {
      const ws = startOfWeek(currentDate, { locale: ptBR });
      const we = endOfWeek(currentDate, { locale: ptBR });
      return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, 'd MMM yyyy', { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  // ─── CHIP PREMIUM ──────────────────────────────────────────────────────────
  const renderChip = (ev: CalEvent, day: Date) => {
    const p = PALETTE[ev.pk] ?? PALETTE.outro;
    return (
      <div
        key={ev.id}
        onClick={e => { e.stopPropagation(); ev.original ? onEventClick(ev.original) : onDayClick(day); }}
        title={ev.title}
        className={cn('flex items-center w-full overflow-hidden cursor-pointer select-none')}
        style={{
          gap: 4,
          borderRadius: 3,
          background: p.bg,
          borderLeft: `2.5px solid ${p.bar}`,
          color: p.text,
          padding: '2.5px 5px 2.5px 4px',
          fontSize: 10.5,
          lineHeight: '15px',
          fontWeight: 500,
          marginBottom: 2,
          transition: 'opacity 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.72')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {ev.time && (
          <span className="shrink-0" style={{ fontSize: 9, fontWeight: 700, opacity: 0.62, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {ev.time}
          </span>
        )}
        {ev.count && ev.count > 1 && (
          <span className="shrink-0" style={{ fontSize: 9, fontWeight: 600, opacity: 0.6 }}>{ev.count}×</span>
        )}
        <span className="truncate min-w-0">{ev.title}</span>
      </div>
    );
  };

  // ─── VIEW MÊS ──────────────────────────────────────────────────────────────
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
      <div style={CARD_STYLE}>
        {/* Cabeçalho dias da semana */}
        <div className="grid grid-cols-7" style={HEADER_CELL_STYLE}>
          {WEEK_SHORT.map((wd, i) => (
            <div key={wd} className="py-3 text-center"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(201,169,110,0.5)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                borderRight: i < 6 ? '0.5px solid rgba(201,169,110,0.08)' : 'none',
              }}>
              {wd}
            </div>
          ))}
        </div>

        {/* Grid de células */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7">
            {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
              const inMonth = isSameMonth(day, currentDate);
              const isNow   = isToday(day);
              const events  = getDayEvents(day);
              const maxVis  = 3;
              const visible = events.slice(0, maxVis);
              const extra   = events.length - maxVis;

              return (
                <div
                  key={colIdx}
                  onClick={() => onDayClick(day)}
                  className="cursor-pointer relative"
                  style={{
                    minHeight: 118,
                    padding: '7px 7px 10px',
                    background: isNow ? 'rgba(201,169,110,0.05)' : '#ffffff',
                    opacity: !inMonth ? 0.32 : 1,
                    borderBottom: rowIdx < rows - 1 ? '0.5px solid rgba(201,169,110,0.1)' : 'none',
                    borderRight: colIdx < 6 ? '0.5px solid rgba(201,169,110,0.1)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isNow) e.currentTarget.style.background = 'rgba(201,169,110,0.03)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isNow ? 'rgba(201,169,110,0.05)' : '#ffffff';
                  }}
                >
                  {/* Linha de destaque do dia atual */}
                  {isNow && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: 'linear-gradient(90deg, #3d2b1f 0%, #c9a96e 100%)',
                    }} />
                  )}

                  {/* Número do dia */}
                  <div className="flex justify-end mb-1.5">
                    {isNow ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#3d2b1f', color: '#c9a96e',
                        fontSize: 11, fontWeight: 800,
                      }}>
                        {format(day, 'd')}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%',
                        fontSize: 12, fontWeight: 500,
                        color: inMonth ? '#6b7280' : '#d1d5db',
                      }}>
                        {format(day, 'd')}
                      </span>
                    )}
                  </div>

                  {/* Eventos */}
                  <div>
                    {visible.map(ev => renderChip(ev, day))}
                    {extra > 0 && (
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        color: '#c9a96e', paddingLeft: 5, paddingTop: 1,
                        letterSpacing: '-0.01em',
                      }}>
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

  // ─── VIEW SEMANA ───────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { locale: ptBR });
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

    return (
      <div style={CARD_STYLE}>
        {/* Cabeçalho com datas */}
        <div className="grid grid-cols-7" style={HEADER_CELL_STYLE}>
          {weekDates.map((d, i) => {
            const isNow = isToday(d);
            return (
              <div key={i} onClick={() => onDayClick(d)} className="py-3 text-center cursor-pointer"
                style={{ borderRight: i < 6 ? '0.5px solid rgba(201,169,110,0.08)' : 'none' }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(201,169,110,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
                  {WEEK_SHORT[d.getDay()]}
                </div>
                {isNow ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#c9a96e', color: '#3d2b1f',
                    fontSize: 14, fontWeight: 800,
                  }}>
                    {format(d, 'd')}
                  </span>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(201,169,110,0.6)' }}>{format(d, 'd')}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Corpo */}
        <div className="grid grid-cols-7">
          {weekDates.map((d, i) => {
            const isNow   = isToday(d);
            const events  = getDayEvents(d);
            const maxVis  = 10;
            const visible = events.slice(0, maxVis);
            const extra   = events.length - maxVis;
            return (
              <div key={i} onClick={() => onDayClick(d)} className="cursor-pointer"
                style={{
                  minHeight: 280, padding: '8px 6px',
                  background: isNow ? 'rgba(201,169,110,0.04)' : '#ffffff',
                  borderRight: i < 6 ? '0.5px solid rgba(201,169,110,0.1)' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isNow) e.currentTarget.style.background = 'rgba(201,169,110,0.025)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isNow ? 'rgba(201,169,110,0.04)' : '#ffffff'; }}
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

  // ─── VIEW DIA ──────────────────────────────────────────────────────────────
  const renderDayView = () => {
    const isNow     = isToday(currentDate);
    const dayEvents = getDayEvents(currentDate);

    return (
      <div style={CARD_STYLE}>
        {/* Header */}
        <div className="grid" style={{ gridTemplateColumns: '68px 1fr', ...HEADER_CELL_STYLE }}>
          <div style={{
            padding: '12px 0', textAlign: 'center',
            fontSize: 9, color: 'rgba(201,169,110,0.4)',
            borderRight: '0.5px solid rgba(201,169,110,0.1)',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Hora</div>
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(201,169,110,0.45)', textTransform: 'capitalize', letterSpacing: '0.08em' }}>
              {format(currentDate, 'EEEE', { locale: ptBR })}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: isNow ? '#c9a96e' : 'rgba(201,169,110,0.6)', marginTop: 2, lineHeight: 1 }}>
              {format(currentDate, 'd')}
            </div>
          </div>
        </div>

        {/* Grade de horas */}
        <div style={{ maxHeight: 580, overflowY: 'auto' }}>
          {HOURS.map(hour => {
            const hourEvents = dayEvents.filter(ev => {
              if (!ev.time) return hour === 7;
              return parseInt(ev.time.split(':')[0], 10) === hour;
            });
            const hasEvents = hourEvents.length > 0;
            return (
              <div key={hour} className="grid" style={{ gridTemplateColumns: '68px 1fr', borderBottom: '0.5px solid rgba(201,169,110,0.08)' }}>
                <div style={{
                  padding: '10px 10px 10px 0', textAlign: 'right',
                  fontSize: 11, color: '#9ca3af', fontWeight: 600,
                  borderRight: '0.5px solid rgba(201,169,110,0.08)',
                  fontVariantNumeric: 'tabular-nums',
                  background: hasEvents ? 'rgba(201,169,110,0.02)' : 'transparent',
                }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div
                  style={{ minHeight: hasEvents ? 'auto' : 48, padding: '6px 8px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => onDayClick(currentDate)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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

  // ─── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Barra de navegação premium ── */}
      <div className="flex items-center justify-between gap-3">

        {/* Prev / Next / Hoje */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={goPrev} aria-label="Anterior"
            className="p-2 rounded-xl transition-colors"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={goNext} aria-label="Próximo"
            className="p-2 rounded-xl transition-colors"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={goToday}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold ml-1 transition-all"
            style={{ background: 'rgba(201,169,110,0.1)', color: '#3d2b1f', border: '0.5px solid rgba(201,169,110,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.1)')}>
            Hoje
          </button>
        </div>

        {/* Título do período */}
        <h2 className="capitalize font-semibold tracking-tight dark:text-[#c9a96e]"
          style={{ fontSize: 17, color: '#3d2b1f', letterSpacing: '-0.02em' }}>
          {getTitle()}
        </h2>

        {/* Toggle de visualização */}
        <div className="inline-flex rounded-xl p-0.5"
          style={{ background: 'rgba(201,169,110,0.07)', border: '0.5px solid rgba(201,169,110,0.2)' }}>
          {([
            { label: 'Mês',    value: 'mes'    as ViewMode },
            { label: 'Semana', value: 'semana' as ViewMode },
            { label: 'Dia',    value: 'dia'    as ViewMode },
          ]).map(({ label, value }) => (
            <button type="button" key={value} onClick={() => onViewModeChange?.(value)}
              className="transition-all"
              style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 500,
                borderRadius: 10, cursor: 'pointer',
                background: viewMode === value ? '#3d2b1f' : 'transparent',
                color: viewMode === value ? '#c9a96e' : '#9ca3af',
              }}>
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
