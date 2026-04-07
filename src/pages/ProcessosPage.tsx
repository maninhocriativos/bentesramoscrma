import { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ProcessosTable } from '@/components/processos/ProcessosTable';
import { useProcessos } from '@/hooks/useProcessos';
import { usePerfil } from '@/hooks/usePerfil';
import { useLeadNames } from '@/hooks/useLeadNames';
import { Processo } from '@/types/processos';
import { ImportProcessosCsvModal } from '@/components/processos/ImportProcessosCsvModal';
import { SyncProcessosModal } from '@/components/processos/SyncProcessosModal';
import {
  Loader2, Search, Scale, Plus,
  CheckCircle2, PauseCircle, Archive, Trophy, XCircle,
  RefreshCw, SlidersHorizontal, Upload, Gavel, FileCheck, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ProcessoModalExpanded = lazy(() =>
  import('@/components/processos/ProcessoModalExpanded').then(m => ({ default: m.ProcessoModalExpanded }))
);
const ConsultaProcessoExterno = lazy(() =>
  import('@/components/processos/ConsultaProcessoExterno').then(m => ({ default: m.ConsultaProcessoExterno }))
);

function KpiCard({
  label, value, icon: Icon, color, bg, active, onClick,
}: {
  label: string; value: number; icon: React.ElementType;
  color: string; bg: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${
        active
          ? 'ring-2 ring-primary/40 shadow-md bg-card border-primary/20'
          : `${bg} border-border/40 hover:shadow-sm hover:border-border`
      }`}
    >
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-xl font-bold leading-none ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">{label}</span>
    </button>
  );
}

type ViewTab = 'internos' | 'consulta';

function ProcessosPage() {
  const navigate = useNavigate();
  const { processos, loading } = useProcessos();
  const { leadNames }          = useLeadNames();
  const { canDelete, canAccessProcessos, loading: perfilLoading } = usePerfil();

  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isModalOpen,       setIsModalOpen]       = useState(false);
  const [isNew,             setIsNew]             = useState(false);
  const [searchTerm,        setSearchTerm]        = useState('');
  const [statusFilter,      setStatusFilter]      = useState('todos');
  const [activeView,        setActiveView]        = useState<ViewTab>('internos');
  const [showImportCsv,     setShowImportCsv]     = useState(false);
  const [showSyncModal,     setShowSyncModal]     = useState(false);

  const handleProcessoClick = useCallback((p: Processo) => {
    setSelectedProcesso(p); setIsNew(false); setIsModalOpen(true);
  }, []);

  const handleNewProcesso = useCallback(() => {
    setSelectedProcesso(null); setIsNew(true); setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false); setSelectedProcesso(null); setIsNew(false);
  }, []);

  useEffect(() => {
    if (!perfilLoading && !canAccessProcessos) navigate('/dashboard');
  }, [perfilLoading, canAccessProcessos, navigate]);

  const kpis = useMemo(() => ({
    total:       processos.length,
    emAndamento: processos.filter(p => p.status === 'Em Andamento').length,
    suspensos:   processos.filter(p => p.status === 'Suspenso').length,
    arquivados:  processos.filter(p => p.status === 'Arquivado').length,
    ganhos:      processos.filter(p => p.status === 'Ganho').length,
    perdidos:    processos.filter(p => p.status === 'Perdido').length,
    recursal:    processos.filter(p => p.fase?.toLowerCase() === 'recursal').length,
    execucao:    processos.filter(p => ['execução','execucao'].includes(p.fase?.toLowerCase() || '')).length,
  }), [processos]);

  const filteredProcessos = useMemo(() => processos.filter(p => {
    const s = searchTerm.toLowerCase();
    const matchSearch = !s || [
      p.numero_processo, p.titulo_acao, p.advogado_responsavel,
      p.assunto, p.orgao_julgador, p.nome_cliente, p.cpf_cliente, p.classe_cnj,
    ].some(v => v?.toLowerCase().includes(s));

    let matchStatus = true;
    if (statusFilter === 'recursal')      matchStatus = p.fase?.toLowerCase() === 'recursal';
    else if (statusFilter === 'execucao') matchStatus = ['execução','execucao'].includes(p.fase?.toLowerCase() || '');
    else if (statusFilter !== 'todos')    matchStatus = p.status === statusFilter;

    return matchSearch && matchStatus;
  }), [processos, searchTerm, statusFilter]);

  if (perfilLoading) return <AppLayout><PageSkeleton cards={5} rows={8} /></AppLayout>;
  if (!canAccessProcessos) return null;

  const kpiCards = [
    { label: 'Total',        value: kpis.total,       icon: Scale,        color: 'text-foreground',       bg: 'bg-card',                              filterKey: 'todos'        },
    { label: 'Em Andamento', value: kpis.emAndamento, icon: CheckCircle2, color: 'text-blue-600',         bg: 'bg-blue-50 dark:bg-blue-950/30',       filterKey: 'Em Andamento' },
    { label: 'Suspensos',    value: kpis.suspensos,   icon: PauseCircle,  color: 'text-amber-600',        bg: 'bg-amber-50 dark:bg-amber-950/30',     filterKey: 'Suspenso'     },
    { label: 'Arquivados',   value: kpis.arquivados,  icon: Archive,      color: 'text-muted-foreground', bg: 'bg-muted',                             filterKey: 'Arquivado'    },
    { label: 'Ganhos',       value: kpis.ganhos,      icon: Trophy,       color: 'text-emerald-600',      bg: 'bg-emerald-50 dark:bg-emerald-950/30', filterKey: 'Ganho'        },
    { label: 'Perdidos',     value: kpis.perdidos,    icon: XCircle,      color: 'text-red-600',          bg: 'bg-red-50 dark:bg-red-950/30',         filterKey: 'Perdido'      },
    { label: 'Recursal',     value: kpis.recursal,    icon: Gavel,        color: 'text-purple-600',       bg: 'bg-purple-50 dark:bg-purple-950/30',   filterKey: 'recursal'     },
    { label: 'Execução',     value: kpis.execucao,    icon: FileCheck,    color: 'text-orange-600',       bg: 'bg-orange-50 dark:bg-orange-950/30',   filterKey: 'execucao'     },
  ];

  return (
    <AppLayout>
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 w-full bg-card/90 backdrop-blur-md border-b border-border">
        <div className="flex h-14 items-center justify-between px-4 md:px-6 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <Scale className="h-5 w-5 text-primary shrink-0 hidden md:block" />
            <h1 className="text-base md:text-lg font-bold text-foreground truncate">Processos</h1>
            <Badge variant="outline" className="rounded-lg text-xs shrink-0">{processos.length}</Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowSyncModal(true)} className="rounded-xl h-9 gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-xl h-9 gap-1.5 px-3 md:px-4">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={handleNewProcesso}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Processo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportCsv(true)}>
                  <Upload className="h-4 w-4 mr-2" /> Importar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-4">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {kpiCards.map(kpi => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              color={kpi.color}
              bg={kpi.bg}
              active={statusFilter === kpi.filterKey}
              onClick={() => setStatusFilter(kpi.filterKey)}
            />
          ))}
        </div>

        {/* ── Barra de controles ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

          {/* Switcher */}
          <div className="flex items-center bg-muted/50 rounded-xl p-1 shrink-0 border border-border/40">
            <button
              onClick={() => setActiveView('internos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'internos'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Escritório
            </button>
            <button
              onClick={() => setActiveView('consulta')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'consulta'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Consultar CNJ
            </button>
          </div>

          {/* Busca + Filtro */}
          {activeView === 'internos' && (
            <div className="flex flex-1 items-center gap-2 w-full">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Número, cliente, advogado, assunto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 rounded-xl bg-card border-border/50"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9 rounded-xl bg-card border-border/50 shrink-0">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Arquivado">Arquivado</SelectItem>
                  <SelectItem value="Ganho">Ganho</SelectItem>
                  <SelectItem value="Perdido">Perdido</SelectItem>
                  <SelectItem value="recursal">Recursal</SelectItem>
                  <SelectItem value="execucao">Execução</SelectItem>
                </SelectContent>
              </Select>

              {statusFilter !== 'todos' && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('todos')} className="h-9 px-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              )}

              {(searchTerm || statusFilter !== 'todos') && (
                <span className="text-xs text-muted-foreground shrink-0 hidden md:inline">
                  {filteredProcessos.length} resultado{filteredProcessos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Conteúdo ── */}
        {activeView === 'internos' ? (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ProcessosTable processos={filteredProcessos} onProcessoClick={handleProcessoClick} leads={leadNames} />
          )
        ) : (
          <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <ConsultaProcessoExterno />
          </Suspense>
        )}
      </div>

      {isModalOpen && (
        <Suspense fallback={null}>
          <ProcessoModalExpanded
            processo={selectedProcesso}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            isNew={isNew}
            canDelete={canDelete}
            leads={leadNames}
          />
        </Suspense>
      )}

      <ImportProcessosCsvModal isOpen={showImportCsv} onClose={() => setShowImportCsv(false)} />
      <SyncProcessosModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} totalProcessos={processos.length} />
    </AppLayout>
  );
}

export default memo(ProcessosPage);
