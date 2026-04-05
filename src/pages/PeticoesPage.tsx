import { useState, useMemo } from 'react';
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
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
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

const COLORS: Record<string, { grad: string; soft: string; ring: string }> = {
  sky:     { grad: 'from-sky-500 to-blue-600',      soft: 'bg-sky-50 dark:bg-sky-950/40',      ring: 'ring-sky-200 dark:ring-sky-800' },
  blue:    { grad: 'from-blue-500 to-indigo-600',   soft: 'bg-blue-50 dark:bg-blue-950/40',    ring: 'ring-blue-200 dark:ring-blue-800' },
  lime:    { grad: 'from-lime-500 to-emerald-600',  soft: 'bg-lime-50 dark:bg-lime-950/40',    ring: 'ring-lime-200 dark:ring-lime-800' },
  red:     { grad: 'from-red-500 to-rose-600',      soft: 'bg-red-50 dark:bg-red-950/40',      ring: 'ring-red-200 dark:ring-red-800' },
  emerald: { grad: 'from-emerald-500 to-teal-600',  soft: 'bg-emerald-50 dark:bg-emerald-950/40', ring: 'ring-emerald-200 dark:ring-emerald-800' },
  rose:    { grad: 'from-rose-500 to-pink-600',     soft: 'bg-rose-50 dark:bg-rose-950/40',    ring: 'ring-rose-200 dark:ring-rose-800' },
  violet:  { grad: 'from-violet-500 to-purple-600', soft: 'bg-violet-50 dark:bg-violet-950/40', ring: 'ring-violet-200 dark:ring-violet-800' },
  teal:    { grad: 'from-teal-500 to-cyan-600',     soft: 'bg-teal-50 dark:bg-teal-950/40',    ring: 'ring-teal-200 dark:ring-teal-800' },
  amber:   { grad: 'from-amber-500 to-orange-500',  soft: 'bg-amber-50 dark:bg-amber-950/40',  ring: 'ring-amber-200 dark:ring-amber-800' },
  orange:  { grad: 'from-orange-500 to-red-500',    soft: 'bg-orange-50 dark:bg-orange-950/40', ring: 'ring-orange-200 dark:ring-orange-800' },
  fuchsia: { grad: 'from-fuchsia-500 to-violet-600', soft: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', ring: 'ring-fuchsia-200 dark:ring-fuchsia-800' },
  cyan:    { grad: 'from-cyan-500 to-blue-500',     soft: 'bg-cyan-50 dark:bg-cyan-950/40',    ring: 'ring-cyan-200 dark:ring-cyan-800' },
  pink:    { grad: 'from-pink-500 to-rose-500',     soft: 'bg-pink-50 dark:bg-pink-950/40',    ring: 'ring-pink-200 dark:ring-pink-800' },
  slate:   { grad: 'from-slate-500 to-gray-600',    soft: 'bg-slate-50 dark:bg-slate-950/40',  ring: 'ring-slate-200 dark:ring-slate-800' },
};

function getC(cor: string) { return COLORS[cor] ?? COLORS.slate; }

// ─── Status ────────────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; cls: string; dot: string; icon: React.ReactNode }> = {
  draft:     { label: 'Rascunho',    dot: 'bg-amber-400',   cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',    icon: <FileText className="h-3 w-3" /> },
  review:    { label: 'Em Revisão',  dot: 'bg-yellow-400',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800', icon: <Clock className="h-3 w-3" /> },
  generated: { label: 'Gerado',      dot: 'bg-emerald-400', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800', icon: <FileCheck2 className="h-3 w-3" /> },
  filed:     { label: 'Protocolado', dot: 'bg-violet-400',  cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800', icon: <CheckCircle2 className="h-3 w-3" /> },
  archived:  { label: 'Arquivado',   dot: 'bg-gray-400',    cls: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-700',           icon: <Archive className="h-3 w-3" /> },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL NOVA PETIÇÃO — steps visuais elaborados
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
    setSelectedAction(action);
    setSearch('');
    setStep(2);
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
  const selC = selectedAction ? getC(selectedAction.cor) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl" style={{ height: '82vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Step indicator ── */}
        <div className="shrink-0 px-6 pt-6 pb-0">
          {/* Título + fechar */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">
                Nova Petição
              </p>
              <h2 className="text-xl font-bold text-foreground">
                {step === 1 ? 'Qual é o tipo de ação?' : selectedAction?.nome}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {step === 1 ? 'Selecione a categoria jurídica da petição' : 'Agora escolha o modelo de documento'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Steps visuais */}
          <div className="flex items-center gap-0 mb-5">
            {[
              { n: 1, label: 'Tipo de Ação' },
              { n: 2, label: 'Modelo' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                    step === s.n
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                      : step > s.n
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  )}>
                    {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
                  </div>
                  <span className={cn(
                    'text-xs font-medium transition-colors',
                    step === s.n ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < 1 && (
                  <div className={cn(
                    'h-px w-12 mx-3 transition-colors duration-300',
                    step > 1 ? 'bg-emerald-400' : 'bg-border'
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Busca — só no step 1 */}
          {step === 1 && (
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar tipo de ação..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-muted/40 border-border/50 focus:bg-background"
              />
            </div>
          )}

          {/* Breadcrumb — step 2 */}
          {step === 2 && selectedAction && selC && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setStep(1); setSearch(''); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowRight className="h-3 w-3 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                Tipos de ação
              </button>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <div className="flex items-center gap-1.5">
                <span className={cn('p-1 rounded-md bg-gradient-to-br text-white inline-flex', selC.grad)}>
                  <ActionIcon icone={selectedAction.icone} className="h-3 w-3" />
                </span>
                <span className="text-xs font-medium text-foreground">{selectedAction.nome}</span>
              </div>
            </div>
          )}
        </div>

        {/* Divisor */}
        <div className="h-px bg-border/50 shrink-0 mx-6" />

        {/* ── Conteúdo ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 pt-4">

            {/* STEP 1 — Tipos de ação em grid 2 cols */}
            {step === 1 && (
              filteredActions.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Scale className="h-12 w-12 mx-auto mb-3 opacity-10" />
                  <p className="text-sm font-medium">Nenhum tipo encontrado</p>
                  <button onClick={() => setSearch('')} className="text-xs text-primary mt-1 hover:underline">
                    Limpar busca
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredActions.map(action => {
                    const c = getC(action.cor);
                    const count = getModelsForAction(action.id).length;
                    const disabled = count === 0;
                    return (
                      <button
                        key={action.id}
                        disabled={disabled}
                        onClick={() => pickAction(action)}
                        className={cn(
                          'group w-full text-left rounded-2xl border bg-card transition-all duration-200 overflow-hidden',
                          disabled
                            ? 'opacity-40 cursor-not-allowed border-border/40'
                            : 'border-border/60 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                        )}
                      >
                        {/* Topo colorido */}
                        <div className={cn('h-1.5 bg-gradient-to-r', c.grad)} />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className={cn(
                              'p-2.5 rounded-xl bg-gradient-to-br text-white shadow-md ring-4 ring-white dark:ring-card',
                              c.grad
                            )}>
                              <ActionIcon icone={action.icone} className="h-5 w-5" />
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-semibold tabular-nums"
                            >
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
                          <div className={cn(
                            'mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary transition-all duration-200',
                            disabled ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                          )}>
                            Selecionar <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {/* STEP 2 — Modelos em lista rica */}
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
                    className="group w-full text-left flex items-start gap-4 p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  >
                    {/* Número */}
                    <div className="shrink-0 h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors mt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {model.nome}
                        </span>
                        {model.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                            <Sparkles className="h-2.5 w-2.5" /> Padrão
                          </span>
                        )}
                      </div>
                      {model.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {model.descricao}
                        </p>
                      )}
                      {model.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {model.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 h-8 w-8 rounded-xl border border-border/60 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-all mt-0.5">
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Rodapé ── */}
        <div className="shrink-0 px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {step === 1
              ? `${filteredActions.length} tipo${filteredActions.length !== 1 ? 's' : ''} de ação`
              : `${actionModels.length} modelo${actionModels.length !== 1 ? 's' : ''} disponível${actionModels.length !== 1 ? 'is' : ''}`
            }
          </p>
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs h-8 rounded-lg">
            Cancelar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAINEL LATERAL — cards grandes com accordion
// ═══════════════════════════════════════════════════════════════════════════════

function ModelsSidePanel({
  actionTypes, getModelsForAction, onSelectModel,
}: {
  actionTypes: ActionType[];
  getModelsForAction: (id: string) => PetitionModelV2[];
  onSelectModel: (actionId: string, modelId: string) => void;
}) {
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">

      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-foreground">Modelos</p>
            <p className="text-[11px] text-muted-foreground">{totalModels} modelos em {actionTypes.length} categorias</p>
          </div>
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Gavel className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo ou ação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-muted/40 border-border/40"
          />
        </div>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5">
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
              <div key={action.id} className="rounded-xl overflow-hidden border border-border/40">
                {/* Cabeçalho da ação */}
                <button
                  onClick={() => setExpanded(isOpen ? null : action.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 transition-colors',
                    isOpen ? 'bg-muted/60' : 'bg-card hover:bg-muted/30'
                  )}
                >
                  {/* Ícone */}
                  <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white shrink-0 shadow-sm', c.grad)}>
                    <ActionIcon icone={action.icone} className="h-3.5 w-3.5" />
                  </div>

                  {/* Nome + contagem */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-foreground truncate">{action.nome}</p>
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
                  <div className="border-t border-border/40 bg-muted/10">
                    {mods.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-3">Sem modelos</p>
                    ) : mods.map((model, i) => (
                      <button
                        key={model.id}
                        onClick={() => onSelectModel(action.id, model.id)}
                        className={cn(
                          'group w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors',
                          i < mods.length - 1 && 'border-b border-border/30'
                        )}
                      >
                        {/* Linha vertical de cor */}
                        <div className={cn('w-0.5 self-stretch rounded-full bg-gradient-to-b shrink-0 mt-0.5', c.grad)} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {model.nome}
                            </p>
                            {model.is_default && (
                              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
                                Padrão
                              </span>
                            )}
                          </div>
                          {model.descricao && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                              {model.descricao}
                            </p>
                          )}
                          {model.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {model.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 rounded-full bg-muted text-[9px] text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                              {model.tags.length > 2 && (
                                <span className="text-[9px] text-muted-foreground">+{model.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 shrink-0 mt-1 transition-all group-hover:translate-x-0.5" />
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

  const filtered = useMemo(() => {
    return petitions.filter(p => {
      const fd   = p.form_data_json as Record<string, unknown>;
      const nome = (fd?.cliente as Record<string, string>)?.nome_completo ?? '';
      const acao = p.action_types?.nome ?? '';
      const okS  = !searchTerm || nome.toLowerCase().includes(searchTerm.toLowerCase()) || acao.toLowerCase().includes(searchTerm.toLowerCase());
      const okF  = statusFilter === 'all' || p.status === statusFilter;
      return okS && okF;
    });
  }, [petitions, searchTerm, statusFilter]);

  function getClientName(p: typeof petitions[0]) {
    const fd = p.form_data_json as Record<string, unknown>;
    return (fd?.cliente as Record<string, string>)?.nome_completo ?? '—';
  }

  function handleOpen(id: string, status: string) {
    navigate(status === 'generated' || status === 'filed'
      ? `/peticoes/${id}/revisao`
      : `/peticoes/${id}/editar`
    );
  }

  const STAT_CARDS = [
    { label: 'Total',        value: stats.total,     dot: 'bg-foreground/25',  active: false },
    { label: 'Rascunhos',    value: stats.draft,     dot: 'bg-amber-400',      active: statusFilter === 'draft' },
    { label: 'Em Revisão',   value: stats.review,    dot: 'bg-yellow-400',     active: statusFilter === 'review' },
    { label: 'Gerados',      value: stats.generated, dot: 'bg-emerald-400',    active: statusFilter === 'generated' },
    { label: 'Protocolados', value: stats.filed,     dot: 'bg-violet-400',     active: statusFilter === 'filed' },
  ];

  const STATUS_FILTERS = [
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
        <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">

          {/* ── Hero Header ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                <Scale className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                  Gerador de Petições
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {models.length} modelos disponíveis · {petitions.length} petições geradas
                </p>
              </div>
            </div>
            <Button
              onClick={() => setModalOpen(true)}
              className="gap-2 rounded-xl h-10 px-5 shadow-md shadow-primary/20 font-semibold shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nova Petição
            </Button>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {STAT_CARDS.map(s => (
              <Card
                key={s.label}
                className={cn(
                  'border transition-all duration-200 cursor-pointer hover:shadow-md',
                  s.active ? 'border-primary/40 shadow-sm bg-primary/5' : 'border-border/50'
                )}
                onClick={() => {
                  const map: Record<string, string> = {
                    'Rascunhos': 'draft', 'Em Revisão': 'review',
                    'Gerados': 'generated', 'Protocolados': 'filed',
                  };
                  setStatusFilter(map[s.label] ?? 'all');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold truncate">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-3xl font-black text-foreground tabular-nums">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Layout 2 colunas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* Coluna esquerda — tabela (2/3) */}
            <div className="lg:col-span-2 space-y-4">

              {/* Barra de filtros */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente ou tipo de ação..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 rounded-xl border-border/50 bg-card"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_FILTERS.map(f => (
                    <button
                      key={f.v}
                      onClick={() => setStatusFilter(f.v)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150',
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
              <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/50">
                      {['Data', 'Tipo de Ação', 'Cliente', 'Status', 'Atualizado', ''].map((h, i) => (
                        <TableHead
                          key={i}
                          className={cn(
                            'text-[10px] uppercase tracking-widest text-muted-foreground font-bold py-3',
                            i === 5 && 'text-right w-10'
                          )}
                        >
                          {h}
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
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                              <Scale className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {petitions.length === 0 ? 'Nenhuma petição ainda' : 'Nenhum resultado encontrado'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {petitions.length === 0
                                  ? 'Clique em Nova Petição para começar'
                                  : 'Tente ajustar os filtros'}
                              </p>
                            </div>
                            {petitions.length === 0 && (
                              <Button size="sm" onClick={() => setModalOpen(true)} className="gap-2 rounded-xl mt-1">
                                <Plus className="h-4 w-4" /> Nova Petição
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(p => {
                        const sc = STATUS[p.status] ?? STATUS.draft;
                        return (
                          <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0 group"
                            onClick={() => handleOpen(p.id, p.status)}
                          >
                            <TableCell className="py-3.5 text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {format(new Date(p.created_at), 'dd/MM/yy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="py-3.5">
                              <div className="flex items-center gap-2">
                                {p.action_types && (
                                  <div className={cn(
                                    'h-6 w-6 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shrink-0',
                                    getC(p.action_types.cor ?? 'slate').grad
                                  )}>
                                    <ActionIcon icone={p.action_types.icone ?? 'FileText'} className="h-3 w-3" />
                                  </div>
                                )}
                                <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">
                                  {p.action_types?.nome ?? '—'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3.5 text-sm text-foreground">{getClientName(p)}</TableCell>
                            <TableCell className="py-3.5">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                                sc.cls
                              )}>
                                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', sc.dot)} />
                                {sc.label}
                              </span>
                            </TableCell>
                            <TableCell className="py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(p.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="py-3.5 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-border/60 w-44">
                                  <DropdownMenuItem
                                    className="rounded-lg text-sm gap-2"
                                    onClick={e => { e.stopPropagation(); handleOpen(p.id, p.status); }}
                                  >
                                    <Eye className="h-4 w-4" /> Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg text-sm gap-2"
                                    onClick={e => { e.stopPropagation(); duplicatePetition(p.id); }}
                                  >
                                    <Copy className="h-4 w-4" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg text-sm gap-2"
                                    onClick={e => { e.stopPropagation(); archivePetition(p.id); }}
                                  >
                                    <Archive className="h-4 w-4" /> Arquivar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="rounded-lg text-sm gap-2 text-destructive focus:text-destructive"
                                    onClick={e => { e.stopPropagation(); deletePetition(p.id); }}
                                  >
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

            {/* Coluna direita — painel modelos (1/3) */}
            <div
              className="hidden lg:block lg:sticky lg:top-4"
              style={{ height: 'calc(100vh - 200px)' }}
            >
              <ModelsSidePanel
                actionTypes={actionTypes}
                getModelsForAction={getModelsForAction}
                onSelectModel={(actionId, modelId) =>
                  navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`)
                }
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
        onConfirm={(actionId, modelId) =>
          navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`)
        }
      />
    </AppLayout>
  );
}
