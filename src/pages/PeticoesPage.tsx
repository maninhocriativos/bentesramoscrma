import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MoreHorizontal, Eye, Copy, Archive, Trash2,
  FileCheck2, Clock, CheckCircle2, FileText, Scale,
  Plane, CreditCard, TrendingUp, AlertTriangle, Ban,
  ShoppingCart, Package, ArrowRight, X, ChevronRight,
  LayoutTemplate, Layers,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { usePeticoesV2, type ActionType, type PetitionModelV2 } from '@/hooks/usePeticoesV2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  Plane:         <Plane className="h-4 w-4" />,
  CreditCard:    <CreditCard className="h-4 w-4" />,
  TrendingUp:    <TrendingUp className="h-4 w-4" />,
  AlertTriangle: <AlertTriangle className="h-4 w-4" />,
  Ban:           <Ban className="h-4 w-4" />,
  ShoppingCart:  <ShoppingCart className="h-4 w-4" />,
  Package:       <Package className="h-4 w-4" />,
  FileText:      <FileText className="h-4 w-4" />,
  Scale:         <Scale className="h-4 w-4" />,
};

const COLOR_MAP: Record<string, { grad: string }> = {
  sky:     { grad: 'from-sky-500 to-indigo-500' },
  blue:    { grad: 'from-blue-500 to-indigo-500' },
  lime:    { grad: 'from-lime-500 to-emerald-500' },
  red:     { grad: 'from-red-500 to-rose-500' },
  emerald: { grad: 'from-emerald-500 to-teal-500' },
  rose:    { grad: 'from-rose-500 to-pink-500' },
  violet:  { grad: 'from-violet-500 to-purple-500' },
  teal:    { grad: 'from-teal-500 to-emerald-500' },
  amber:   { grad: 'from-amber-500 to-orange-500' },
  orange:  { grad: 'from-orange-500 to-amber-500' },
  slate:   { grad: 'from-slate-500 to-gray-500' },
  fuchsia: { grad: 'from-fuchsia-500 to-purple-500' },
  cyan:    { grad: 'from-cyan-500 to-sky-500' },
  pink:    { grad: 'from-pink-500 to-fuchsia-500' },
};

