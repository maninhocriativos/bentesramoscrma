import { memo, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Calendar } from '@/components/agenda/Calendar';
import { AgendaKPIs } from '@/components/agenda/AgendaKPIs';
import { AgendaListView } from '@/components/agenda/AgendaListView';
import { AgendaPDFModal } from '@/components/agenda/AgendaPDFModal';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { DayEventsModal } from '@/components/agenda/DayEventsModal';
import { GoogleCalendarConnect } from '@/components/agenda/GoogleCalendarConnect';
import { useCompromissos } from '@/hooks/useCompromissos';
import { useIntimacoes } from '@/hooks/useIntimacoes';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import {
  Loader2, Plus, Filter, Search, List, CalendarDays, FileText, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, addDays, isWithinInterval,
} from 'date-fns';

export type ColorMode = 'tipo' | 'situacao';
export type ViewMode  = 'mes' | 'semana' | 'dia';
type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'next30';
type ViewLayout   = 'calendario' | 'lista';

const TIPO_OPTIONS = [
  { value: 'Audiência', label: 'Audiências',  color: 'bg-pink-600' },
  { value: 'Reunião',   label: 'Reuniões',    color: 'bg-amber-500' },
  { value: 'Prazo',     label: 'Prazos',      color: 'bg-yellow-500' },
  { value: 'Tarefa',    label: 'Tarefas',     color: 'bg-green-600' },
  { value: 'Outro',     label: 'Outros',      color: 'bg-slate-400' },
  { value: 'Intimação', label: 'Intimações',  color: 'bg-red-600' },
];

const SITUACAO_OPTIONS = [
  { value: 'pendente',   label: 'Pendente',   color: 'bg-amber-500' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-green-600' },
  { value: 'cancelado',  label: 'Cancelado',  color: 'bg-red-500' },
  { value: 'remarcado',  label: 'Remarcado',  color: 'bg-blue-500' },
];

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all:    'Todos',
  today:  'Hoje',
  week:   'Semana',
  month:  'Mês',
  next30: '30 dias',
};

