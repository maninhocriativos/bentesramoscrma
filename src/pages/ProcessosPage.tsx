import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ProcessosTable } from '@/components/processos/ProcessosTable';
import { useProcessos } from '@/hooks/useProcessos';
import { usePerfil } from '@/hooks/usePerfil';
import { useLeadNames } from '@/hooks/useLeadNames';
import { Processo } from '@/types/processos';
import { ImportProcessosCsvModal } from '@/components/processos/ImportProcessosCsvModal';
import { SyncProcessosModal } from '@/components/processos/SyncProcessosModal';

const ProcessoModalExpanded = lazy(() => import('@/components/processos/ProcessoModalExpanded').then(m => ({ default: m.ProcessoModalExpanded })));
const ConsultaProcessoExterno = lazy(() => import('@/components/processos/ConsultaProcessoExterno').then(m => ({ default: m.ConsultaProcessoExterno })));
import { 
  Loader2, Search, Scale, Plus, 
  CheckCircle2, PauseCircle, Archive, Trophy, XCircle,
  RefreshCw, SlidersHorizontal, Upload, Briefcase, Gavel, FileCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ProcessosPage() {
  const navigate = useNavigate();
  const { processos, loading } = useProcessos();
  const { leadNames } = useLeadNames();
  const { canDelete, canAccessProcessos, loading: perfilLoading } = usePerfil();
  
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const handleProcessoClick = useCallback((processo: Processo) => {
    setSelectedProcesso(processo);
    setIsNew(false);
    setIsModalOpen(true);
  }, []);

  const handleNewProcesso = useCallback(() => {
    setSelectedProcesso(null);
    setIsNew(true);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProcesso(null);
    setIsNew(false);
  }, []);

  useEffect(() => {
    if (!perfilLoading && !canAccessProcessos) {
      navigate('/dashboard');
    }
  }, [perfilLoading, canAccessProcessos, navigate]);

  const kpis = useMemo(() => {
    const total = processos.length;
    const emAndamento = processos.filter(p => p.status === 'Em Andamento').length;
    const suspensos = processos.filter(p => p.status === 'Suspenso').length;
    const arquivados = processos.filter(p => p.status === 'Arquivado').length;
    const ganhos = processos.filter(p => p.status === 'Ganho').length;
    const perdidos = processos.filter(p => p.status === 'Perdido').length;
    return { total, emAndamento, suspensos, arquivados, ganhos, perdidos };
  }, [processos]);

  const filteredProcessos = useMemo(() => processos.filter(p => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !search || (
      (p.numero_processo?.toLowerCase().includes(search)) ||
      (p.titulo_acao?.toLowerCase().includes(search)) ||
      (p.advogado_responsavel?.toLowerCase().includes(search)) ||
      (p.assunto?.toLowerCase().includes(search)) ||
      (p.orgao_julgador?.toLowerCase().includes(search)) ||
      (p.nome_cliente?.toLowerCase().includes(search)) ||
      (p.cpf_cliente?.includes(search)) ||
      (p.classe_cnj?.toLowerCase().includes(search))
    );
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [processos, searchTerm, statusFilter]);

  if (perfilLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!canAccessProcessos) return null;

  const kpiCards = [
    { label: 'Total', value: kpis.total, icon: Scale, color: 'text-foreground', bg: 'bg-card', filterKey: 'todos' },
    { label: 'Em Andamento', value: kpis.emAndamento, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', filterKey: 'Em Andamento' },
    { label: 'Suspensos', value: kpis.suspensos, icon: PauseCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', filterKey: 'Suspenso' },
    { label: 'Arquivados', value: kpis.arquivados, icon: Archive, color: 'text-muted-foreground', bg: 'bg-muted', filterKey: 'Arquivado' },
    { label: 'Ganhos', value: kpis.ganhos, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', filterKey: 'Ganho' },
    { label: 'Perdidos', value: kpis.perdidos, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', filterKey: 'Perdido' },
    { label: 'Recursal', value: null, icon: Gavel, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', filterKey: 'recursal' },
    { label: 'Execução', value: null, icon: FileCheck, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', filterKey: 'execucao' },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary hidden md:block" />
              <h1 className="text-base md:text-xl font-semibold text-foreground truncate">Processos</h1>
              <Badge variant="outline" className="rounded-lg text-xs hidden md:inline-flex">
                {processos.length}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncModal(true)}
              className="rounded-xl h-8 md:h-9 text-xs md:text-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden md:inline">Sincronizar</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="rounded-xl bg-primary hover:bg-primary/90 shadow-soft h-8 md:h-9 px-2.5 md:px-4"
                  size="sm"
                >
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleNewProcesso}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Processo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportCsv(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      <div className="flex-1 p-4 md:p-6 space-y-5 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {kpiCards.map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => {
                if (kpi.value !== null) setStatusFilter(kpi.filterKey);
              }}
              className={`flex flex-col items-center gap-1 p-3 md:p-4 rounded-xl border border-border/50 transition-all hover:shadow-md ${
                kpi.value === null
                  ? 'opacity-60 cursor-default'
                  : statusFilter === kpi.filterKey
                    ? 'ring-2 ring-primary/30 shadow-md bg-card' 
                    : kpi.bg
              }`}
            >
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              {kpi.value !== null ? (
                <span className={`text-xl md:text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground/60 font-medium">Em breve</span>
              )}
              <span className="text-[10px] md:text-xs text-muted-foreground font-medium">{kpi.label}</span>
            </button>
          ))}
        </div>

        <Tabs defaultValue="internos" className="w-full">
          <TabsList className="mb-4 h-auto p-1 gap-1">
            <TabsTrigger value="internos" className="gap-1.5 px-3 py-2 text-xs md:text-sm">
              <Briefcase className="h-4 w-4" />
              Processos do Escritório
            </TabsTrigger>
            <TabsTrigger value="recursal" className="gap-1.5 px-3 py-2 text-xs md:text-sm">
              <Gavel className="h-4 w-4" />
              Recursal
            </TabsTrigger>
            <TabsTrigger value="execucao" className="gap-1.5 px-3 py-2 text-xs md:text-sm">
              <FileCheck className="h-4 w-4" />
              Execução
            </TabsTrigger>
            <TabsTrigger value="consulta" className="gap-1.5 px-3 py-2 text-xs md:text-sm">
              <Search className="h-4 w-4" />
              Consultar CNJ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internos" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="relative flex-1 w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, título, advogado ou assunto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl shadow-soft border-0"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] rounded-xl shadow-soft border-0">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Arquivado">Arquivado</SelectItem>
                  <SelectItem value="Ganho">Ganho</SelectItem>
                  <SelectItem value="Perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
              {statusFilter !== 'todos' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setStatusFilter('todos')} 
                  className="text-xs text-muted-foreground"
                >
                  Limpar filtro
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ProcessosTable 
                processos={filteredProcessos} 
                onProcessoClick={handleProcessoClick}
                leads={leadNames}
              />
            )}
          </TabsContent>

          <TabsContent value="recursal" className="space-y-4">
            <div className="text-center py-16 bg-card rounded-xl shadow-soft border border-border">
              <Scale className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">Fase Recursal</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Em breve: acompanhamento de recursos e segunda instância.</p>
            </div>
          </TabsContent>

          <TabsContent value="execucao" className="space-y-4">
            <div className="text-center py-16 bg-card rounded-xl shadow-soft border border-border">
              <Scale className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">Fase de Execução</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Em breve: controle de execução, cálculos e cumprimento de sentença.</p>
            </div>
          </TabsContent>

          <TabsContent value="consulta">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
              <ConsultaProcessoExterno />
            </Suspense>
          </TabsContent>
        </Tabs>
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