function getGrad(cor: string) {
  return (COLOR_MAP[cor] ?? COLOR_MAP.slate).grad;
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  draft:     { label: 'Rascunho',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',         icon: <FileText className="h-3 w-3" /> },
  review:    { label: 'Em Revisão',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',     icon: <Clock className="h-3 w-3" /> },
  generated: { label: 'Gerado',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FileCheck2 className="h-3 w-3" /> },
  filed:     { label: 'Protocolado', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',     icon: <CheckCircle2 className="h-3 w-3" /> },
  archived:  { label: 'Arquivado',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',             icon: <Archive className="h-3 w-3" /> },
};

// ─── Modal Nova Petição ────────────────────────────────────────────────────────

function NovaPeticaoModal({
  open, onClose, actionTypes, getModelsForAction, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onConfirm: (actionId: string, modelId: string) => void;
}) {
  const [step, setStep]                       = useState<'action' | 'model'>('action');
  const [selectedAction, setSelectedAction]   = useState<ActionType | null>(null);
  const [search, setSearch]                   = useState('');

  function reset() {
    setStep('action');
    setSelectedAction(null);
    setSearch('');
  }

  function handleClose() { reset(); onClose(); }

  function pickAction(action: ActionType) {
    const mods = getModelsForAction(action.id);
    if (mods.length === 0) return;
    if (mods.length === 1) { onConfirm(action.id, mods[0].id); handleClose(); return; }
    setSelectedAction(action);
    setSearch('');
    setStep('model');
  }

  function pickModel(model: PetitionModelV2) {
    if (!selectedAction) return;
    onConfirm(selectedAction.id, model.id);
    handleClose();
  }

  const filteredActions = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? actionTypes.filter(a => a.nome.toLowerCase().includes(q) || (a.descricao ?? '').toLowerCase().includes(q))
      : actionTypes;
  }, [actionTypes, search]);

  const actionModels = selectedAction ? getModelsForAction(selectedAction.id) : [];

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-xl h-[78vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            {step === 'model' && (
              <button
                onClick={() => { setStep('action'); setSearch(''); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                {step === 'action' ? (
                  <><Scale className="h-4 w-4 text-primary shrink-0" /> Nova Petição</>
                ) : (
                  <>
                    {selectedAction && (
                      <span className={cn('p-1 rounded-md bg-gradient-to-br text-white inline-flex shrink-0', getGrad(selectedAction.cor))}>
                        {ICON_MAP[selectedAction.icone] ?? <FileText className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <span className="truncate">{selectedAction?.nome}</span>
                  </>
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === 'action' ? 'Selecione o tipo de ação jurídica' : 'Escolha o modelo'}
              </p>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === 'action' && (
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar tipo de ação..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">

            {/* Step 1 — tipos de ação */}
            {step === 'action' && (
              filteredActions.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <Scale className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum tipo encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredActions.map(action => {
                    const count = getModelsForAction(action.id).length;
                    return (
                      <button
                        key={action.id}
                        disabled={count === 0}
                        onClick={() => pickAction(action)}
                        className="group w-full text-left rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-150 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className={cn('h-1 bg-gradient-to-r', getGrad(action.cor))} />
                        <div className="p-3.5">
                          <div className="flex items-start justify-between mb-2">
                            <span className={cn('p-2 rounded-lg bg-gradient-to-br text-white shadow-sm', getGrad(action.cor))}>
                              {ICON_MAP[action.icone] ?? <FileText className="h-4 w-4" />}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {count} {count === 1 ? 'modelo' : 'modelos'}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug">
                            {action.nome}
                          </p>
                          {action.descricao && (
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {action.descricao}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* Step 2 — modelos */}
            {step === 'model' && (
              <div className="space-y-2">
                {actionModels.length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum modelo disponível</p>
                  </div>
                ) : actionModels.map(model => (
                  <button
                    key={model.id}
                    onClick={() => pickModel(model)}
                    className="group w-full text-left flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-150"
                  >
                    <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {model.nome}
                        </span>
                        {model.is_default && (
                          <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 h-4">Padrão</Badge>
                        )}
                      </div>
                      {model.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{model.descricao}</p>
                      )}
                      {model.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {model.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[9px] font-normal px-1.5 h-4">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-card shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {step === 'action'
              ? `${filteredActions.length} tipo${filteredActions.length !== 1 ? 's' : ''} disponível${filteredActions.length !== 1 ? 'is' : ''}`
              : `${actionModels.length} modelo${actionModels.length !== 1 ? 's' : ''}`}
          </p>
          <button onClick={handleClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel Lateral de Modelos ─────────────────────────────────────────────────

function ModelsSidePanel({
  actionTypes, getModelsForAction, onSelectModel,
}: {
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onSelectModel: (actionId: string, modelId: string) => void;
}) {
  const [sideSearch, setSideSearch] = useState('');
  const [expanded, setExpanded]     = useState<string | null>(null);

  const totalModels = useMemo(
    () => actionTypes.reduce((acc, a) => acc + getModelsForAction(a.id).length, 0),
    [actionTypes, getModelsForAction]
  );

  const visibleActions = useMemo(() => {
    const q = sideSearch.toLowerCase();
    if (!q) return actionTypes;
    return actionTypes.filter(a =>
      a.nome.toLowerCase().includes(q) ||
      getModelsForAction(a.id).some(m => m.nome.toLowerCase().includes(q))
    );
  }, [actionTypes, sideSearch, getModelsForAction]);

  return (
    <div className="flex flex-col h-full border border-border/60 rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            Modelos
          </p>
          <Badge variant="secondary" className="text-[10px]">{totalModels}</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={sideSearch}
            onChange={e => setSideSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        <div className="p-2.5 space-y-0.5">
          {visibleActions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Layers className="h-7 w-7 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Nenhum resultado</p>
            </div>
          ) : visibleActions.map(action => {
            const mods    = getModelsForAction(action.id);
            const isOpen  = expanded === action.id;

            return (
              <div key={action.id}>
                {/* Linha da ação */}
                <button
                  onClick={() => setExpanded(isOpen ? null : action.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className={cn('p-1 rounded-md bg-gradient-to-br text-white shrink-0', getGrad(action.cor))}>
                    {ICON_MAP[action.icone] ?? <FileText className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 text-xs font-medium text-foreground text-left truncate">
                    {action.nome}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{mods.length}</span>
                  <ChevronRight className={cn('h-3 w-3 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-90')} />
                </button>

                {/* Modelos */}
                {isOpen && (
                  <div className="ml-8 mt-0.5 mb-1 space-y-0.5">
                    {mods.map(model => (
                      <button
                        key={model.id}
                        onClick={() => onSelectModel(action.id, model.id)}
                        className="group w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        <FileText className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="text-[11px] flex-1 truncate group-hover:text-primary transition-colors">
                          {model.nome}
                        </span>
                        {model.is_default && (
                          <Badge className="bg-primary/10 text-primary text-[9px] px-1 h-3.5 shrink-0">P</Badge>
                        )}
                        <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────

export default function PeticoesPage() {
  const navigate = useNavigate();
  const {
    actionTypes, models, petitions, loading,
    duplicatePetition, archivePetition, deletePetition, getModelsForAction,
  } = usePeticoesV2();

  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen]       = useState(false);

  const stats = useMemo(() => ({
    total:     petitions.length,
    draft:     petitions.filter(p => p.status === 'draft').length,
    review:    petitions.filter(p => p.status === 'review').length,
    generated: petitions.filter(p => p.status === 'generated').length,
    filed:     petitions.filter(p => p.status === 'filed').length,
  }), [petitions]);

  const filtered = useMemo(() => {
    return petitions.filter(p => {
      const fd     = p.form_data_json as Record<string, unknown>;
      const nome   = (fd?.cliente as Record<string, string>)?.nome_completo ?? '';
      const acao   = p.action_types?.nome ?? '';
      const okSearch = !searchTerm ||
        nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acao.toLowerCase().includes(searchTerm.toLowerCase());
      const okStatus = statusFilter === 'all' || p.status === statusFilter;
      return okSearch && okStatus;
    });
  }, [petitions, searchTerm, statusFilter]);

  function getClientName(p: typeof petitions[0]) {
    const fd = p.form_data_json as Record<string, unknown>;
    return (fd?.cliente as Record<string, string>)?.nome_completo ?? '—';
  }

  function handleOpen(id: string, status: string) {
    if (status === 'generated' || status === 'filed') {
      navigate(`/peticoes/${id}/revisao`);
    } else {
      navigate(`/peticoes/${id}/editar`);
    }
  }

  return (
    <AppLayout>
      <AppHeader title="Gerador de Petições" />

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">

          {/* Topo */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
                  Gerador de Petições
                </h1>
                <p className="text-xs text-muted-foreground">
                  {models.length} modelos · {petitions.length} petições geradas
                </p>
              </div>
            </div>
            <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-9 shadow-sm shrink-0">
              <Plus className="h-4 w-4" />
              Nova Petição
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total',        value: stats.total,     dot: 'bg-foreground/30' },
              { label: 'Rascunhos',    value: stats.draft,     dot: 'bg-amber-500' },
              { label: 'Em Revisão',   value: stats.review,    dot: 'bg-yellow-500' },
              { label: 'Gerados',      value: stats.generated, dot: 'bg-emerald-500' },
              { label: 'Protocolados', value: stats.filed,     dot: 'bg-violet-500' },
            ].map(s => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Layout 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* Tabela (2/3) */}
            <div className="lg:col-span-2 space-y-3">

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente ou ação..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm rounded-xl border-border/50"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { v: 'all',       l: 'Todos' },
                    { v: 'draft',     l: 'Rascunho' },
                    { v: 'review',    l: 'Revisão' },
                    { v: 'generated', l: 'Gerado' },
                    { v: 'filed',     l: 'Protocolado' },
                  ].map(f => (
                    <Button
                      key={f.v}
                      variant={statusFilter === f.v ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(f.v)}
                      className={cn('rounded-lg text-xs h-8 px-3', statusFilter !== f.v && 'border-border/50 hover:bg-muted/50')}
                    >
                      {f.l}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tabela */}
              <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                      {['Data', 'Tipo de Ação', 'Cliente', 'Status', 'Atualizado', ''].map((h, i) => (
                        <TableHead
                          key={i}
                          className={cn('text-[11px] uppercase tracking-wider text-muted-foreground font-semibold', i === 5 && 'text-right')}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3">
                            <Scale className="h-12 w-12 text-muted-foreground/20" />
                            <p className="text-sm text-muted-foreground">
                              {petitions.length === 0 ? 'Nenhuma petição ainda' : 'Nenhuma petição encontrada'}
                            </p>
                            {petitions.length === 0 && (
                              <Button size="sm" onClick={() => setModalOpen(true)} className="gap-2 rounded-xl">
                                <Plus className="h-4 w-4" /> Criar primeira petição
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(p => {
                        const sc = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                        return (
                          <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => handleOpen(p.id, p.status)}
                          >
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(p.created_at), 'dd/MM/yy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{p.action_types?.nome ?? '—'}</TableCell>
                            <TableCell className="text-sm">{getClientName(p)}</TableCell>
                            <TableCell>
                              <Badge className={cn('gap-1 text-[11px] font-medium', sc.cls)}>
                                {sc.icon}{sc.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(p.updated_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem onClick={e => { e.stopPropagation(); handleOpen(p.id, p.status); }}>
                                    <Eye className="h-4 w-4 mr-2" /> Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={e => { e.stopPropagation(); duplicatePetition(p.id); }}>
                                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={e => { e.stopPropagation(); archivePetition(p.id); }}>
                                    <Archive className="h-4 w-4 mr-2" /> Arquivar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={e => { e.stopPropagation(); deletePetition(p.id); }}
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

            {/* Painel lateral (1/3) — só desktop */}
            <div className="hidden lg:block lg:sticky lg:top-4" style={{ height: 'calc(100vh - 200px)' }}>
              <ModelsSidePanel
                actionTypes={actionTypes}
                getModelsForAction={getModelsForAction}
                onSelectModel={(actionId, modelId) => navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`)}
              />
            </div>

          </div>
        </div>
      </ScrollArea>

      {/* Modal */}
      <NovaPeticaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        actionTypes={actionTypes}
        getModelsForAction={getModelsForAction}
        onConfirm={(actionId, modelId) => navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`)}
      />
    </AppLayout>
  );
}
