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
  Sparkles
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

const TIPO_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  'Reunião': { bg: 'bg-blue-500/8', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-blue-500/20' },
  'Audiência': { bg: 'bg-red-500/8', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', border: 'border-red-500/20' },
  'Prazo': { bg: 'bg-amber-500/8', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500/20' },
  'Tarefa': { bg: 'bg-emerald-500/8', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/20' },
  'Outro': { bg: 'bg-slate-500/8', text: 'text-slate-700 dark:text-slate-400', dot: 'bg-slate-500', border: 'border-slate-500/20' },
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

  const getColors = (tipo: string) => TIPO_COLORS[tipo] || TIPO_COLORS['Outro'];

  return (
    <div className="space-y-5">
      {/* Premium KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="relative overflow-hidden bg-card rounded-2xl p-4 border border-border/60 shadow-soft group hover:shadow-enterprise transition-shadow">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-[40px]" />
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Total</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground mt-1">{totalEvents}</p>
        </div>
        <div className="relative overflow-hidden bg-card rounded-2xl p-4 border border-border/60 shadow-soft group hover:shadow-enterprise transition-shadow">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-[40px]" />
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Este mês</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground mt-1">{thisMonthEvents}</p>
        </div>
        <div className="relative overflow-hidden bg-card rounded-2xl p-4 border border-border/60 shadow-soft group hover:shadow-enterprise transition-shadow">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-[40px]" />
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Futuros</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground mt-1">{futureEvents}</p>
        </div>
        <button 
          className="relative overflow-hidden bg-card rounded-2xl p-4 border border-border/60 shadow-soft hover:shadow-enterprise transition-all hover:border-accent/40 text-left"
          onClick={handleSyncAdvbox}
          disabled={syncing}
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-bl-[40px]" />
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Advbox</p>
          <div className="flex items-center gap-1.5 mt-2">
            <RefreshCw className={cn("h-4 w-4 text-accent-foreground/70", syncing && "animate-spin")} />
            <span className="text-xs font-semibold text-foreground">Sync</span>
          </div>
        </button>
      </div>

      {/* View Toggle + Month Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border/40">
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all",
              viewMode === 'calendar'
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Calendário</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all",
              viewMode === 'list'
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center gap-1">
          <button 
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold min-w-[120px] text-center capitalize text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button 
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-card rounded-2xl shadow-enterprise border border-border/60 overflow-hidden">
          {/* Week days header */}
          <div className="grid grid-cols-7 border-b border-border/40">
            {weekDays.map((weekDay, i) => (
              <div key={weekDay} className="py-3 text-center text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
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

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[72px] md:min-h-[110px] border-b border-r border-border/30 p-1.5 md:p-2 transition-all cursor-pointer group",
                    !isCurrentMonth && "bg-muted/20 opacity-40",
                    isCurrentMonth && "hover:bg-accent/5",
                    isCurrentDay && "bg-primary/[0.03]"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-lg transition-all",
                        isCurrentDay && "bg-primary text-primary-foreground shadow-soft font-bold",
                        !isCurrentDay && isCurrentMonth && "text-foreground group-hover:bg-muted/60"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayCompromissos.length > 0 && !isCurrentDay && (
                      <span className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                        {dayCompromissos.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Events */}
                  <div className="space-y-0.5">
                    {dayCompromissos.slice(0, 2).map(compromisso => {
                      const colors = getColors(compromisso.tipo);
                      
                      return (
                        <div
                          key={compromisso.id}
                          className={cn(
                            "text-[8px] md:text-[10px] leading-tight px-1.5 py-0.5 md:py-1 rounded-md cursor-pointer transition-all hover:scale-[1.02] flex items-center gap-1 border",
                            colors.bg, colors.text, colors.border
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(compromisso);
                          }}
                          title={compromisso.titulo}
                        >
                          <div className={cn("w-1 h-1 rounded-full shrink-0", colors.dot)} />
                          <span className="font-medium truncate">{compromisso.titulo}</span>
                        </div>
                      );
                    })}
                    {dayCompromissos.length > 2 && (
                      <div className="text-[9px] text-primary/70 font-semibold px-1.5">
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Monthly List */}
          <div className="xl:col-span-2 bg-card rounded-2xl border border-border/60 shadow-enterprise overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-primary">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-primary-foreground/80 hover:bg-primary-foreground/10 rounded-xl"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-bold text-lg text-primary-foreground capitalize tracking-tight">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 text-primary-foreground/80 hover:bg-primary-foreground/10 rounded-xl"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <span className="bg-primary-foreground/15 text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                {thisMonthEvents} eventos
              </span>
            </div>
            <ScrollArea className="h-[500px] md:h-[550px]">
              <div className="p-5 space-y-2.5">
                {getCompromissosForMonth().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
                      <CalendarIcon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-semibold">Nenhum evento neste mês</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo" para adicionar</p>
                  </div>
                ) : (
                  getCompromissosForMonth().map(compromisso => {
                    const colors = getColors(compromisso.tipo);
                    const modalidade = getModalidadeIcon(compromisso);
                    const ModalidadeIcon = modalidade?.icon;
                    const confirmStatus = (compromisso.confirmacao_status || 'pendente') as ConfirmacaoStatus;
                    const confirmConfig = compromisso.lead_id ? CONFIRMACAO_ICONS[confirmStatus] : null;
                    const ConfirmIcon = confirmConfig?.icon;
                    
                    return (
                      <div
                        key={compromisso.id}
                        className="flex items-stretch gap-0 rounded-xl border border-border/50 bg-card overflow-hidden cursor-pointer transition-all hover:shadow-card-hover hover:border-accent/40 group"
                        onClick={() => onEventClick(compromisso)}
                      >
                        {/* Date column */}
                        <div className="flex flex-col items-center justify-center w-20 md:w-24 py-4 bg-muted/30 border-r border-border/40">
                          <p className="text-3xl md:text-4xl font-bold text-foreground leading-none">
                            {format(parseLocalDate(compromisso.data_inicio), 'dd')}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">
                            {format(parseLocalDate(compromisso.data_inicio), 'EEEE', { locale: ptBR }).slice(0, 3)}
                          </p>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="font-semibold text-sm md:text-base truncate group-hover:text-primary transition-colors">
                              {compromisso.titulo}
                            </h4>
                            <Badge variant="outline" className={cn("shrink-0 text-[10px] font-semibold rounded-md", colors.text, colors.bg, colors.border)}>
                              {compromisso.tipo}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              <span className="font-semibold">{format(parseLocalDate(compromisso.data_inicio), "HH:mm")}</span>
                            </span>
                            
                            {ModalidadeIcon && (
                              <span className={cn("flex items-center gap-1.5 font-medium", modalidade.color)}>
                                <ModalidadeIcon className="h-3 w-3" />
                                <span>{modalidade.label}</span>
                              </span>
                            )}
                            
                            {ConfirmIcon && (
                              <span className={cn("flex items-center gap-1.5", confirmConfig.color)}>
                                <ConfirmIcon className="h-3 w-3" />
                                <span className="capitalize">{confirmStatus}</span>
                              </span>
                            )}
                            
                            {compromisso.descricao && !modalidade && (
                              <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{compromisso.descricao.slice(0, 40)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Arrow */}
                        <div className="flex items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Upcoming Events Sidebar */}
          <div className="xl:col-span-1 bg-card rounded-2xl border border-border/60 shadow-enterprise overflow-hidden">
            <div className="p-5 bg-primary">
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="h-4 w-4 text-primary-foreground/80" />
                <h3 className="font-bold text-base text-primary-foreground">Próximos Eventos</h3>
              </div>
              <p className="text-xs text-primary-foreground/60">Sua agenda futura</p>
            </div>
            <ScrollArea className="h-[400px] md:h-[494px]">
              <div className="p-4 space-y-2">
                {upcomingEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Nenhum evento futuro</p>
                  </div>
                ) : (
                  upcomingEvents.map(compromisso => {
                    const colors = getColors(compromisso.tipo);
                    const isTodays = isToday(parseLocalDate(compromisso.data_inicio));
                    const modalidade = getModalidadeIcon(compromisso);
                    const ModalidadeIcon = modalidade?.icon;
                    
                    return (
                      <div
                        key={compromisso.id}
                        className={cn(
                          "flex gap-3 p-3 rounded-xl border border-border/50 cursor-pointer transition-all hover:shadow-soft-lg hover:border-accent/40 bg-card group",
                          isTodays && "ring-1 ring-primary/30 bg-primary/[0.02]"
                        )}
                        onClick={() => onEventClick(compromisso)}
                      >
                        <div className={cn(
                          "text-center shrink-0 w-12 py-2.5 rounded-xl font-bold",
                          isTodays 
                            ? "bg-primary text-primary-foreground shadow-soft" 
                            : "bg-muted/40"
                        )}>
                          <p className="text-xl leading-none">
                            {format(parseLocalDate(compromisso.data_inicio), 'dd')}
                          </p>
                          <p className="text-[9px] uppercase mt-1 opacity-60 font-bold tracking-wider">
                            {format(parseLocalDate(compromisso.data_inicio), 'MMM', { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight">
                            {compromisso.titulo}
                          </p>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="font-semibold">{format(parseLocalDate(compromisso.data_inicio), "HH:mm")}</span>
                            </span>
                            {ModalidadeIcon ? (
                              <span className={cn("flex items-center gap-1 font-medium", modalidade.color)}>
                                <ModalidadeIcon className="h-3 w-3 shrink-0" />
                                <span>{modalidade.label}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors.dot)} />
                                <span className={cn("font-medium", colors.text)}>{compromisso.tipo}</span>
                              </span>
                            )}
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
