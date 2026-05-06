import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MoreHorizontal, Eye, Copy, Archive, Trash2,
  FileCheck2, Clock, CheckCircle2, FileText, Scale,
  Plane, CreditCard, TrendingUp, AlertTriangle, Ban,
  ShoppingCart, Package, ArrowRight, X, ChevronRight,
  ChevronDown, Sparkles, Gavel, FolderOpen,
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePeticoesV2, type ActionType, type PetitionModelV2 } from '@/hooks/usePeticoesV2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Ícones ────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Plane, CreditCard, TrendingUp, AlertTriangle, Ban,
  ShoppingCart, Package, FileText, Scale, Gavel,
};

function ActionIcon({ icone, className }: { icone: string; className?: string }) {
  const Icon = ICON_MAP[icone] ?? FileText;
  return <Icon className={className ?? 'h-4 w-4'} />;
}

// ─── Cores ─────────────────────────────────────────────────────────────────────

const COLORS: Record<string, { grad: string; soft: string }> = {
  sky:     { grad: 'from-sky-500 to-blue-600',      soft: 'bg-sky-50 dark:bg-sky-950/40' },
  blue:    { grad: 'from-blue-500 to-indigo-600',   soft: 'bg-blue-50 dark:bg-blue-950/40' },
  lime:    { grad: 'from-lime-500 to-emerald-600',  soft: 'bg-lime-50 dark:bg-lime-950/40' },
  red:     { grad: 'from-red-500 to-rose-600',      soft: 'bg-red-50 dark:bg-red-950/40' },
  emerald: { grad: 'from-emerald-500 to-teal-600',  soft: 'bg-emerald-50 dark:bg-emerald-950/40' },
  rose:    { grad: 'from-rose-500 to-pink-600',     soft: 'bg-rose-50 dark:bg-rose-950/40' },
  violet:  { grad: 'from-violet-500 to-purple-600', soft: 'bg-violet-50 dark:bg-violet-950/40' },
  teal:    { grad: 'from-teal-500 to-cyan-600',     soft: 'bg-teal-50 dark:bg-teal-950/40' },
  amber:   { grad: 'from-amber-500 to-orange-500',  soft: 'bg-amber-50 dark:bg-amber-950/40' },
  orange:  { grad: 'from-orange-500 to-red-500',    soft: 'bg-orange-50 dark:bg-orange-950/40' },
  fuchsia: { grad: 'from-fuchsia-500 to-violet-600',soft: 'bg-fuchsia-50 dark:bg-fuchsia-950/40' },
  cyan:    { grad: 'from-cyan-500 to-blue-500',     soft: 'bg-cyan-50 dark:bg-cyan-950/40' },
  pink:    { grad: 'from-pink-500 to-rose-500',     soft: 'bg-pink-50 dark:bg-pink-950/40' },
  slate:   { grad: 'from-slate-500 to-gray-600',    soft: 'bg-slate-50 dark:bg-slate-950/40' },
};

function getC(cor: string) { return COLORS[cor] ?? COLORS.slate; }

