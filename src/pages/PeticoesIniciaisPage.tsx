import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useModelosPeticaoDocx } from '@/hooks/useModelosPeticaoDocx';
import { usePeticoesV2, type ActionType, type PetitionModelV2 } from '@/hooks/usePeticoesV2';
import ModelosPeticaoTab from '@/components/peticoes-docx/ModelosPeticaoTab';
import PeticoesGeradasTab from '@/components/peticoes-docx/PeticoesGeradasTab';
import GerarPeticaoModal from '@/components/peticoes-docx/GerarPeticaoModal';
import DocxPreviewModal from '@/components/peticoes-docx/DocxPreviewModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search, Scale, FileText, FolderOpen, Sparkles, TrendingUp,
  Plus, Eye, Copy, Archive, Trash2, MoreHorizontal, Clock,
  FileCheck2, CheckCircle2, ArrowRight, Plane, CreditCard,
  AlertTriangle, Ban, ShoppingCart, Package,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

/* ─── Icon & Color Maps (V2 system) ──────────────── */

const ICON_MAP: Record<string, React.ReactNode> = {
  Plane: <Plane className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
  Ban: <Ban className="h-5 w-5" />,
  ShoppingCart: <ShoppingCart className="h-5 w-5" />,
  Package: <Package className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Scale: <Scale className="h-5 w-5" />,
};

