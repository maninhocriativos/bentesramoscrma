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
  isPast,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

const TIMEZONE = 'America/Manaus';

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
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Video,
  Building2,
  Gavel,
  Users,
  Timer,
  TrendingUp
} from 'lucide-react';

const getModalidadeIcon = (compromisso: Compromisso) => {
  const tipo = compromisso.tipo?.toLowerCase() || '';
  const descricao = compromisso.descricao?.toLowerCase() || '';
  
  if (tipo.includes('online') || descricao.includes('online') || descricao.includes('virtual') || descricao.includes('remoto')) {
    return { icon: Video, color: 'text-blue-500', label: 'Online' };
  }
  if (tipo.includes('presencial') || descricao.includes('presencial') || descricao.includes('escritório') || descricao.includes('escritorio')) {
    return { icon: Building2, color: 'text-amber-600', label: 'Presencial' };
  }
  return null;
};

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarProps {
  compromissos: Compromisso[];
  onDayClick: (date: Date) => void;
  onEventClick: (compromisso: Compromisso) => void;
}

const TIPO_COLORS: Record<string, { bg: string; text: string; dot: string; border: string; accent: string }> = {
  'Reunião': { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-500/20', accent: 'from-blue-500' },
  'Audiência': { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-500/20', accent: 'from-red-500' },
  'Prazo': { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-500/20', accent: 'from-amber-500' },
  'Tarefa': { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-500/20', accent: 'from-emerald-500' },
  'Outro': { bg: 'bg-slate-50 dark:bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', dot: 'bg-slate-500', border: 'border-slate-200 dark:border-slate-500/20', accent: 'from-slate-500' },
};

const TIPO_ICONS: Record<string, typeof CalendarIcon> = {
  'Reunião': Users,
  'Audiência': Gavel,
  'Prazo': Timer,
  'Tarefa': CheckCircle2,
  'Outro': CalendarIcon,
};

const CONFIRMACAO_ICONS: Record<ConfirmacaoStatus, { icon: typeof CheckCircle2; color: string }> = {
  pendente: { icon: Clock, color: 'text-amber-500' },
  confirmado: { icon: CheckCircle2, color: 'text-emerald-500' },
  remarcado: { icon: AlertCircle, color: 'text-blue-500' },
  cancelado: { icon: XCircle, color: 'text-red-500' },
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
  const todayEvents = compromissos.filter(c => isToday(parseLocalDate(c.data_inicio))).length;

  const getColors = (tipo: string) => TIPO_COLORS[tipo] || TIPO_COLORS['Outro'];

  return (
    <div className="space-y-5">
      {/* Premium Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Hoje', value: todayEvents, icon: CalendarIcon, gradient: 'from-primary/12 to-primary/4', iconColor: 'text-primary' },
          { label: 'Este Mês', value: thisMonthEvents, icon: TrendingUp, gradient: 'from-blue-500/10 to-blue-500/3', iconColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Futuros', value: futureEvents, icon: Clock, gradient: 'from-emerald-500/10 to-emerald-500/3', iconColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total', value: totalEvents, icon: List, gradient: 'from-accent/15 to-accent/5', iconColor: 'text-accent-foreground' },
        ].map(({ label, value, icon: Icon, gradient, iconColor }) => (
          <div key={label} className={cn(
            "relative bg-card rounded-2xl p-4 border border-border/50 shadow-soft transition-all hover:shadow-enterprise group overflow-hidden"
          )}>
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", gradient)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">{label}</p>
                <Icon className={cn("h-4 w-4 opacity-50", iconColor)} />
              </div>
              <p className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Advbox Sync Bar */}
      <button
        onClick={handleSyncAdvbox}
        disabled={syncing}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/60 hover:border-border/60 transition-all text-xs text-muted-foreground group"
      >
        <span className="flex items-center gap-2">
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          <span className="font-medium">Sincronizar com Advbox</span>
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">Clique para sincronizar →</span>
      </button>

      {/* Controls Bar */}
      <div className="flex items-center justify-between">
        {/* View Toggle */}
        <div className="flex items-center bg-muted/40 rounded-xl p-0.5 border border-border/30">
          {[
            { mode: 'calendar' as ViewMode, icon: CalendarIcon, label: 'Calendário' },
            { mode: 'list' as ViewMode, icon: List, label: 'Lista' },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-medium transition-all",
                viewMode === mode
                  ? "bg-card text-foreground shadow-soft border border-border/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        
        {/* Month Nav */}
        <div className="flex items-center bg-card rounded-xl border border-border/40 shadow-soft">
          <button 
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-l-xl hover:bg-muted/40"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold min-w-[130px] text-center capitalize text-foreground px-2 border-x border-border/30">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button 
            className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-r-xl hover:bg-muted/40"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-card rounded-2xl shadow-enterprise border border-border/50 overflow-hidden">
          {/* Week header */}
          <div className="grid grid-cols-7 bg-primary">
            {weekDays.map((weekDay, i) => (
              <div key={weekDay} className="py-2.5 text-center text-[10px] md:text-[11px] font-bold text-primary-foreground/80 uppercase tracking-[0.2em]">
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
              const dayIsPast = isPast(day) && !isCurrentDay;

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[76px] md:min-h-[115px] border-b border-r border-border/20 p-1.5 md:p-2 transition-all cursor-pointer group relative",
                    !isCurrentMonth && "opacity-30",
                    isCurrentMonth && dayIsPast && "bg-muted/15",
                    isCurrentMonth && !dayIsPast && "hover:bg-accent/5",
                    isCurrentDay && "bg-primary/[0.04] ring-1 ring-inset ring-primary/10"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Today indicator line */}
                  {isCurrentDay && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
                  )}

                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-lg transition-all",
                        isCurrentDay && "bg-primary text-primary-foreground shadow-sm font-bold",
                        !isCurrentDay && isCurrentMonth && "text-foreground group-hover:bg-muted/50",
                        !isCurrentMonth && "text-muted-foreground"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayCompromissos.length > 0 && !isCurrentDay && (
                      <span className="min-w-[18px] h-[18px] rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                        {dayCompromissos.length}
                      </span>
                    )}
                    {dayCompromissos.length > 0 && isCurrentDay && (
                      <span className="min-w-[18px] h-[18px] rounded-md bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground">
                        {dayCompromissos.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Events */}
                  <div className="space-y-0.5">
                    {dayCompromissos.slice(0, 3).map(compromisso => {
                      const colors = getColors(compromisso.tipo);
                      
                      return (
                        <div
                          key={compromisso.id}
                          className={cn(
                            "text-[8px] md:text-[10px] leading-tight px-1.5 py-0.5 md:py-[3px] rounded-[5px] cursor-pointer transition-all hover:brightness-95 flex items-center gap-1",
                            colors.bg, colors.text
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(compromisso);
                          }}
                          title={compromisso.titulo}
                        >
                          <div className={cn("w-[3px] h-[3px] rounded-full shrink-0", colors.dot)} />
                          <span className="font-semibold truncate">{compromisso.titulo}</span>
                        </div>
                      );
                    })}
                    {dayCompromissos.length > 3 && (
                      <div className="text-[9px] text-primary font-bold px-1.5 opacity-70">
                        +{dayCompromissos.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Monthly List */}
          <div className="xl:col-span-2 bg-card rounded-2xl border border-border/50 shadow-enterprise overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3.5 bg-primary">
              <div className="flex items-center gap-2">
                <button 
                  className="w-7 h-7 flex items-center justify-center text-primary-foreground/70 hover:bg-primary-foreground/10 rounded-lg transition-colors"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="font-bold text-base text-primary-foreground capitalize tracking-tight">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <button 
                  className="w-7 h-7 flex items-center justify-center text-primary-foreground/70 hover:bg-primary-foreground/10 rounded-lg transition-colors"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <span className="bg-primary-foreground/15 text-primary-foreground text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide">
                {thisMonthEvents}
              </span>
            </div>
            <ScrollArea className="h-[500px] md:h-[550px]">
              <div className="p-4 space-y-2">
                {getCompromissosForMonth().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
                      <CalendarIcon className="h-9 w-9 text-muted-foreground/25" />
                    </div>
                    <p className="text-foreground font-semibold text-sm">Nenhum evento neste mês</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em "Novo" para adicionar um compromisso</p>
                  </div>
                ) : (
                  getCompromissosForMonth().map(compromisso => {
                    const colors = getColors(compromisso.tipo);
                    const TipoIcon = TIPO_ICONS[compromisso.tipo] || CalendarIcon;
                    const modalidade = getModalidadeIcon(compromisso);
                    const ModalidadeIcon = modalidade?.icon;
                    const confirmStatus = (compromisso.confirmacao_status || 'pendente') as ConfirmacaoStatus;
                    const confirmConfig = compromisso.lead_id ? CONFIRMACAO_ICONS[confirmStatus] : null;
                    const ConfirmIcon = confirmConfig?.icon;
                    const eventIsPast = isPast(parseLocalDate(compromisso.data_inicio));
                    
                    return (
                      <div
                        key={compromisso.id}
                        className={cn(
                          "flex items-stretch rounded-xl border border-border/40 bg-card overflow-hidden cursor-pointer transition-all hover:shadow-card-hover hover:border-accent/30 group relative",
                          eventIsPast && "opacity-60"
                        )}
                        onClick={() => onEventClick(compromisso)}
                      >
                        {/* Color accent bar */}
                        <div className={cn("w-1 shrink-0 bg-gradient-to-b to-transparent", colors.accent)} />
                        
                        {/* Date column */}
                        <div className="flex flex-col items-center justify-center w-[70px] md:w-20 py-3 border-r border-border/20">
                          <p className="text-2xl md:text-3xl font-bold text-foreground leading-none tracking-tight">
                            {format(parseLocalDate(compromisso.data_inicio), 'dd')}
                          </p>
                          <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-[0.15em] mt-0.5">
                            {format(parseLocalDate(compromisso.data_inicio), 'EEE', { locale: ptBR })}
                          </p>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 py-3 px-4 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                              {compromisso.titulo}
                            </h4>
                            <div className={cn("flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold", colors.bg, colors.text)}>
                              <TipoIcon className="h-3 w-3" />
                              <span>{compromisso.tipo}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 opacity-60" />
                              <span className="font-bold">{format(parseLocalDate(compromisso.data_inicio), "HH:mm")}</span>
                            </span>
                            
                            {ModalidadeIcon && (
                              <span className={cn("flex items-center gap-1 font-medium", modalidade.color)}>
                                <ModalidadeIcon className="h-3 w-3" />
                                <span>{modalidade.label}</span>
                              </span>
                            )}
                            
                            {ConfirmIcon && (
                              <span className={cn("flex items-center gap-1", confirmConfig.color)}>
                                <ConfirmIcon className="h-3 w-3" />
                                <span className="capitalize font-medium">{confirmStatus}</span>
                              </span>
                            )}
                            
                            {compromisso.descricao && !modalidade && (
                              <span className="flex items-center gap-1 truncate max-w-[180px] opacity-70">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{compromisso.descricao.slice(0, 35)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div className="flex items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Upcoming Events Sidebar */}
          <div className="xl:col-span-1 bg-card rounded-2xl border border-border/50 shadow-enterprise overflow-hidden">
            <div className="px-5 py-4 bg-primary">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-primary-foreground">Próximos Eventos</h3>
                  <p className="text-[10px] text-primary-foreground/50 font-medium">Agenda futura</p>
                </div>
              </div>
            </div>
            <ScrollArea className="h-[400px] md:h-[494px]">
              <div className="p-3 space-y-1.5">
                {upcomingEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                      <CalendarIcon className="h-7 w-7 text-muted-foreground/25" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Nenhum evento futuro</p>
                  </div>
                ) : (
                  upcomingEvents.map(compromisso => {
                    const colors = getColors(compromisso.tipo);
                    const isTodays = isToday(parseLocalDate(compromisso.data_inicio));
                    const TipoIcon = TIPO_ICONS[compromisso.tipo] || CalendarIcon;
                    
                    return (
                      <div
                        key={compromisso.id}
                        className={cn(
                          "flex gap-3 p-3 rounded-xl border border-border/30 cursor-pointer transition-all hover:shadow-soft hover:border-accent/30 bg-card group relative overflow-hidden",
                          isTodays && "border-primary/20 bg-primary/[0.02]"
                        )}
                        onClick={() => onEventClick(compromisso)}
                      >
                        {/* Accent line */}
                        <div className={cn("absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b to-transparent", colors.accent)} />
                        
                        <div className={cn(
                          "text-center shrink-0 w-11 py-2 rounded-lg font-bold",
                          isTodays 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted/30"
                        )}>
                          <p className="text-lg leading-none font-bold">
                            {format(parseLocalDate(compromisso.data_inicio), 'dd')}
                          </p>
                          <p className="text-[8px] uppercase mt-0.5 opacity-60 font-bold tracking-wider">
                            {format(parseLocalDate(compromisso.data_inicio), 'MMM', { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[13px] line-clamp-1 group-hover:text-primary transition-colors leading-tight">
                            {compromisso.titulo}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              <span className="font-bold">{format(parseLocalDate(compromisso.data_inicio), "HH:mm")}</span>
                            </span>
                            <span className={cn("flex items-center gap-1 font-medium", colors.text)}>
                              <TipoIcon className="h-2.5 w-2.5" />
                              <span>{compromisso.tipo}</span>
                            </span>
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