// ─── Status ────────────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; cls: string; dot: string; icon: React.ReactNode }> = {
  draft:     { label: 'Rascunho',    dot: 'bg-amber-400',   cls: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',     icon: <FileText className="h-3 w-3" /> },
  review:    { label: 'Em Revisão',  dot: 'bg-yellow-400',  cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800', icon: <Clock className="h-3 w-3" /> },
  generated: { label: 'Gerado',      dot: 'bg-emerald-400', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800', icon: <FileCheck2 className="h-3 w-3" /> },
  filed:     { label: 'Protocolado', dot: 'bg-violet-400',  cls: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800', icon: <CheckCircle2 className="h-3 w-3" /> },
  archived:  { label: 'Arquivado',   dot: 'bg-gray-400',    cls: 'bg-gray-50 text-gray-600 border border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-700',             icon: <Archive className="h-3 w-3" /> },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL NOVA PETIÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

function NovaPeticaoModal({
  open, onClose, actionTypes, getModelsForAction, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onConfirm: (actionId: string, modelId: string) => void;
}) {
  const [step, setStep]                     = useState<1 | 2>(1);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [search, setSearch]                 = useState('');

  function reset() { setStep(1); setSelectedAction(null); setSearch(''); }
  function handleClose() { reset(); onClose(); }

  function pickAction(action: ActionType) {
    const mods = getModelsForAction(action.id);
    if (!mods.length) return;
    if (mods.length === 1) { onConfirm(action.id, mods[0].id); handleClose(); return; }
    setSelectedAction(action); setSearch(''); setStep(2);
  }

  function pickModel(model: PetitionModelV2) {
    if (!selectedAction) return;
    onConfirm(selectedAction.id, model.id);
    handleClose();
  }

  const filteredActions = useMemo(() => {
    const q = search.toLowerCase();
    return q ? actionTypes.filter(a =>
      a.nome.toLowerCase().includes(q) || (a.descricao ?? '').toLowerCase().includes(q)
    ) : actionTypes;
  }, [actionTypes, search]);

  const actionModels = selectedAction ? getModelsForAction(selectedAction.id) : [];
  const selC = selectedAction ? getC(selectedAction.cor) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border border-border/60 shadow-2xl"
        style={{ height: '82vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-5 border-b border-border/50">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">
                Nova Petição
              </p>
              <h2 className="text-xl font-bold text-foreground leading-tight">
                {step === 1 ? 'Tipo de Ação' : selectedAction?.nome}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {step === 1 ? 'Selecione a categoria jurídica' : 'Escolha o modelo de documento'}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-3 mb-5">
            {[{ n: 1, l: 'Tipo de Ação' }, { n: 2, l: 'Modelo' }].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  step === s.n ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : step > s.n ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
                </div>
                <span className={cn('text-xs font-semibold', step === s.n ? 'text-foreground' : 'text-muted-foreground')}>
                  {s.l}
                </span>
                {i < 1 && <div className={cn('h-px w-10 transition-colors', step > 1 ? 'bg-emerald-400' : 'bg-border')} />}
              </div>
            ))}
          </div>

          {/* Busca step 1 */}
          {step === 1 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar tipo de ação..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-muted/40 border-border/50"
              />
            </div>
          )}

          {/* Breadcrumb step 2 */}
          {step === 2 && selectedAction && selC && (
            <button
              onClick={() => { setStep(1); setSearch(''); }}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowRight className="h-3 w-3 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
              <span>Tipos de ação</span>
              <ChevronRight className="h-3 w-3 opacity-40" />
              <span className={cn('p-1 rounded-md bg-gradient-to-br text-white inline-flex', selC.grad)}>
                <ActionIcon icone={selectedAction.icone} className="h-3 w-3" />
              </span>
              <span className="font-semibold text-foreground">{selectedAction.nome}</span>
            </button>
          )}
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5">
            {step === 1 && (
              filteredActions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Scale className="h-12 w-12 mx-auto mb-3 opacity-10" />
                  <p className="text-sm font-medium">Nenhum tipo encontrado</p>
                  <button onClick={() => setSearch('')} className="text-xs text-primary mt-1 hover:underline">Limpar busca</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredActions.map(action => {
                    const c = getC(action.cor);
                    const count = getModelsForAction(action.id).length;
                    return (
                      <button
                        key={action.id}
                        disabled={count === 0}
                        onClick={() => pickAction(action)}
                        className="group w-full text-left rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className={cn('h-1.5 bg-gradient-to-r', c.grad)} />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className={cn('p-2.5 rounded-xl bg-gradient-to-br text-white shadow-md', c.grad)}>
                              <ActionIcon icone={action.icone} className="h-5 w-5" />
                            </div>
                            <Badge variant="secondary" className="text-[10px] font-semibold tabular-nums">
                              {count} {count === 1 ? 'modelo' : 'modelos'}
                            </Badge>
                          </div>
                          <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{action.nome}</p>
                          {action.descricao && (
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{action.descricao}</p>
                          )}
                          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Selecionar <ArrowRight className="h-3 w-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {step === 2 && (
              <div className="space-y-2.5">
                {actionModels.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-10" />
                    <p className="text-sm font-medium">Nenhum modelo disponível</p>
                  </div>
                ) : actionModels.map((model, i) => (
                  <button
                    key={model.id}
                    onClick={() => pickModel(model)}
                    className="group w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
                  >
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-sm font-black text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{model.nome}</span>
                        {model.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                            <Sparkles className="h-2.5 w-2.5" /> Padrão
                          </span>
                        )}
                      </div>
                      {model.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{model.descricao}</p>}
                      {model.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {model.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="h-8 w-8 rounded-xl border border-border/60 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-all shrink-0 mt-0.5">
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3.5 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {step === 1
              ? `${filteredActions.length} tipo${filteredActions.length !== 1 ? 's' : ''} disponível${filteredActions.length !== 1 ? 'is' : ''}`
              : `${actionModels.length} modelo${actionModels.length !== 1 ? 's' : ''}`}
          </p>
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs h-8 rounded-lg">Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAINEL LATERAL
// ═══════════════════════════════════════════════════════════════════════════════

function ModelsSidePanel({
  actionTypes, getModelsForAction, onSelectModel,
}: {
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onSelectModel: (actionId: string, modelId: string) => void;
}) {
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalModels = useMemo(
    () => actionTypes.reduce((acc, a) => acc + getModelsForAction(a.id).length, 0),
    [actionTypes, getModelsForAction]
  );

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return actionTypes;
    return actionTypes.filter(a =>
      a.nome.toLowerCase().includes(q) ||
      getModelsForAction(a.id).some(m => m.nome.toLowerCase().includes(q))
    );
  }, [actionTypes, search, getModelsForAction]);
  useEffect(() => {
    if (visible.length === 0) return;
    if (!expanded || !visible.some(action => action.id === expanded)) {
      setExpanded(visible[0].id);
    }
  }, [expanded, visible]);

  return (
    <div className="flex flex-col h-full rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Biblioteca de modelos</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalModels} modelos · {actionTypes.length} categorias
            </p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Gavel className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo ou ação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-muted/40 border-border/40 focus:bg-background"
          />
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        <div className="p-2.5 space-y-2">
          {visible.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-10" />
              <p className="text-xs">Nenhum resultado</p>
            </div>
          ) : visible.map(action => {
            const mods   = getModelsForAction(action.id);
            const c      = getC(action.cor);
            const isOpen = expanded === action.id;

            return (
              <div key={action.id} className="rounded-lg overflow-hidden border border-border/40 bg-background">
                {/* Cabeçalho accordion */}
                <button
                  onClick={() => setExpanded(isOpen ? null : action.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left',
                    isOpen ? 'bg-muted/50' : 'hover:bg-muted/30'
                  )}
                >
                  <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white shrink-0 shadow-sm', c.grad)}>
                    <ActionIcon icone={action.icone} className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{action.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {mods.length} {mods.length === 1 ? 'modelo' : 'modelos'}
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )} />
                </button>

                {/* Modelos expandidos */}
                {isOpen && (
                  <div className="border-t border-border/30">
                    {mods.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-4 px-3">Sem modelos cadastrados</p>
                    ) : mods.map((model, i) => (
                      <button
                        key={model.id}
                        onClick={() => onSelectModel(action.id, model.id)}
                        className={cn(
                          'group w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors',
                          i < mods.length - 1 && 'border-b border-border/25'
                        )}
                      >
                        {/* Linha de cor vertical */}
                        <div className={cn('w-0.5 self-stretch rounded-full bg-gradient-to-b shrink-0', c.grad)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {model.nome}
                            </p>
                            {model.is_default && (
                              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black shrink-0">P</span>
                            )}
                          </div>
                          {model.descricao && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{model.descricao}</p>
                          )}
                          {model.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {model.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 rounded-full bg-muted text-[9px] text-muted-foreground">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-all group-hover:translate-x-0.5" />
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

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

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

  const filtered = useMemo(() => petitions.filter(p => {
    const q = searchTerm.toLowerCase();
    const nome = getClientName(p).toLowerCase();
    const acao = p.action_types?.nome?.toLowerCase() ?? '';
    const modelo = p.petition_models_v2?.nome?.toLowerCase() ?? '';
    const okS = !q || nome.includes(q) || acao.includes(q) || modelo.includes(q);
    const okF = statusFilter === 'all' || p.status === statusFilter;
    return okS && okF;
  }), [petitions, searchTerm, statusFilter]);

  function getClientName(p: typeof petitions[0]) {
    const fd = p.form_data_json as Record<string, unknown>;
    const nested = fd?.cliente as Record<string, string> | undefined;
    return nested?.nome_completo
      || (fd.nome_completo as string)
      || (fd.nome_maiusculo as string)
      || (fd.nome as string)
      || 'Sem cliente informado';
  }
  function handleOpen(id: string, status: string) {
    navigate(status === 'generated' || status === 'filed'
      ? `/peticoes/${id}/revisao`
      : `/peticoes/${id}/editar`
    );
  }

  const STAT_ITEMS = [
    { label: 'Total',        value: stats.total,     dot: 'bg-foreground/20', filter: 'all' },
    { label: 'Rascunhos',    value: stats.draft,     dot: 'bg-amber-400',     filter: 'draft' },
    { label: 'Em Revisão',   value: stats.review,    dot: 'bg-yellow-400',    filter: 'review' },
    { label: 'Gerados',      value: stats.generated, dot: 'bg-emerald-400',   filter: 'generated' },
    { label: 'Protocolados', value: stats.filed,     dot: 'bg-violet-400',    filter: 'filed' },
  ];

  const FILTER_TABS = [
    { v: 'all',       l: 'Todos' },
    { v: 'draft',     l: 'Rascunho' },
    { v: 'review',    l: 'Revisão' },
    { v: 'generated', l: 'Gerado' },
    { v: 'filed',     l: 'Protocolado' },
  ];

  return (
    <AppLayout>
      <AppHeader title="Gerador de Petições" />

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-5 max-w-[1680px] mx-auto">

          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl border border-border/60 bg-card px-4 py-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
                <Scale className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-foreground leading-tight">
                  Gerador de Petições
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {models.length} modelos disponíveis · {petitions.length} {petitions.length === 1 ? 'petição gerada' : 'petições geradas'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setModalOpen(true)}
              size="lg"
              className="gap-2 rounded-lg shadow-sm font-bold shrink-0 h-10 px-5"
            >
              <Plus className="h-5 w-5" />
              Nova Petição
            </Button>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {STAT_ITEMS.map(s => {
              const isActive = statusFilter === s.filter;
              return (
                <button
                  key={s.label}
                  onClick={() => setStatusFilter(s.filter)}
                  className={cn(
                    'group text-left rounded-xl border px-4 py-3.5 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0',
                    isActive
                      ? 'border-primary/40 bg-primary/5 shadow-sm shadow-primary/10'
                      : 'border-border/50 bg-card hover:border-border'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', s.dot)} />
                    <span className={cn(
                      'text-[10px] uppercase tracking-widest font-black truncate transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {s.label}
                    </span>
                  </div>
                  <p className={cn(
                    'text-3xl font-black tabular-nums leading-none transition-colors',
                    isActive ? 'text-primary' : 'text-foreground'
                  )}>
                    {s.value}
                  </p>
                </button>
              );
            })}
          </div>

          {/* ── 2 colunas ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">

            {/* Tabela (2/3) */}
            <div className="space-y-3">

              {/* Filtros */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente ou tipo de ação..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 rounded-lg border-border/50 bg-background focus:bg-background"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {FILTER_TABS.map(f => (
                    <button
                      key={f.v}
                      onClick={() => setStatusFilter(f.v)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150',
                        statusFilter === f.v
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabela */}
              <div className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm min-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                      {[
                        { l: 'Data',         w: 'w-20' },
                        { l: 'Tipo de Ação', w: '' },
                        { l: 'Cliente',      w: '' },
                        { l: 'Status',       w: 'w-36' },
                        { l: 'Atualizado',   w: 'w-28' },
                        { l: '',             w: 'w-10' },
                      ].map((h, i) => (
                        <TableHead
                          key={i}
                          className={cn(
                            'text-[10px] uppercase tracking-widest text-muted-foreground font-black py-3.5',
                            h.w,
                            i === 5 && 'text-right'
                          )}
                        >
                          {h.l}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-border/30">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j} className="py-4">
                              <Skeleton className="h-4 w-24 rounded-lg" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
                          <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                              <Scale className="h-8 w-8 text-muted-foreground/20" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                {petitions.length === 0 ? 'Nenhuma petição ainda' : 'Nenhum resultado'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {petitions.length === 0 ? 'Clique em Nova Petição para começar' : 'Tente ajustar os filtros'}
                              </p>
                            </div>
                            {petitions.length === 0 && (
                              <Button size="sm" onClick={() => setModalOpen(true)} className="gap-2 rounded-xl font-bold">
                                <Plus className="h-4 w-4" /> Nova Petição
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(p => {
                        const sc = STATUS[p.status] ?? STATUS.draft;
                        const ac = p.action_types ? getC(p.action_types.cor ?? 'slate') : null;
                        return (
                          <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-muted/25 transition-colors border-b border-border/30 last:border-0 group"
                            onClick={() => handleOpen(p.id, p.status)}
                          >
                            {/* Data */}
                            <TableCell className="py-3.5 text-xs text-muted-foreground font-semibold whitespace-nowrap">
                              {format(new Date(p.created_at), 'dd/MM/yy', { locale: ptBR })}
                            </TableCell>

                            {/* Tipo de ação */}
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2.5">
                                {ac && p.action_types && (
                                  <div className={cn('h-7 w-7 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shrink-0 shadow-sm', ac.grad)}>
                                    <ActionIcon icone={p.action_types.icone ?? 'FileText'} className="h-3.5 w-3.5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="block text-sm font-bold text-foreground leading-tight truncate">
                                    {p.action_types?.nome ?? '—'}
                                  </span>
                                  {p.petition_models_v2?.nome && (
                                    <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                                      {p.petition_models_v2.nome}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Cliente */}
                            <TableCell className="py-4 text-sm text-foreground font-semibold">
                              {getClientName(p)}
                            </TableCell>

                            {/* Status */}
                            <TableCell className="py-4">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap',
                                sc.cls
                              )}>
                                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', sc.dot)} />
                                {sc.label}
                              </span>
                            </TableCell>

                            {/* Atualizado */}
                            <TableCell className="py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {format(new Date(p.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                            </TableCell>

                            {/* Ações */}
                            <TableCell className="py-3.5 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-border/60 w-44">
                                  <DropdownMenuItem className="rounded-lg gap-2 font-medium" onClick={e => { e.stopPropagation(); handleOpen(p.id, p.status); }}>
                                    <Eye className="h-4 w-4" /> Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg gap-2 font-medium" onClick={e => { e.stopPropagation(); duplicatePetition(p.id); }}>
                                    <Copy className="h-4 w-4" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg gap-2 font-medium" onClick={e => { e.stopPropagation(); archivePetition(p.id); }}>
                                    <Archive className="h-4 w-4" /> Arquivar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg gap-2 font-medium text-destructive focus:text-destructive" onClick={e => { e.stopPropagation(); deletePetition(p.id); }}>
                                    <Trash2 className="h-4 w-4" /> Excluir
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
              </div>
            </div>

            {/* Painel lateral (1/3) */}
            <div className="hidden xl:block xl:sticky xl:top-4" style={{ height: 'calc(100vh - 170px)' }}>
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
