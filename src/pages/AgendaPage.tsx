import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Calendar } from '@/components/agenda/Calendar';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { DayEventsModal } from '@/components/agenda/DayEventsModal';
import { GoogleCalendarConnect } from '@/components/agenda/GoogleCalendarConnect';
import { ConfirmacoesPendentes } from '@/components/agenda/ConfirmacoesPendentes';
import { useCompromissos } from '@/hooks/useCompromissos';
import { useIntimacoes, type IntimacaoEvent } from '@/hooks/useIntimacoes';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { 
  Loader2, 
  CalendarDays, 
  Gavel, 
  Clock, 
  Users,
  Plus,
  Phone,
  Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FilterType = 'todos' | 'Prazo' | 'Audiência' | 'Reunião' | 'Intimação';

export default function AgendaPage() {
  const { compromissos, loading, updateCompromisso } = useCompromissos();
  const { intimacoes, loading: loadingIntimacoes } = useIntimacoes();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<Compromisso | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [showConfirmacoes, setShowConfirmacoes] = useState(false);

  const filteredCompromissos = filter === 'todos' 
    ? compromissos 
    : filter === 'Intimação'
    ? []
    : compromissos.filter(c => c.tipo === filter);

  const filteredIntimacoes = filter === 'todos' || filter === 'Intimação'
    ? intimacoes
    : [];

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

  const handleStatusChange = async (id: string, newStatus: string) => {
    await updateCompromisso(id, { confirmacao_status: newStatus });
  };

  const filters: { label: string; value: FilterType; icon: typeof CalendarDays; dot: string }[] = [
    { label: 'Todos', value: 'todos', icon: CalendarDays, dot: 'bg-primary' },
    { label: 'Prazos', value: 'Prazo', icon: Clock, dot: 'bg-amber-500' },
    { label: 'Audiências', value: 'Audiência', icon: Gavel, dot: 'bg-red-500' },
    { label: 'Reuniões', value: 'Reunião', icon: Users, dot: 'bg-blue-500' },
    { label: 'Intimações', value: 'Intimação', icon: Scale, dot: 'bg-purple-500' },
  ];

  return (
    <AppLayout>
      {/* Premium Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center justify-between px-5 py-4 md:px-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
              Agenda
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredCompromissos.length} compromisso{filteredCompromissos.length !== 1 ? 's' : ''}
              {filteredIntimacoes.length > 0 && ` · ${filteredIntimacoes.length} intimaç${filteredIntimacoes.length !== 1 ? 'ões' : 'ão'}`}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showConfirmacoes ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowConfirmacoes(!showConfirmacoes)}
              className="gap-2 rounded-full"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Confirmações</span>
            </Button>
            
            <GoogleCalendarConnect />
            
            <Button 
              onClick={handleNewCompromisso}
              size="sm"
              className="gap-2 rounded-full shadow-enterprise"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Novo</span>
            </Button>
          </div>
        </div>

        {/* Premium Filter Pills */}
        <div className="flex items-center gap-1.5 px-5 pb-3 md:px-8 overflow-x-auto scrollbar-stable">
          {filters.map(({ label, value, dot }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                filter === value
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                filter === value ? "bg-primary-foreground" : dot
              )} />
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-4 md:p-6 animate-fade-in overflow-auto">
        {loading || loadingIntimacoes ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Carregando agenda...</p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            showConfirmacoes ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {showConfirmacoes && (
              <div className="lg:col-span-1 order-first lg:order-last">
                <ConfirmacoesPendentes 
                  compromissos={compromissos} 
                  onEventClick={handleEventClick} 
                />
              </div>
            )}
            
            <div className={showConfirmacoes ? "lg:col-span-2" : ""}>
              <Calendar
                compromissos={filteredCompromissos}
                intimacoes={filteredIntimacoes}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        )}
      </div>

      <DayEventsModal
        isOpen={isDayEventsModalOpen}
        onClose={() => setIsDayEventsModalOpen(false)}
        date={selectedDate}
        compromissos={filteredCompromissos}
        intimacoes={filteredIntimacoes}
        onEventClick={handleEventClick}
        onNewEvent={() => {
          setIsDayEventsModalOpen(false);
          setIsModalOpen(true);
        }}
        onStatusChange={handleStatusChange}
      />

      <CompromissoModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        compromisso={selectedCompromisso}
        selectedDate={selectedDate || undefined}
      />
    </AppLayout>
  );
}
