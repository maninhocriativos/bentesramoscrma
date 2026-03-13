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
  isPast,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Scale,
  FileText,
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

interface CalendarProps {
  compromissos: Compromisso[];
  intimacoes?: IntimacaoEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (compromisso: Compromisso) => void;
  onStatusChange?: (id: string, newStatus: ConfirmacaoStatus) => void;
}

// Color mapping for intimação types (matching the reference orange/amber style)
const INTIMACAO_COLORS: Record<string, { bg: string; text: string }> = {
  'Alvará Expedido': { bg: 'bg-emerald-400', text: 'text-white' },
  'Sessão de Julgamento': { bg: 'bg-pink-400', text: 'text-white' },
};

function getIntimacaoStyle(title: string) {
  for (const [key, val] of Object.entries(INTIMACAO_COLORS)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return null;
}

// Status-based bar colors for compromissos
const STATUS_BAR_COLORS: Record<string, { bg: string; text: string }> = {
  confirmado: { bg: 'bg-emerald-400', text: 'text-white' },
  cancelado: { bg: 'bg-red-400', text: 'text-white' },
  remarcado: { bg: 'bg-blue-400', text: 'text-white' },
  pendente: { bg: 'bg-amber-300', text: 'text-amber-900' },
};

// Tipo-based colors for compromissos
const TIPO_BAR_COLORS: Record<string, { bg: string; text: string }> = {
  'Audiência': { bg: 'bg-pink-400', text: 'text-white' },
  'Reunião': { bg: 'bg-blue-400', text: 'text-white' },
  'Prazo': { bg: 'bg-amber-300', text: 'text-amber-900' },
  'Tarefa': { bg: 'bg-emerald-400', text: 'text-white' },
  'Outro': { bg: 'bg-slate-300', text: 'text-slate-800' },
};

function getCompromissoBarColor(c: Compromisso) {
  // Audiência always pink
  if (c.tipo === 'Audiência') return TIPO_BAR_COLORS['Audiência'];
  // Status-based
  const status = c.confirmacao_status || 'pendente';
  if (status === 'confirmado') return STATUS_BAR_COLORS.confirmado;
  if (status === 'cancelado') return STATUS_BAR_COLORS.cancelado;
  if (status === 'remarcado') return STATUS_BAR_COLORS.remarcado;
  // Default by tipo
  return TIPO_BAR_COLORS[c.tipo] || TIPO_BAR_COLORS['Outro'];
}

interface CalendarEvent {
  id: string;
  title: string;
  time?: string;
  type: 'compromisso' | 'intimacao';
  barColor: { bg: string; text: string };
  count?: number;
  isAudiencia?: boolean;
  original?: Compromisso;
}

export function Calendar({ compromissos, intimacoes = [], onDayClick, onEventClick, onStatusChange }: CalendarProps) {
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
      const barColor = getCompromissoBarColor(c);
      const isAudiencia = c.tipo === 'Audiência';
      events.push({
        id: c.id,
        title: c.titulo,
        time: isAudiencia ? format(parseLocalDate(c.data_inicio), 'HH:mm') : undefined,
        type: 'compromisso',
        barColor,
        isAudiencia,
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
      const specialStyle = getIntimacaoStyle(tipo);
      const barColor = specialStyle || { bg: 'bg-amber-300', text: 'text-amber-900' };
      events.push({
        id: items[0].id,
        title: tipo,
        type: 'intimacao',
        barColor,
        count: items.length > 1 ? items.length : undefined,
      });
    });

    return events;
  };

  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="space-y-4">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              className="px-2.5 py-2 hover:bg-muted/60 transition-colors border-r border-border"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              className="px-2.5 py-2 hover:bg-muted/60 transition-colors"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="text-xs font-bold px-4 rounded-lg"
          >
            Hoje
          </Button>
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-foreground capitalize">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>

        <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
          {['Mês', 'Semana', 'Dia'].map((label) => (
            <button
              key={label}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                label === 'Mês'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {/* Week Day Headers */}
        <div className="grid grid-cols-7 border-b border-border/60">
          {weekDays.map((wd) => (
            <div
              key={wd}
              className="py-2 text-center text-xs font-semibold text-muted-foreground italic border-r border-border/30 last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const events = getEventsForDay(day);
            const maxVisible = 4;
            const visibleEvents = events.slice(0, maxVisible);
            const remaining = events.length - maxVisible;

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[110px] md:min-h-[130px] border-b border-r border-border/30 last:border-r-0 p-1 md:p-1.5 cursor-pointer transition-colors group relative",
                  !isCurrentMonth && "bg-muted/20 opacity-40",
                  isCurrentMonth && "hover:bg-accent/5",
                  isCurrentDay && "ring-2 ring-inset ring-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/5"
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Day Number */}
                <div className="flex justify-end mb-1">
                  <span
                    className={cn(
                      "text-sm font-semibold leading-none",
                      isCurrentDay && "bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      !isCurrentDay && isCurrentMonth && "text-foreground",
                      !isCurrentMonth && "text-muted-foreground"
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-[2px]">
                  {visibleEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-[2px] rounded text-[10px] md:text-[11px] leading-tight cursor-pointer transition-all hover:brightness-90 truncate",
                        event.barColor.bg,
                        event.barColor.text,
                        event.type === 'intimacao' && !getIntimacaoStyle(event.title) && "border border-amber-400/60"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.original) onEventClick(event.original);
                        else onDayClick(day);
                      }}
                      title={event.title}
                    >
                      {event.count && (
                        <span className="font-bold text-[9px] shrink-0">{event.count}</span>
                      )}
                      {event.isAudiencia && event.time && (
                        <span className="font-bold text-[9px] shrink-0">{event.time}</span>
                      )}
                      {event.type === 'intimacao' && (
                        <FileText className="h-[9px] w-[9px] shrink-0 opacity-70" />
                      )}
                      <span className="truncate font-medium">{event.title}</span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div className="text-[9px] text-primary font-bold px-1.5 cursor-pointer hover:underline">
                      +{remaining} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
