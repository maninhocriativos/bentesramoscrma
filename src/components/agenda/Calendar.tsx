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
  isFuture,
  isPast
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Compromisso } from '@/types/compromissos';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarProps {
  compromissos: Compromisso[];
  onDayClick: (date: Date) => void;
  onEventClick: (compromisso: Compromisso) => void;
}

const TIPO_COLORS: Record<string, string> = {
  'Reunião': 'bg-blue-500 hover:bg-blue-600',
  'Audiência': 'bg-red-500 hover:bg-red-600',
  'Prazo': 'bg-amber-500 hover:bg-amber-600',
  'Tarefa': 'bg-emerald-500 hover:bg-emerald-600',
  'Outro': 'bg-slate-500 hover:bg-slate-600',
};

const TIPO_DOTS: Record<string, string> = {
  'Reunião': 'bg-blue-500',
  'Audiência': 'bg-red-500',
  'Prazo': 'bg-amber-500',
  'Tarefa': 'bg-emerald-500',
  'Outro': 'bg-slate-500',
};

type ViewMode = 'calendar' | 'list';

export function Calendar({ compromissos, onDayClick, onEventClick }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

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

  const getCompromissosForMonth = () => {
    return compromissos.filter(c => 
      isSameMonth(new Date(c.data_inicio), currentMonth)
    ).sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
  };

  const upcomingEvents = compromissos
    .filter(c => isFuture(new Date(c.data_inicio)) || isToday(new Date(c.data_inicio)))
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
    .slice(0, 10);

  const handleSyncAdvbox = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { action: 'sync_advbox' }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Sincronização concluída!',
        description: data.message || `${data.synced} eventos sincronizados`
      });
      
      // Reload page to refresh data
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Erro na sincronização',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const totalEvents = compromissos.length;
  const futureEvents = compromissos.filter(c => isFuture(new Date(c.data_inicio))).length;
  const thisMonthEvents = getCompromissosForMonth().length;

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg p-3 border">
          <p className="text-xs text-muted-foreground">Total de Eventos</p>
          <p className="text-2xl font-bold text-primary">{totalEvents}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border">
          <p className="text-xs text-muted-foreground">Este Mês</p>
          <p className="text-2xl font-bold text-blue-500">{thisMonthEvents}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border">
          <p className="text-xs text-muted-foreground">Futuros</p>
          <p className="text-2xl font-bold text-emerald-500">{futureEvents}</p>
        </div>
        <div className="bg-card rounded-lg p-3 border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Advbox</p>
            <p className="text-sm font-medium">Sincronizar</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAdvbox}
            disabled={syncing}
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendário
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </Button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
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
            <div className="text-center">
              <h2 className="text-lg font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <p className="text-xs opacity-80">{thisMonthEvents} eventos</p>
            </div>
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
              const isFutureDay = isFuture(day);

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[90px] border-b border-r p-1.5 transition-colors cursor-pointer",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground/50",
                    isCurrentMonth && "hover:bg-muted/30",
                    isFutureDay && isCurrentMonth && "bg-primary/5"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className={cn(
                        "w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full",
                        isCurrentDay && "bg-primary text-primary-foreground font-bold"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayCompromissos.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {dayCompromissos.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Events - Show dots for compact view */}
                  <div className="mt-1 space-y-0.5">
                    {dayCompromissos.slice(0, 2).map(compromisso => (
                      <div
                        key={compromisso.id}
                        className={cn(
                          "text-[9px] leading-tight px-1 py-0.5 rounded text-white truncate cursor-pointer transition-colors",
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
                    {dayCompromissos.length > 2 && (
                      <div className="text-[9px] text-primary font-medium text-center">
                        +{dayCompromissos.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly List */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h3 className="font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-3 space-y-2">
                {getCompromissosForMonth().length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento neste mês
                  </p>
                ) : (
                  getCompromissosForMonth().map(compromisso => (
                    <div
                      key={compromisso.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onEventClick(compromisso)}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 shrink-0",
                        TIPO_DOTS[compromisso.tipo] || TIPO_DOTS['Outro']
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{compromisso.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(compromisso.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {compromisso.descricao && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {compromisso.descricao}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {compromisso.tipo}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Upcoming Events */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="p-4 bg-emerald-500 text-white">
              <h3 className="font-semibold">Próximos Eventos</h3>
              <p className="text-xs opacity-80">Eventos futuros</p>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-3 space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento futuro
                  </p>
                ) : (
                  upcomingEvents.map(compromisso => (
                    <div
                      key={compromisso.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onEventClick(compromisso)}
                    >
                      <div className="text-center shrink-0 w-12">
                        <p className="text-lg font-bold text-primary">
                          {format(new Date(compromisso.data_inicio), 'dd')}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {format(new Date(compromisso.data_inicio), 'MMM', { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{compromisso.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(compromisso.data_inicio), "EEEE 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0 mt-2",
                        TIPO_DOTS[compromisso.tipo] || TIPO_DOTS['Outro']
                      )} />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}