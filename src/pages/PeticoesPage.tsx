import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MoreHorizontal, Eye, Copy, FileText, Archive, Trash2,
  Sparkles, FileCheck2, Clock, CheckCircle2, BarChart3, Wand2, Download,
  Plane, CreditCard, TrendingUp, AlertTriangle, Ban, ShoppingCart, Package,
  ArrowRight, Folder, Scale
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePeticoesV2, type ActionType, type PetitionModelV2 } from '@/hooks/usePeticoesV2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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
  draft:     { label: 'Rascunho',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <FileText className="h-3.5 w-3.5" /> },
  review:    { label: 'Em Revisão', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="h-3.5 w-3.5" /> },
  generated: { label: 'Gerado',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  filed:     { label: 'Protocolado', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  archived:  { label: 'Arquivado',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400', icon: <Archive className="h-3.5 w-3.5" /> },
};

type ViewMode = 'dashboard' | 'action-select' | 'model-select';

export default function PeticoesPage() {
  const navigate = useNavigate();
  const { actionTypes, models, petitions, loading, duplicatePetition, archivePetition, deletePetition, getModelsForAction } = usePeticoesV2();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);

  // Stats
  const stats = useMemo(() => ({
    total: petitions.length,
    draft: petitions.filter(p => p.status === 'draft').length,
    review: petitions.filter(p => p.status === 'review').length,
    generated: petitions.filter(p => p.status === 'generated').length,
    filed: petitions.filter(p => p.status === 'filed').length,
  }), [petitions]);

  // Models count per action type
  const modelsPerAction = useMemo(() => {
    const map: Record<string, number> = {};
    models.forEach(m => {
      map[m.action_type_id] = (map[m.action_type_id] || 0) + 1;
    });
    return map;
  }, [models]);

  const filteredPetitions = useMemo(() => {
    return petitions.filter(p => {
      const formData = p.form_data_json as Record<string, unknown>;
      const clientName = (formData?.cliente as Record<string, string>)?.nome_completo || '';
      const actionName = p.action_types?.nome || '';
      const matchesSearch = !searchTerm ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        actionName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [petitions, searchTerm, statusFilter]);

  const handleSelectAction = (action: ActionType) => {
    const actionModels = getModelsForAction(action.id);
    if (actionModels.length === 1) {
      // Skip model selection, go straight to wizard
      navigate(`/peticoes/nova?action=${action.id}&model=${actionModels[0].id}`);
    } else {
      setSelectedAction(action);
      setViewMode('model-select');
    }
  };

  const handleSelectModel = (model: PetitionModelV2) => {
    navigate(`/peticoes/nova?action=${model.action_type_id}&model=${model.id}`);
  };

  const handleOpenPetition = (id: string, status: string) => {
    if (status === 'generated' || status === 'filed') {
      navigate(`/peticoes/${id}/revisao`);
    } else {
      navigate(`/peticoes/${id}/editar`);
    }
  };

  const getClientName = (p: typeof petitions[0]) => {
    const fd = p.form_data_json as Record<string, unknown>;
    return (fd?.cliente as Record<string, string>)?.nome_completo || '—';
  };

  // ─── VIEW: Action Type Selection ─────────────────
  if (viewMode === 'action-select') {
    return (
      <AppLayout>
        <AppHeader title="Nova Petição" />
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setViewMode('dashboard')} className="gap-2 rounded-xl">
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
                    className={cn(
                      "cursor-pointer border border-border/50 hover:border-border transition-all hover:shadow-md group rounded-xl overflow-hidden"
                    )}
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

  // ─── VIEW: Model Selection ─────────────────
  if (viewMode === 'model-select' && selectedAction) {
    const actionModels = getModelsForAction(selectedAction.id);
    const colors = COLOR_MAP[selectedAction.cor] || COLOR_MAP.slate;

    return (
      <AppLayout>
        <AppHeader title="Escolher Modelo" />
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setViewMode('action-select')} className="gap-2 rounded-xl">
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

  // ─── VIEW: Dashboard (default) ─────────────────
  return (
    <AppLayout>
      <AppHeader title="Gerador de Petições" />
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
            <div className="relative p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-2xl text-primary-foreground shadow-md">
                    <Scale className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                      Gerador de Petições
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Crie petições profissionais preservando seus modelos do escritório
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    onClick={() => setViewMode('action-select')}
                    className="gap-2 rounded-xl shadow-md h-11 px-5"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Petição
                  </Button>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
                {[
                  { label: 'Total',       value: stats.total,     dotColor: 'bg-foreground/60' },
                  { label: 'Rascunhos',   value: stats.draft,     dotColor: 'bg-amber-500' },
                  { label: 'Em Revisão',  value: stats.review,    dotColor: 'bg-yellow-500' },
                  { label: 'Gerados',     value: stats.generated, dotColor: 'bg-emerald-500' },
                  { label: 'Protocolados', value: stats.filed,    dotColor: 'bg-violet-500' },
                ].map(stat => (
                  <div key={stat.label} className="bg-muted/40 rounded-xl p-4 border border-border/30 hover:border-border/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("h-2 w-2 rounded-full", stat.dotColor)} />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou tipo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-border/50 bg-card h-10"
              />
            </div>
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
          </div>

          {/* Table */}
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
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredPetitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Scale className="h-12 w-12 text-muted-foreground/30" />
                        <p className="text-muted-foreground">Nenhuma petição encontrada</p>
                        <Button size="sm" onClick={() => setViewMode('action-select')} className="gap-2 rounded-xl">
                          <Plus className="h-4 w-4" /> Criar primeira petição
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPetitions.map(p => {
                    const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleOpenPetition(p.id, p.status)}
                      >
                        <TableCell className="text-sm">
                          {format(new Date(p.created_at), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{p.action_types?.nome || '—'}</TableCell>
                        <TableCell className="text-sm">{getClientName(p)}</TableCell>
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
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenPetition(p.id, p.status); }}>
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
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