const COLOR_MAP: Record<string, { gradient: string; bg: string; text: string }> = {
  sky:     { gradient: 'from-sky-600 to-indigo-600',     bg: 'bg-sky-50 dark:bg-sky-950/30',     text: 'text-sky-700 dark:text-sky-400' },
  blue:    { gradient: 'from-blue-600 to-indigo-600',    bg: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-700 dark:text-blue-400' },
  lime:    { gradient: 'from-lime-600 to-emerald-600',   bg: 'bg-lime-50 dark:bg-lime-950/30',   text: 'text-lime-700 dark:text-lime-400' },
  red:     { gradient: 'from-red-600 to-rose-600',       bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-700 dark:text-red-400' },
  emerald: { gradient: 'from-emerald-600 to-teal-600',   bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400' },
  rose:    { gradient: 'from-rose-600 to-pink-600',      bg: 'bg-rose-50 dark:bg-rose-950/30',   text: 'text-rose-700 dark:text-rose-400' },
  violet:  { gradient: 'from-violet-600 to-purple-600',  bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400' },
  teal:    { gradient: 'from-teal-600 to-emerald-600',   bg: 'bg-teal-50 dark:bg-teal-950/30',   text: 'text-teal-700 dark:text-teal-400' },
  fuchsia: { gradient: 'from-fuchsia-600 to-purple-600', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', text: 'text-fuchsia-700 dark:text-fuchsia-400' },
  slate:   { gradient: 'from-slate-600 to-gray-600',     bg: 'bg-slate-50 dark:bg-slate-950/30', text: 'text-slate-700 dark:text-slate-400' },
  amber:   { gradient: 'from-amber-500 to-orange-500',   bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400' },
  orange:  { gradient: 'from-orange-600 to-amber-600',   bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400' },
  cyan:    { gradient: 'from-cyan-600 to-sky-600',       bg: 'bg-cyan-50 dark:bg-cyan-950/30',   text: 'text-cyan-700 dark:text-cyan-400' },
  pink:    { gradient: 'from-pink-600 to-fuchsia-600',   bg: 'bg-pink-50 dark:bg-pink-950/30',   text: 'text-pink-700 dark:text-pink-400' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: 'Rascunho',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <FileText className="h-3.5 w-3.5" /> },
  review:    { label: 'Em Revisão',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="h-3.5 w-3.5" /> },
  generated: { label: 'Gerado',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  filed:     { label: 'Protocolado', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  archived:  { label: 'Arquivado',   color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400', icon: <Archive className="h-3.5 w-3.5" /> },
};

type SubView = 'main' | 'action-select' | 'model-select';

export default function PeticoesIniciaisPage() {
  const navigate = useNavigate();

  /* ─── Docx system (modelos_peticao + peticoes_geradas) ─── */
  const {
    modelos, peticoesGeradas, loading: loadingDocx,
    uploadModelo, deleteModelo, gerarPeticao, downloadPeticao,
  } = useModelosPeticaoDocx();

  /* ─── V2 system (action_types + petition_models_v2 + petitions_v2) ─── */
  const {
    actionTypes, models: modelsV2, petitions: petitionsV2, loading: loadingV2,
    duplicatePetition, archivePetition, deletePetition, getModelsForAction,
  } = usePeticoesV2();

  /* ─── UI state ─── */
  const [search, setSearch] = useState('');
  const [mainTab, setMainTab] = useState('docx-geradas');
  const [gerarModalOpen, setGerarModalOpen] = useState(false);
  const [defaultModeloId, setDefaultModeloId] = useState<string | undefined>();
  const [docxPreviewOpen, setDocxPreviewOpen] = useState(false);
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | Blob | null>(null);
  const [docxPreviewTitle, setDocxPreviewTitle] = useState('');
  const [subView, setSubView] = useState<SubView>('main');
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loading = loadingDocx || loadingV2;

  /* ─── Computed ─── */
  const totalPeticoes = peticoesGeradas.length + petitionsV2.length;
  const totalModelos = modelos.length + modelsV2.length;

  const modelsPerAction = useMemo(() => {
    const map: Record<string, number> = {};
    modelsV2.forEach(m => { map[m.action_type_id] = (map[m.action_type_id] || 0) + 1; });
    return map;
  }, [modelsV2]);

  const filteredDocxPeticoes = useMemo(() => {
    if (!search) return peticoesGeradas;
    const q = search.toLowerCase();
    return peticoesGeradas.filter(p =>
      (p.nome_completo || p.cliente_nome || '').toLowerCase().includes(q) ||
      (p.reu_nome || p.parte_contraria || '').toLowerCase().includes(q) ||
      (p.modelos_peticao?.nome || '').toLowerCase().includes(q)
    );
  }, [peticoesGeradas, search]);

  const filteredV2Petitions = useMemo(() => {
    return petitionsV2.filter(p => {
      const formData = p.form_data_json as Record<string, unknown>;
      const clientName = (formData?.cliente as Record<string, string>)?.nome_completo || '';
      const actionName = p.action_types?.nome || '';
      const matchesSearch = !search ||
        clientName.toLowerCase().includes(search.toLowerCase()) ||
        actionName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [petitionsV2, search, statusFilter]);

  const v2Stats = useMemo(() => ({
    total: petitionsV2.length,
    draft: petitionsV2.filter(p => p.status === 'draft').length,
    review: petitionsV2.filter(p => p.status === 'review').length,
    generated: petitionsV2.filter(p => p.status === 'generated').length,
    filed: petitionsV2.filter(p => p.status === 'filed').length,
  }), [petitionsV2]);

  /* ─── Handlers ─── */
  const handleDocxPreview = (buffer: ArrayBuffer) => {
    setDocxBuffer(buffer);
    setDocxPreviewTitle('Petição Gerada');
    setDocxPreviewOpen(true);
  };

  const handlePreviewFromHistory = async (arquivoUrl: string, nomeCliente: string) => {
    const blob = await downloadPeticao(arquivoUrl, nomeCliente);
    if (blob) {
      setDocxBuffer(blob);
      setDocxPreviewTitle(`Petição - ${nomeCliente}`);
      setDocxPreviewOpen(true);
    }
  };

  const handleOpenDocxModal = (modeloId?: string) => {
    setDefaultModeloId(modeloId);
    setGerarModalOpen(true);
  };

  const handleSelectAction = (action: ActionType) => {
    const actionModels = getModelsForAction(action.id);
    if (actionModels.length === 1) {
      navigate(`/peticoes/nova?action=${action.id}&model=${actionModels[0].id}`);
    } else {
      setSelectedAction(action);
      setSubView('model-select');
    }
  };

  const handleSelectModel = (model: PetitionModelV2) => {
    navigate(`/peticoes/nova?action=${model.action_type_id}&model=${model.id}`);
  };

  const handleOpenV2Petition = (id: string, status: string) => {
    if (status === 'generated' || status === 'filed') {
      navigate(`/peticoes/${id}/revisao`);
    } else {
      navigate(`/peticoes/${id}/editar`);
    }
  };

  const getV2ClientName = (p: typeof petitionsV2[0]) => {
    const fd = p.form_data_json as Record<string, unknown>;
    return (fd?.cliente as Record<string, string>)?.nome_completo || '—';
  };

  /* ─── SUB-VIEW: Action Type Selection ────── */
  if (subView === 'action-select') {
    return (
      <AppLayout>
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSubView('main')} className="gap-2 rounded-xl">
                <ArrowRight className="h-4 w-4 rotate-180" /> Voltar
              </Button>
              <div>
                <h2 className="text-lg font-bold text-foreground">Escolha o Tipo de Ação</h2>
                <p className="text-sm text-muted-foreground">Selecione a categoria jurídica da petição</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {actionTypes.map(action => {
                const colors = COLOR_MAP[action.cor] || COLOR_MAP.slate;
                const count = modelsPerAction[action.id] || 0;
                return (
                  <Card
                    key={action.id}
                    className="cursor-pointer border border-border/50 hover:border-border transition-all hover:shadow-md group rounded-xl overflow-hidden"
                    onClick={() => handleSelectAction(action)}
                  >
                    <CardContent className="p-0">
                      <div className={cn("h-1.5 bg-gradient-to-r", colors.gradient)} />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", colors.gradient, "text-white shadow-sm")}>
                            {ICON_MAP[action.icone] || <FileText className="h-5 w-5" />}
                          </div>
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {count} {count === 1 ? 'modelo' : 'modelos'}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-1">
                          {action.nome}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {action.descricao}
                        </p>
                        <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Selecionar <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </AppLayout>
    );
  }

  /* ─── SUB-VIEW: Model Selection ────── */
  if (subView === 'model-select' && selectedAction) {
    const actionModels = getModelsForAction(selectedAction.id);
    const colors = COLOR_MAP[selectedAction.cor] || COLOR_MAP.slate;

    return (
      <AppLayout>
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSubView('action-select')} className="gap-2 rounded-xl">
                <ArrowRight className="h-4 w-4 rotate-180" /> Voltar
              </Button>
              <div className={cn("p-2 rounded-lg bg-gradient-to-br text-white", colors.gradient)}>
                {ICON_MAP[selectedAction.icone] || <FileText className="h-4 w-4" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{selectedAction.nome}</h2>
                <p className="text-sm text-muted-foreground">Escolha o modelo para esta ação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actionModels.map(model => (
                <Card
                  key={model.id}
                  className="cursor-pointer border border-border/50 hover:border-primary/30 transition-all hover:shadow-md group rounded-xl"
                  onClick={() => handleSelectModel(model)}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {model.nome}
                      </h3>
                      {model.is_default && (
                        <Badge className="bg-primary/10 text-primary text-[10px]">Padrão</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{model.descricao}</p>
                    <div className="flex flex-wrap gap-1">
                      {model.tags?.map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-normal">{tag}</Badge>
                      ))}
                    </div>
                    <div className="pt-2 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Usar este modelo <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ScrollArea>
      </AppLayout>
    );
  }

  /* ─── MAIN VIEW ────── */
  return (
    <AppLayout>
      <div className="space-y-5 p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-2xl text-primary-foreground shadow-md">
                  <Scale className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                    Gerador de Petições
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {totalModelos} modelos • {totalPeticoes} petições geradas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 w-48 h-9 text-xs rounded-xl border-border/50 bg-background/50"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2 rounded-xl shadow-md h-9 px-4">
                      <Plus className="h-4 w-4" />
                      Nova Petição
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl">
                    <DropdownMenuItem onClick={() => handleOpenDocxModal()} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Petição Docx (Modelos do Escritório)
                    </DropdownMenuItem>
                    {actionTypes.length > 0 && (
                      <DropdownMenuItem onClick={() => setSubView('action-select')} className="gap-2">
                        <Scale className="h-4 w-4" />
                        Petição por Tipo de Ação
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Total Petições', value: totalPeticoes, dotColor: 'bg-foreground/60' },
                { label: 'Modelos Docx', value: modelos.length, dotColor: 'bg-primary' },
                { label: 'Tipos de Ação', value: actionTypes.length, dotColor: 'bg-violet-500' },
                { label: 'Modelos V2', value: modelsV2.length, dotColor: 'bg-emerald-500' },
              ].map(stat => (
                <div key={stat.label} className="bg-muted/40 rounded-xl p-3 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("h-2 w-2 rounded-full", stat.dotColor)} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="h-9 bg-muted/50 p-0.5 flex-wrap">
            <TabsTrigger value="docx-geradas" className="text-xs gap-1.5 h-8 px-4">
              <FileText className="h-3.5 w-3.5" />
              Petições Docx
              {peticoesGeradas.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-0.5 font-semibold">
                  {peticoesGeradas.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="v2-peticoes" className="text-xs gap-1.5 h-8 px-4">
              <Scale className="h-3.5 w-3.5" />
              Petições V2
              {petitionsV2.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-0.5 font-semibold">
                  {petitionsV2.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="modelos-docx" className="text-xs gap-1.5 h-8 px-4">
              <FolderOpen className="h-3.5 w-3.5" />
              Modelos Docx
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-0.5 font-semibold">
                {modelos.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="acoes" className="text-xs gap-1.5 h-8 px-4">
              <TrendingUp className="h-3.5 w-3.5" />
              Tipos de Ação
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-0.5 font-semibold">
                {actionTypes.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Docx Petições Geradas */}
          <TabsContent value="docx-geradas" className="mt-4">
            <PeticoesGeradasTab
              peticoes={filteredDocxPeticoes}
              onDownload={downloadPeticao}
              onPreview={handlePreviewFromHistory}
              onNewPeticao={() => handleOpenDocxModal()}
            />
          </TabsContent>

          {/* Tab: V2 Petitions */}
          <TabsContent value="v2-peticoes" className="mt-4 space-y-4">
            {/* V2 Status Filters */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'draft', label: 'Rascunhos' },
                { value: 'review', label: 'Em Revisão' },
                { value: 'generated', label: 'Gerados' },
                { value: 'filed', label: 'Protocolados' },
              ].map(f => (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "rounded-lg text-xs h-8 px-3",
                    statusFilter !== f.value && "border-border/50 hover:bg-muted/50"
                  )}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* V2 KPI Mini Strip */}
            {petitionsV2.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Total',       value: v2Stats.total,     dotColor: 'bg-foreground/60' },
                  { label: 'Rascunhos',   value: v2Stats.draft,     dotColor: 'bg-amber-500' },
                  { label: 'Em Revisão',  value: v2Stats.review,    dotColor: 'bg-yellow-500' },
                  { label: 'Gerados',     value: v2Stats.generated, dotColor: 'bg-emerald-500' },
                  { label: 'Protocolados', value: v2Stats.filed,    dotColor: 'bg-violet-500' },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/30 rounded-lg p-2.5 border border-border/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", stat.dotColor)} />
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                    </div>
                    <div className="text-lg font-bold text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* V2 Table */}
            <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Data</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tipo</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cliente</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Atualização</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-semibold text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingV2 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredV2Petitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <Scale className="h-12 w-12 text-muted-foreground/30" />
                          <p className="text-muted-foreground">Nenhuma petição V2 encontrada</p>
                          <Button size="sm" onClick={() => setSubView('action-select')} className="gap-2 rounded-xl">
                            <Plus className="h-4 w-4" /> Criar petição
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredV2Petitions.map(p => {
                      const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => handleOpenV2Petition(p.id, p.status)}
                        >
                          <TableCell className="text-sm">
                            {format(new Date(p.created_at), "dd/MM/yy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{p.action_types?.nome || '—'}</TableCell>
                          <TableCell className="text-sm">{getV2ClientName(p)}</TableCell>
                          <TableCell>
                            <Badge className={cn("gap-1 text-[11px] font-medium", statusCfg.color)}>
                              {statusCfg.icon} {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(p.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenV2Petition(p.id, p.status); }}>
                                  <Eye className="h-4 w-4 mr-2" /> Abrir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicatePetition(p.id); }}>
                                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); archivePetition(p.id); }}>
                                  <Archive className="h-4 w-4 mr-2" /> Arquivar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => { e.stopPropagation(); deletePetition(p.id); }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Tab: Modelos Docx */}
          <TabsContent value="modelos-docx" className="mt-4">
            <ModelosPeticaoTab
              modelos={modelos}
              onUpload={uploadModelo}
              onDelete={deleteModelo}
              onSelectModel={(id) => handleOpenDocxModal(id)}
            />
          </TabsContent>

          {/* Tab: Tipos de Ação (V2 action types grid) */}
          <TabsContent value="acoes" className="mt-4">
            {actionTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Scale className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <p className="text-sm text-muted-foreground">Nenhum tipo de ação cadastrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Configure tipos de ação na tabela <code>action_types</code> do Supabase.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {actionTypes.map(action => {
                  const colors = COLOR_MAP[action.cor] || COLOR_MAP.slate;
                  const count = modelsPerAction[action.id] || 0;
                  return (
                    <Card
                      key={action.id}
                      className="cursor-pointer border border-border/50 hover:border-border transition-all hover:shadow-md group rounded-xl overflow-hidden"
                      onClick={() => handleSelectAction(action)}
                    >
                      <CardContent className="p-0">
                        <div className={cn("h-1.5 bg-gradient-to-r", colors.gradient)} />
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", colors.gradient, "text-white shadow-sm")}>
                              {ICON_MAP[action.icone] || <FileText className="h-5 w-5" />}
                            </div>
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {count} {count === 1 ? 'modelo' : 'modelos'}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-1">
                            {action.nome}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{action.descricao}</p>
                          <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Criar petição <ArrowRight className="h-3 w-3" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <GerarPeticaoModal
        open={gerarModalOpen}
        onOpenChange={setGerarModalOpen}
        modelos={modelos}
        onGenerate={gerarPeticao}
        onPreview={handleDocxPreview}
        defaultModeloId={defaultModeloId}
      />
      <DocxPreviewModal
        open={docxPreviewOpen}
        onOpenChange={setDocxPreviewOpen}
        docxBuffer={docxBuffer}
        title={docxPreviewTitle}
      />
    </AppLayout>
  );
}
