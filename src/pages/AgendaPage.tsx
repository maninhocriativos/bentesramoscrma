import { memo, useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Calendar } from '@/components/agenda/Calendar';
import { AgendaKPIs } from '@/components/agenda/AgendaKPIs';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { DayEventsModal } from '@/components/agenda/DayEventsModal';
import { GoogleCalendarConnect } from '@/components/agenda/GoogleCalendarConnect';
import { useCompromissos } from '@/hooks/useCompromissos';
import { useIntimacoes } from '@/hooks/useIntimacoes';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { Loader2, Plus, Filter, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ColorMode = 'tipo' | 'situacao';
export type ViewMode  = 'mes' | 'semana' | 'dia';

const TIPO_OPTIONS = [
  { value: 'Audiência', label: 'Audiências',  color: 'bg-[#be185d]' },
  { value: 'Reunião',   label: 'Reuniões',    color: 'bg-[#b45309]' },
  { value: 'Prazo',     label: 'Prazos',      color: 'bg-[#92400e]' },
  { value: 'Tarefa',    label: 'Tarefas',     color: 'bg-[#065f46]' },
  { value: 'Outro',     label: 'Outros',      color: 'bg-[#374151]' },
  { value: 'Intimação', label: 'Intimações',  color: 'bg-[#7c3aed]' },
];

const SITUACAO_OPTIONS = [
  { value: 'pendente',   label: 'Pendente',   color: 'bg-[#78350f]' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-[#065f46]' },
  { value: 'cancelado',  label: 'Cancelado',  color: 'bg-[#7f1d1d]' },
  { value: 'remarcado',  label: 'Remarcado',  color: 'bg-[#1e3a5f]' },
];

function AgendaPage() {
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

  const filteredCompromissos = compromissos.filter(c => {
    if (!activeTipos.includes(c.tipo)) return false;
    if (!activeSituacoes.includes(c.confirmacao_status || 'pendente')) return false;
    return true;
  });
  const filteredIntimacoes = activeTipos.includes('Intimação') ? intimacoes : [];

  const toggleTipo = (t: string) =>
    setActiveTipos(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleSituacao = (s: string) =>
    setActiveSituacoes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const hasActiveFilters =
    activeTipos.length !== TIPO_OPTIONS.length ||
    activeSituacoes.length !== SITUACAO_OPTIONS.length;

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDayEventsModalOpen(true);
  };
  const handleEventClick = (c: Compromisso) => {
    setSelectedCompromisso(c);
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
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-[#c9a96e]/20">
        <div className="flex items-center justify-between px-5 py-3 md:px-8">
          <h1 className="text-xl font-bold text-[#3d2b1f] dark:text-[#c9a96e] tracking-tight">
            Agenda
          </h1>

          <div className="flex items-center gap-2">
            {/* Toggle Tipo/Situação */}
            <div className="hidden md:inline-flex items-center border border-[#c9a96e]/25 rounded-xl overflow-hidden bg-card">
              {(['tipo', 'situacao'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setColorMode(tab)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-all',
                    i === 0 && 'border-r border-[#c9a96e]/20',
                    colorMode === tab
                      ? 'bg-[#3d2b1f] text-[#c9a96e]'
                      : 'text-muted-foreground hover:bg-[#c9a96e]/8'
                  )}
                >
                  {tab === 'tipo' ? 'Tipo' : 'Situação'}
                </button>
              ))}
            </div>

            {/* Filtros */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'gap-1.5 text-xs h-8 rounded-xl border-[#c9a96e]/25 relative',
                    hasActiveFilters && 'border-[#c9a96e] text-[#3d2b1f]'
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#c9a96e] rounded-full" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipos</DropdownMenuLabel>
                {TIPO_OPTIONS.map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={activeTipos.includes(opt.value)}
                    onCheckedChange={() => toggleTipo(opt.value)}
                    className="text-xs gap-2"
                  >
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', opt.color)} />
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Situação</DropdownMenuLabel>
                {SITUACAO_OPTIONS.map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={activeSituacoes.includes(opt.value)}
                    onCheckedChange={() => toggleSituacao(opt.value)}
                    className="text-xs gap-2"
                  >
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', opt.color)} />
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
                      className="text-xs text-[#c9a96e] font-semibold"
                    >
                      Limpar filtros
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-xl border-[#c9a96e]/25"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>

            <GoogleCalendarConnect />

            {/* Novo */}
            <Button
              onClick={handleNewCompromisso}
              size="sm"
              className="gap-1.5 text-xs h-8 rounded-xl bg-[#3d2b1f] hover:bg-[#5c3d2e] text-[#c9a96e] border border-[#c9a96e]/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-4 md:p-6 animate-fade-in overflow-auto">
        {loading || loadingIntimacoes ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[#c9a96e]/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#c9a96e]" />
            </div>
            <p className="text-sm text-muted-foreground">Carregando agenda...</p>
          </div>
        ) : (
          <>
            <AgendaKPIs compromissos={filteredCompromissos} intimacoes={filteredIntimacoes} />
            <div className="mt-4">
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
            </div>
          </>
        )}
      </div>

      <DayEventsModal
        isOpen={isDayEventsModalOpen}
        onClose={() => setIsDayEventsModalOpen(false)}
        date={selectedDate}
        compromissos={filteredCompromissos}
        intimacoes={filteredIntimacoes}
        onEventClick={handleEventClick}
        onNewEvent={() => { setIsDayEventsModalOpen(false); setIsModalOpen(true); }}
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

export default memo(AgendaPage);
