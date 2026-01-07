import { useState, useMemo } from 'react';
import { isPast, parseISO, isToday, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Calendar } from '@/components/agenda/Calendar';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { DayEventsModal } from '@/components/agenda/DayEventsModal';
import { GoogleCalendarConnect } from '@/components/agenda/GoogleCalendarConnect';
import { ConfirmacoesPendentes } from '@/components/agenda/ConfirmacoesPendentes';
import { useCompromissos } from '@/hooks/useCompromissos';
import { Compromisso } from '@/types/compromissos';
import { 
  Loader2, 
  CalendarDays, 
  Gavel, 
  Clock, 
  Users,
  Plus,
  Filter,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TIMEZONE = 'America/Manaus';

const parseLocalDate = (dateString: string): Date => {
  const utcDate = parseISO(dateString);
  return toZonedTime(utcDate, TIMEZONE);
};

type FilterType = 'todos' | 'Prazo' | 'Audiência' | 'Reunião';

export default function AgendaPage() {
  const { compromissos, loading } = useCompromissos();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<Compromisso | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [showConfirmacoes, setShowConfirmacoes] = useState(false);

  // Filter out past events (keep today and future)
  const activeCompromissos = useMemo(() => {
    const todayStart = startOfDay(new Date());
    return compromissos.filter(c => {
      const eventDate = parseLocalDate(c.data_inicio);
      return eventDate >= todayStart || isToday(eventDate);
    });
  }, [compromissos]);

  const filteredCompromissos = filter === 'todos' 
    ? activeCompromissos 
    : activeCompromissos.filter(c => c.tipo === filter);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDayEventsModalOpen(true);
  };

  const handleEventClick = (compromisso: Compromisso) => {
    setSelectedCompromisso(compromisso);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setSelectedCompromisso(null);
  };

  const handleNewCompromisso = () => {
    setSelectedDate(new Date());
    setSelectedCompromisso(null);
    setIsModalOpen(true);
  };

  const filters: { label: string; value: FilterType; icon: typeof CalendarDays; color: string }[] = [
    { label: 'Todos', value: 'todos', icon: CalendarDays, color: 'bg-primary' },
    { label: 'Prazos', value: 'Prazo', icon: Clock, color: 'bg-amber-500' },
    { label: 'Audiências', value: 'Audiência', icon: Gavel, color: 'bg-red-500' },
    { label: 'Reuniões', value: 'Reunião', icon: Users, color: 'bg-blue-500' },
  ];

  const currentFilter = filters.find(f => f.value === filter) || filters[0];

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4 md:px-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Agenda</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {filteredCompromissos.length} compromisso{filteredCompromissos.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showConfirmacoes ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowConfirmacoes(!showConfirmacoes)}
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Confirmações</span>
            </Button>
            
            <GoogleCalendarConnect />
            
            <Button 
              onClick={handleNewCompromisso}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        </div>

        {/* Filters - Desktop */}
        <div className="hidden md:flex items-center gap-2 px-6 pb-4">
          {filters.map(({ label, value, icon: Icon, color }) => (
            <Button
              key={value}
              variant={filter === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full gap-2 transition-all",
                filter === value && "shadow-md"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                filter === value ? "bg-primary-foreground" : color
              )} />
              {label}
            </Button>
          ))}
        </div>

        {/* Filters - Mobile Dropdown */}
        <div className="md:hidden px-4 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", currentFilter.color)} />
                  <span>{currentFilter.label}</span>
                </div>
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px] bg-popover">
              {filters.map(({ label, value, icon: Icon, color }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "gap-2 cursor-pointer",
                    filter === value && "bg-muted"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", color)} />
                  <span>{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Calendar Content */}
      <div className="flex-1 p-4 md:p-6 animate-fade-in overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando agenda...</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            showConfirmacoes ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {/* Panel de Confirmações */}
            {showConfirmacoes && (
              <div className="lg:col-span-1 order-first lg:order-last">
                <ConfirmacoesPendentes 
                  compromissos={compromissos} 
                  onEventClick={handleEventClick} 
                />
              </div>
            )}
            
            {/* Calendário */}
            <div className={showConfirmacoes ? "lg:col-span-2" : ""}>
              <Calendar
                compromissos={filteredCompromissos}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal para listar todos os eventos do dia */}
      <DayEventsModal
        isOpen={isDayEventsModalOpen}
        onClose={() => setIsDayEventsModalOpen(false)}
        date={selectedDate}
        compromissos={filteredCompromissos}
        onEventClick={handleEventClick}
        onNewEvent={() => {
          setIsDayEventsModalOpen(false);
          setIsModalOpen(true);
        }}
      />

      {/* Modal para criar/editar evento */}
      <CompromissoModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        compromisso={selectedCompromisso}
        selectedDate={selectedDate || undefined}
      />
    </AppLayout>
  );
}
