import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Calendar } from '@/components/agenda/Calendar';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { DayEventsModal } from '@/components/agenda/DayEventsModal';
import { GoogleCalendarConnect } from '@/components/agenda/GoogleCalendarConnect';
import { ConfirmacoesPendentes } from '@/components/agenda/ConfirmacoesPendentes';
import { useCompromissos } from '@/hooks/useCompromissos';
import { useIntimacoes } from '@/hooks/useIntimacoes';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { 
  Loader2, 
  Plus,
  Filter,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AgendaPage() {
  const { compromissos, loading, updateCompromisso } = useCompromissos();
  const { intimacoes, loading: loadingIntimacoes } = useIntimacoes();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<Compromisso | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'tipo' | 'situacao'>('tipo');

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

  const handleStatusChange = async (id: string, newStatus: ConfirmacaoStatus) => {
    await updateCompromisso(id, { confirmacao_status: newStatus });
  };

  return (
    <AppLayout>
      {/* Header matching reference */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center justify-between px-5 py-3 md:px-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
            Agenda
          </h1>
          
          <div className="flex items-center gap-2">
            {/* Tipo / Situação toggle - matching reference */}
            <div className="hidden md:inline-flex items-center border border-border/70 rounded-md overflow-hidden bg-card">
              {(['tipo', 'situacao'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilterTab(tab)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all",
                    i === 0 && "border-r border-border/70",
                    activeFilterTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  {tab === 'tipo' ? 'Tipo' : 'Situação'}
                </button>
              ))}
            </div>
            
            {/* Filtros button */}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 rounded-md">
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </Button>
            
            {/* Settings gear */}
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-md">
              <Settings className="h-3.5 w-3.5" />
            </Button>

            <GoogleCalendarConnect />
            
            <Button 
              onClick={handleNewCompromisso}
              size="sm"
              className="gap-1.5 text-xs h-8 rounded-md"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
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
          <Calendar
            compromissos={compromissos}
            intimacoes={intimacoes}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      <DayEventsModal
        isOpen={isDayEventsModalOpen}
        onClose={() => setIsDayEventsModalOpen(false)}
        date={selectedDate}
        compromissos={compromissos}
        intimacoes={intimacoes}
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
