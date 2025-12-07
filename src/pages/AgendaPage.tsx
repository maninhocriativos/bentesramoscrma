import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Calendar } from '@/components/agenda/Calendar';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { useCompromissos } from '@/hooks/useCompromissos';
import { Compromisso } from '@/types/compromissos';
import { Loader2, CalendarDays, Gavel, Clock, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FilterType = 'todos' | 'Prazo' | 'Audiência' | 'Reunião';

export default function AgendaPage() {
  const { compromissos, loading } = useCompromissos();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<Compromisso | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('todos');

  const filteredCompromissos = filter === 'todos' 
    ? compromissos 
    : compromissos.filter(c => c.tipo === filter);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedCompromisso(null);
    setIsModalOpen(true);
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

  const filters: { label: string; value: FilterType; icon: typeof CalendarDays }[] = [
    { label: 'Todos', value: 'todos', icon: CalendarDays },
    { label: 'Meus Prazos', value: 'Prazo', icon: Clock },
    { label: 'Audiências', value: 'Audiência', icon: Gavel },
    { label: 'Reuniões', value: 'Reunião', icon: CheckSquare },
  ];

  return (
    <AppLayout>
      <AppHeader 
        title="Agenda" 
        onNewItem={handleNewCompromisso}
        newItemLabel="Novo Compromisso"
      />
      
      <div className="flex-1 p-4 md:p-6 space-y-4 animate-fade-in">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map(({ label, value, icon: Icon }) => (
            <Button
              key={value}
              variant={filter === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full",
                filter === value && "bg-primary text-primary-foreground"
              )}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Calendar
            compromissos={filteredCompromissos}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      <CompromissoModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        compromisso={selectedCompromisso}
        selectedDate={selectedDate || undefined}
      />
    </AppLayout>
  );
}
