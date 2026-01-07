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
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

// Fuso horário de Manaus (UTC-4)
const TIMEZONE = 'America/Manaus';

// Helper para converter data UTC para fuso de Manaus
const parseLocalDate = (dateString: string): Date => {
  const utcDate = parseISO(dateString);
  return toZonedTime(utcDate, TIMEZONE);
};
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  List, 
  RefreshCw,
  Clock,
  MapPin,
  ArrowRight
} from 'lucide-react';
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

const TIPO_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Reunião': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  'Audiência': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  'Prazo': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  'Tarefa': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Outro': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-500' },
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
      isSameDay(parseLocalDate(c.data_inicio), date)
    );
  };

  const getCompromissosForMonth = () => {
    return compromissos.filter(c => 
      isSameMonth(parseLocalDate(c.data_inicio), currentMonth)
    ).sort((a, b) => parseLocalDate(a.data_inicio).getTime() - parseLocalDate(b.data_inicio).getTime());
  };

  const upcomingEvents = compromissos
    .filter(c => isFuture(parseLocalDate(c.data_inicio)) || isToday(parseLocalDate(c.data_inicio)))
    .sort((a, b) => parseLocalDate(a.data_inicio).getTime() - parseLocalDate(b.data_inicio).getTime())
    .slice(0, 8);

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
  const weekDaysMobile = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const totalEvents = compromissos.length;
  const futureEvents = compromissos.filter(c => isFuture(parseLocalDate(c.data_inicio))).length;
  const thisMonthEvents = getCompromissosForMonth().length;

  const getColors = (tipo: string) => TIPO_COLORS[tipo] || TIPO_COLORS['Outro'];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Stats Cards - Compact on mobile */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 md:p-4 border border-primary/20">
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
          <p className="text-xl md:text-3xl font-bold text-primary">{totalEvents}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-3 md:p-4 border border-blue-500/20">
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wide">Mês</p>
          <p className="text-xl md:text-3xl font-bold text-blue-500">{thisMonthEvents}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl p-3 md:p-4 border border-emerald-500/20">
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wide">Futuros</p>
          <p className="text-xl md:text-3xl font-bold text-emerald-500">{futureEvents}</p>
        </div>
        <div 
          className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-xl p-3 md:p-4 border border-violet-500/20 cursor-pointer hover:border-violet-500/40 transition-colors"
          onClick={handleSyncAdvbox}
        >
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wide">Advbox</p>
          <div className="flex items-center gap-1 md:gap-2 mt-1">
            <RefreshCw className={cn("h-4 w-4 md:h-5 md:w-5 text-violet-500", syncing && "animate-spin")} />
            <span className="text-xs md:text-sm font-medium text-violet-500">Sync</span>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between bg-card rounded-lg p-1 border">
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calendário</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Button>
        </div>
        
        {/* Month Navigation - Only in calendar view */}
        {viewMode === 'calendar' && (
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center capitalize">
              {format(currentMonth, 'MMM yyyy', { locale: ptBR })}
            </span>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 bg-muted/50 border-b">
            {weekDays.map((weekDay, i) => (
              <div key={weekDay} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="hidden md:inline">{weekDay}</span>
                <span className="md:hidden">{weekDaysMobile[i]}</span>
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
                    "min-h-[70px] md:min-h-[100px] border-b border-r p-1 md:p-2 transition-all cursor-pointer group",
                    !isCurrentMonth && "bg-muted/30 opacity-50",
                    isCurrentMonth && "hover:bg-muted/50",
                    isFutureDay && isCurrentMonth && "bg-primary/5"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={cn(
                        "w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-xs md:text-sm font-medium rounded-full transition-colors",
                        isCurrentDay && "bg-primary text-primary-foreground font-bold shadow-md",
                        !isCurrentDay && isCurrentMonth && "group-hover:bg-muted"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayCompromissos.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] md:text-[10px]">
                        {dayCompromissos.length}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Events */}
                  <div className="space-y-0.5 md:space-y-1">
                    {dayCompromissos.slice(0, 2).map(compromisso => {
                      const colors = getColors(compromisso.tipo);
                      return (
                        <div
                          key={compromisso.id}
                          className={cn(
                            "text-[8px] md:text-[10px] leading-tight px-1.5 py-0.5 md:py-1 rounded-md cursor-pointer transition-all hover:scale-[1.02]",
                            colors.bg, colors.text
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(compromisso);
                          }}
                          title={compromisso.titulo}
                        >
                          <span className="font-medium truncate block">{compromisso.titulo}</span>
                        </div>
                      );
                    })}
                    {dayCompromissos.length > 2 && (
                      <div className="text-[9px] md:text-[10px] text-primary font-semibold px-1">
                        +{dayCompromissos.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
          {/* Monthly List - Takes more space */}
          <div className="lg:col-span-3 bg-card rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary to-primary/80">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold text-primary-foreground capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Badge className="bg-primary-foreground/20 text-primary-foreground border-0">
                {thisMonthEvents} eventos
              </Badge>
            </div>
            <ScrollArea className="h-[450px] md:h-[500px]">
              <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                {getCompromissosForMonth().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">Nenhum evento neste mês</p>
                    <p className="text-xs text-muted-foreground/70">Clique em "Novo" para adicionar</p>
                  </div>
                ) : (
                  getCompromissosForMonth().map(compromisso => {
                    const colors = getColors(compromisso.tipo);
                    return (
                      <div
                        key={compromisso.id}
                        className={cn(
                          "flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group",
                          colors.bg
                        )}
                        onClick={() => onEventClick(compromisso)}
                      >
                        <div className="text-center shrink-0 w-12 md:w-14 py-1">
                          <p className="text-2xl md:text-3xl font-bold text-foreground">
                            {format(parseLocalDate(compromisso.data_inicio), 'dd')}
                          </p>
                          <p className="text-[10px] md:text-xs text-muted-foreground uppercase font-medium">
                            {format(parseLocalDate(compromisso.data_inicio), 'EEE', { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-sm md:text-base truncate">{compromisso.titulo}</p>
                            <Badge variant="outline" className={cn("shrink-0 text-[10px] md:text-xs", colors.text)}>
                              {compromisso.tipo}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseLocalDate(compromisso.data_inicio), "HH:mm")}
                            </span>
                            {compromisso.descricao && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{compromisso.descricao.slice(0, 30)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Upcoming Events - Sidebar */}
          <div className="lg:col-span-2 bg-card rounded-xl border overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600">
              <h3 className="font-semibold text-white">Próximos Eventos</h3>
              <p className="text-xs text-white/80">Agenda futura</p>
            </div>
            <ScrollArea className="h-[350px] md:h-[500px]">
              <div className="p-3 md:p-4 space-y-2">
                {upcomingEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum evento futuro</p>
                  </div>
                ) : (
                  upcomingEvents.map(compromisso => {
                    const colors = getColors(compromisso.tipo);
                    const isTodays = isToday(parseLocalDate(compromisso.data_inicio));
                    return (
                      <div
                        key={compromisso.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md",
                          isTodays && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => onEventClick(compromisso)}
                      >
                        <div className={cn(
                          "text-center shrink-0 w-11 py-2 rounded-lg",
                          isTodays ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          <p className="text-lg font-bold">
                            {format(parseLocalDate(compromisso.data_inicio), 'dd')}
                          </p>
                          <p className="text-[9px] uppercase font-medium opacity-70">
                            {format(parseLocalDate(compromisso.data_inicio), 'MMM', { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{compromisso.titulo}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{format(parseLocalDate(compromisso.data_inicio), "HH:mm")}</span>
                            <div className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                            <span className={colors.text}>{compromisso.tipo}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
