import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ProcessosTable } from '@/components/processos/ProcessosTable';
import { useProcessos } from '@/hooks/useProcessos';
import { usePerfil } from '@/hooks/usePerfil';
import { useLeadNames } from '@/hooks/useLeadNames';
import { Processo, ProcessoStatus } from '@/types/processos';

const ProcessoModalExpanded = lazy(() => import('@/components/processos/ProcessoModalExpanded').then(m => ({ default: m.ProcessoModalExpanded })));
const ConsultaProcessoExterno = lazy(() => import('@/components/processos/ConsultaProcessoExterno').then(m => ({ default: m.ConsultaProcessoExterno })));
import { 
  Loader2, Search, Scale, Plus, FileText, AlertTriangle, 
  CheckCircle2, PauseCircle, Archive, Trophy, XCircle,
  RefreshCw, Filter, SlidersHorizontal
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ProcessosPage() {
  const navigate = useNavigate();
  const { processos, loading } = useProcessos();
  const { leadNames } = useLeadNames();
  const { canDelete, canAccessProcessos, loading: perfilLoading, cargo } = usePerfil();
  
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [syncing, setSyncing] = useState(false);

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

  // KPI counts
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
    const matchesSearch = (
      (p.numero_processo?.toLowerCase().includes(search)) ||
      (p.titulo_acao?.toLowerCase().includes(search)) ||
      (p.advogado_responsavel?.toLowerCase().includes(search)) ||
      (p.assunto?.toLowerCase().includes(search)) ||
      (p.orgao_julgador?.toLowerCase().includes(search))
    );
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [processos, searchTerm, statusFilter]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('processo-auto-sync', {
        body: { force_all: true },
      });
      if (error) throw error;
      toast.success('Sincronização iniciada', {
        description: `${data?.synced || 0} processos atualizados`,
      });
    } catch (err) {
      toast.error('Erro ao sincronizar processos');
    } finally {
      setSyncing(false);
    }
  };

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
    { label: 'Total', value: kpis.total, icon: Scale, color: 'text-foreground', bg: 'bg-card' },
    { label: 'Em Andamento', value: kpis.emAndamento, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Suspensos', value: kpis.suspensos, icon: PauseCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Arquivados', value: kpis.arquivados, icon: Archive, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Ganhos', value: kpis.ganhos, icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Perdidos', value: kpis.perdidos, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  ];

  return (
    <AppLayout>
      {/* Custom Header */}
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
              onClick={handleSyncAll}
              disabled={syncing}
              className="rounded-xl h-8 md:h-9 text-xs md:text-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </Button>
            <Button 
              onClick={handleNewProcesso}
              className="rounded-xl bg-primary hover:bg-primary/90 shadow-soft h-8 md:h-9 px-2.5 md:px-4"
              size="sm"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Novo Processo</span>
            </Button>
          </div>
        </div>
      </header>
      
      <div className="flex-1 p-4 md:p-6 space-y-5 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <button
              key={kpi.label}
              onClick={() => setStatusFilter(kpi.label === 'Total' ? 'todos' : kpi.label === 'Em Andamento' ? 'Em Andamento' : kpi.label === 'Suspensos' ? 'Suspenso' : kpi.label === 'Arquivados' ? 'Arquivado' : kpi.label === 'Ganhos' ? 'Ganho' : 'Perdido')}
              className={`flex flex-col items-center gap-1 p-3 md:p-4 rounded-xl border border-border/50 transition-all hover:shadow-md ${
                (statusFilter === 'todos' && kpi.label === 'Total') ||
                (statusFilter === 'Em Andamento' && kpi.label === 'Em Andamento') ||
                (statusFilter === 'Suspenso' && kpi.label === 'Suspensos') ||
                (statusFilter === 'Arquivado' && kpi.label === 'Arquivados') ||
                (statusFilter === 'Ganho' && kpi.label === 'Ganhos') ||
                (statusFilter === 'Perdido' && kpi.label === 'Perdidos')
                  ? 'ring-2 ring-primary/30 shadow-md bg-card' 
                  : `${kpi.bg}`
              }`}
            >
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <span className={`text-xl md:text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
              <span className="text-[10px] md:text-xs text-muted-foreground font-medium">{kpi.label}</span>
            </button>
          ))}
        </div>

        <Tabs defaultValue="internos" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="internos">Processos do Escritório</TabsTrigger>
            <TabsTrigger value="consulta">Consultar CNJ</TabsTrigger>
          </TabsList>

          <TabsContent value="internos" className="space-y-4">
            {/* Search and Filters Bar */}
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
                leads={leads}
              />
            )}
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
            leads={leads}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}