function AgendaPage() {
  const {
    compromissos, loading,
    createCompromisso, updateCompromisso, deleteCompromisso,
  } = useCompromissos();
  const { intimacoes, loading: loadingIntimacoes } = useIntimacoes();

  const [selectedDate, setSelectedDate]         = useState<Date | null>(null);
  const [selectedCompromisso, setSelectedCompromisso] = useState<Compromisso | null>(null);
  const [isModalOpen, setIsModalOpen]           = useState(false);
  const [isDayEventsModalOpen, setIsDayEventsModalOpen] = useState(false);
  const [colorMode, setColorMode]               = useState<ColorMode>('tipo');
  const [viewMode, setViewMode]                 = useState<ViewMode>('mes');
  const [activeTipos, setActiveTipos]           = useState<string[]>(TIPO_OPTIONS.map(o => o.value));
  const [activeSituacoes, setActiveSituacoes]   = useState<string[]>(SITUACAO_OPTIONS.map(o => o.value));
  const [searchQuery, setSearchQuery]           = useState('');
  const [periodFilter, setPeriodFilter]         = useState<PeriodFilter>('all');
  const [viewLayout, setViewLayout]             = useState<ViewLayout>('calendario');
  const [showPDFModal, setShowPDFModal]         = useState(false);

  const filteredCompromissos = useMemo(() => {
    const now = new Date();
    let result = compromissos.filter(c => {
      if (!activeTipos.includes(c.tipo)) return false;
      if (!activeSituacoes.includes(c.confirmacao_status || 'pendente')) return false;
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.titulo.toLowerCase().includes(q) ||
        (c.descricao || '').toLowerCase().includes(q)
      );
    }

    if (periodFilter !== 'all') {
      let start: Date, end: Date;
      switch (periodFilter) {
        case 'today':
          start = startOfDay(now); end = endOfDay(now); break;
        case 'week':
          start = startOfWeek(now, { weekStartsOn: 1 }); end = endOfWeek(now, { weekStartsOn: 1 }); break;
        case 'month':
          start = startOfMonth(now); end = endOfMonth(now); break;
        case 'next30':
          start = startOfDay(now); end = endOfDay(addDays(now, 30)); break;
        default:
          start = new Date(0); end = new Date(8640000000000000);
      }
      result = result.filter(c => isWithinInterval(new Date(c.data_inicio), { start, end }));
    }

    return result;
  }, [compromissos, activeTipos, activeSituacoes, searchQuery, periodFilter]);

  const filteredIntimacoes = activeTipos.includes('Intimação') ? intimacoes : [];

  const toggleTipo     = (t: string) => setActiveTipos(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleSituacao = (s: string) => setActiveSituacoes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const hasActiveFilters =
    activeTipos.length !== TIPO_OPTIONS.length ||
    activeSituacoes.length !== SITUACAO_OPTIONS.length;

  const handleDayClick      = (date: Date) => { setSelectedDate(date); setIsDayEventsModalOpen(true); };
  const handleEventClick    = (c: Compromisso) => { setSelectedCompromisso(c); setSelectedDate(null); setIsModalOpen(true); };
  const handleCloseModal    = () => { setIsModalOpen(false); setSelectedDate(null); setSelectedCompromisso(null); };
  const handleNewCompromisso = () => { setSelectedDate(new Date()); setSelectedCompromisso(null); setIsModalOpen(true); };
  const handleStatusChange  = async (id: string, s: ConfirmacaoStatus) => { await updateCompromisso(id, { confirmacao_status: s }); };

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.2)' }}>

        {/* Row 1: title + controls */}
        <div className="flex items-center justify-between px-5 py-3 md:px-8">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#3d2b1f', letterSpacing: '-0.01em' }} className="dark:text-[#c9a96e]">
            Agenda
          </h1>

          <div className="flex items-center gap-2">
            {/* Color mode toggle */}
            <div className="hidden md:inline-flex items-center rounded-xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)' }}>
              {(['tipo', 'situacao'] as const).map((tab, i) => (
                <button key={tab} onClick={() => setColorMode(tab)} className="transition-all" style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: colorMode === tab ? '#3d2b1f' : 'transparent', color: colorMode === tab ? '#c9a96e' : '#6b7280', borderRight: i === 0 ? '0.5px solid rgba(201,169,110,0.2)' : 'none', cursor: 'pointer' }}>
                  {tab === 'tipo' ? 'Tipo' : 'Situação'}
                </button>
              ))}
            </div>

            {/* Type/Status filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn('gap-1.5 text-xs h-8 rounded-xl relative', hasActiveFilters ? 'border-[#c9a96e] text-[#3d2b1f]' : 'border-[rgba(201,169,110,0.25)]')}>
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#c9a96e] rounded-full" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipos</DropdownMenuLabel>
                {TIPO_OPTIONS.map(opt => (
                  <DropdownMenuCheckboxItem key={opt.value} checked={activeTipos.includes(opt.value)} onCheckedChange={() => toggleTipo(opt.value)} className="text-xs gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', opt.color)} />
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Situação</DropdownMenuLabel>
                {SITUACAO_OPTIONS.map(opt => (
                  <DropdownMenuCheckboxItem key={opt.value} checked={activeSituacoes.includes(opt.value)} onCheckedChange={() => toggleSituacao(opt.value)} className="text-xs gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', opt.color)} />
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked={false} onCheckedChange={() => { setActiveTipos(TIPO_OPTIONS.map(o => o.value)); setActiveSituacoes(SITUACAO_OPTIONS.map(o => o.value)); }} className="text-xs font-semibold" style={{ color: '#c9a96e' }}>
                      Limpar filtros
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <GoogleCalendarConnect />

            <button onClick={handleNewCompromisso} className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-colors" style={{ background: '#3d2b1f', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.3)' }}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo</span>
            </button>
          </div>
        </div>

        {/* Row 2: search + period + layout + PDF */}
        <div className="flex items-center gap-2 px-5 pb-2.5 md:px-8 flex-wrap" style={{ borderTop: '0.5px solid rgba(201,169,110,0.1)' }}>

          {/* Search */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar compromisso..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-7 text-xs rounded-xl bg-muted/40 border border-[rgba(201,169,110,0.2)] focus:outline-none focus:border-[#c9a96e] focus:bg-background transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Period filter */}
          <div className="inline-flex items-center rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.2)' }}>
            {(['all', 'today', 'week', 'month', 'next30'] as PeriodFilter[]).map((p, i, arr) => (
              <button key={p} onClick={() => setPeriodFilter(p)} className="transition-all" style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: periodFilter === p ? '#3d2b1f' : 'transparent', color: periodFilter === p ? '#c9a96e' : '#6b7280', borderRight: i < arr.length - 1 ? '0.5px solid rgba(201,169,110,0.15)' : 'none' }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Calendar / List toggle */}
            <div className="inline-flex items-center rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.25)' }}>
              {(['calendario', 'lista'] as ViewLayout[]).map((v, i) => (
                <button key={v} onClick={() => setViewLayout(v)} className="flex items-center gap-1.5 transition-all" style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', background: viewLayout === v ? '#3d2b1f' : 'transparent', color: viewLayout === v ? '#c9a96e' : '#6b7280', borderRight: i === 0 ? '0.5px solid rgba(201,169,110,0.2)' : 'none' }}>
                  {v === 'calendario'
                    ? <><CalendarDays className="h-3 w-3" /><span className="hidden sm:inline ml-1">Calendário</span></>
                    : <><List className="h-3 w-3" /><span className="hidden sm:inline ml-1">Lista</span></>}
                </button>
              ))}
            </div>

            {/* PDF button */}
            <button onClick={() => setShowPDFModal(true)} className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-semibold transition-colors hover:opacity-80" style={{ background: 'rgba(201,169,110,0.12)', color: '#3d2b1f', border: '0.5px solid rgba(201,169,110,0.3)' }}>
              <FileText className="h-3.5 w-3.5" style={{ color: '#c9a96e' }} />
              <span className="hidden sm:inline">Gerar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 p-4 md:p-6 overflow-auto animate-fade-in">
        {loading || loadingIntimacoes ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.1)' }}>
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#c9a96e' }} />
            </div>
            <p className="text-sm text-muted-foreground">Carregando agenda...</p>
          </div>
        ) : (
          <>
            <AgendaKPIs compromissos={filteredCompromissos} intimacoes={filteredIntimacoes} />
            <div className="mt-4">
              {viewLayout === 'calendario' ? (
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
              ) : (
                <AgendaListView
                  compromissos={filteredCompromissos}
                  onEventClick={handleEventClick}
                  onStatusChange={handleStatusChange}
                />
              )}
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
        createCompromisso={createCompromisso}
        updateCompromisso={updateCompromisso}
        deleteCompromisso={deleteCompromisso}
      />

      {showPDFModal && (
        <AgendaPDFModal
          onClose={() => setShowPDFModal(false)}
          compromissos={compromissos}
        />
      )}
    </AppLayout>
  );
}

export default memo(AgendaPage);
