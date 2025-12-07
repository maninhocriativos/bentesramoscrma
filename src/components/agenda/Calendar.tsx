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
  subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Compromisso } from '@/types/compromissos';

interface CalendarProps {
  compromissos: Compromisso[];
  onDayClick: (date: Date) => void;
  onEventClick: (compromisso: Compromisso) => void;
}

const TIPO_COLORS: Record<string, string> = {
  'Reunião': 'bg-blue-500',
  'Audiência': 'bg-red-500',
  'Prazo': 'bg-amber-500',
  'Tarefa': 'bg-emerald-500',
  'Outro': 'bg-slate-500',
};

export function Calendar({ compromissos, onDayClick, onEventClick }: CalendarProps) {
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

  const getCompromissosForDay = (date: Date) => {
    return compromissos.filter(c => 
      isSameDay(new Date(c.data_inicio), date)
    );
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-card rounded-xl shadow-enterprise overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
        <Button 
          variant="ghost" 
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/20"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button 
          variant="ghost" 
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/20"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 bg-muted/50 border-b">
        {weekDays.map(weekDay => (
          <div key={weekDay} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {weekDay}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayCompromissos = getCompromissosForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[100px] border-b border-r p-1 transition-colors cursor-pointer hover:bg-muted/30",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground/50"
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="flex items-center justify-center">
                <span 
                  className={cn(
                    "w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full",
                    isCurrentDay && "bg-gold text-gold-foreground font-bold"
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              
              {/* Events */}
              <div className="mt-1 space-y-0.5">
                {dayCompromissos.slice(0, 3).map(compromisso => (
                  <div
                    key={compromisso.id}
                    className={cn(
                      "text-[10px] px-1 py-0.5 rounded text-white truncate cursor-pointer hover:opacity-80",
                      TIPO_COLORS[compromisso.tipo] || TIPO_COLORS['Outro']
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(compromisso);
                    }}
                    title={compromisso.titulo}
                  >
                    {compromisso.titulo}
                  </div>
                ))}
                {dayCompromissos.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{dayCompromissos.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
