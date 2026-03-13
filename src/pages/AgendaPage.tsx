import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Calendar } from '@/components/agenda/Calendar';
import { AgendaKPIs } from '@/components/agenda/AgendaKPIs';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { DayEventsModal } from '@/components/agenda/DayEventsModal';
import { GoogleCalendarConnect } from '@/components/agenda/GoogleCalendarConnect';
import { useCompromissos } from '@/hooks/useCompromissos';
import { useIntimacoes } from '@/hooks/useIntimacoes';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { 
  Loader2, 
  Plus,
  Filter,
  Settings,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ColorMode = 'tipo' | 'situacao';
export type ViewMode = 'mes' | 'semana' | 'dia';

const TIPO_OPTIONS = [
  { value: 'Audiência', label: 'Audiências', color: 'bg-[#f472b6]' },
  { value: 'Reunião', label: 'Reuniões', color: 'bg-[#60a5fa]' },
  { value: 'Prazo', label: 'Prazos', color: 'bg-[#fbbf24]' },
  { value: 'Tarefa', label: 'Tarefas', color: 'bg-[#34d399]' },
  { value: 'Outro', label: 'Outros', color: 'bg-[#94a3b8]' },
  { value: 'Intimação', label: 'Intimações', color: 'bg-[#fb923c]' },
];

const SITUACAO_OPTIONS = [
  { value: 'pendente', label: 'Pendente', color: 'bg-[#fbbf24]' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-[#34d399]' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-[#f87171]' },
  { value: 'remarcado', label: 'Remarcado', color: 'bg-[#60a5fa]' },
];

export default function AgendaPage() {
  const { compromissos, loading, updateCompromisso } = useCompromissos();
  const { intimacoes, loading: loadingIntimacoes } = useIntimacoes();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<Compromisso | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('tipo');
  const [viewMode, setViewMode] = useState<ViewMode>('mes');
  const [activeTipos, setActiveTipos] = useState<string[]>(TIPO_OPTIONS.map(o => o.value));
  const [activeSituacoes, setActiveSituacoes] = useState<string[]>(SITUACAO_OPTIONS.map(o => o.value));

  // Filter compromissos based on active filters
  const filteredCompromissos = compromissos.filter(c => {
    if (!activeTipos.includes(c.tipo)) return false;
    const status = c.confirmacao_status || 'pendente';
    if (!activeSituacoes.includes(status)) return false;
    return true;
  });

  // Filter intimações
  const filteredIntimacoes = activeTipos.includes('Intimação') ? intimacoes : [];

  const toggleTipo = (tipo: string) => {
    setActiveTipos(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  const toggleSituacao = (sit: string) => {
    setActiveSituacoes(prev =>
      prev.includes(sit) ? prev.filter(s => s !== sit) : [...prev, sit]
    );
  };

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

  const allTiposActive = activeTipos.length === TIPO_OPTIONS.length;
  const allSituacoesActive = activeSituacoes.length === SITUACAO_OPTIONS.length;
  const hasActiveFilters = !allTiposActive || !allSituacoesActive;

  return (
    <AppLayout>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/60">
        <div className="flex items-center justify-between px-5 py-3 md:px-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
            Agenda
          </h1>
          
          <div className="flex items-center gap-2">
            {/* Tipo / Situação color mode toggle */}
            <div className="hidden md:inline-flex items-center border border-border/70 rounded-md overflow-hidden bg-card">
              {(['tipo', 'situacao'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setColorMode(tab)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all",
                    i === 0 && "border-r border-border/70",
                    colorMode === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  {tab === 'tipo' ? 'Tipo' : 'Situação'}
                </button>
              ))}
            </div>
            
            {/* Filtros dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "gap-1.5 text-xs h-8 rounded-md relative",
                    hasActiveFilters && "border-primary/50 text-primary"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Tipos de Evento
                </DropdownMenuLabel>
                {TIPO_OPTIONS.map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={activeTipos.includes(opt.value)}
                    onCheckedChange={() => toggleTipo(opt.value)}
                    className="text-xs gap-2"
                  >
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", opt.color)} />
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Situação
                </DropdownMenuLabel>
                {SITUACAO_OPTIONS.map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={activeSituacoes.includes(opt.value)}
                    onCheckedChange={() => toggleSituacao(opt.value)}
                    className="text-xs gap-2"
                  >
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", opt.color)} />
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onCheckedChange={() => {
                        setActiveTipos(TIPO_OPTIONS.map(o => o.value));
                        setActiveSituacoes(SITUACAO_OPTIONS.map(o => o.value));
                      }}
                      className="text-xs text-primary font-medium"
                    >
                      Limpar filtros
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
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
            compromissos={filteredCompromissos}
            intimacoes={filteredIntimacoes}
            colorMode={colorMode}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
