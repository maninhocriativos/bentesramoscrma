import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Copy,
  Archive,
  Trash2,
  FileCheck2,
  Clock,
  CheckCircle2,
  FileText,
  Scale,
  Plane,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Ban,
  ShoppingCart,
  Package,
  ArrowRight,
  X,
  ChevronRight,
  LayoutTemplate,
  SlidersHorizontal,
} from "lucide-react";
import { AppLayout } from "@/components/layouts/AppLayout";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePeticoesV2, type ActionType, type PetitionModelV2 } from "@/hooks/usePeticoesV2";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Maps ──────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  Plane: <Plane className="h-4 w-4" />,
  CreditCard: <CreditCard className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  AlertTriangle: <AlertTriangle className="h-4 w-4" />,
  Ban: <Ban className="h-4 w-4" />,
  ShoppingCart: <ShoppingCart className="h-4 w-4" />,
  Package: <Package className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Scale: <Scale className="h-4 w-4" />,
};

const COLOR_MAP: Record<string, { gradient: string; bg: string; text: string }> = {
  sky: {
    gradient: "from-sky-600 to-indigo-600",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-400",
  },
  blue: {
    gradient: "from-blue-600 to-indigo-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-400",
  },
  lime: {
    gradient: "from-lime-600 to-emerald-600",
    bg: "bg-lime-50 dark:bg-lime-950/30",
    text: "text-lime-700 dark:text-lime-400",
  },
  red: {
    gradient: "from-red-600 to-rose-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
  },
  emerald: {
    gradient: "from-emerald-600 to-teal-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  rose: {
    gradient: "from-rose-600 to-pink-600",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-400",
  },
  violet: {
    gradient: "from-violet-600 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-700 dark:text-violet-400",
  },
  teal: {
    gradient: "from-teal-600 to-emerald-600",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-700 dark:text-teal-400",
  },
  fuchsia: {
    gradient: "from-fuchsia-600 to-purple-600",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    text: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  slate: {
    gradient: "from-slate-600 to-gray-600",
    bg: "bg-slate-50 dark:bg-slate-950/30",
    text: "text-slate-700 dark:text-slate-400",
  },
  amber: {
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
  },
  orange: {
    gradient: "from-orange-600 to-amber-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-400",
  },
  cyan: {
    gradient: "from-cyan-600 to-sky-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    text: "text-cyan-700 dark:text-cyan-400",
  },
  pink: {
    gradient: "from-pink-600 to-fuchsia-600",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    text: "text-pink-700 dark:text-pink-400",
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: "Rascunho",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <FileText className="h-3 w-3" />,
  },
  review: {
    label: "Em Revisão",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: <Clock className="h-3 w-3" />,
  },
  generated: {
    label: "Gerado",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: <FileCheck2 className="h-3 w-3" />,
  },
  filed: {
    label: "Protocolado",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  archived: {
    label: "Arquivado",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
    icon: <Archive className="h-3 w-3" />,
  },
};

// ─── Modal de Seleção (Ação → Modelo) ─────────────────────────────────────────

type ModalStep = "action" | "model";

function NovaPeticaoModal({
  open,
  onClose,
  actionTypes,
  models,
  modelsPerAction,
  getModelsForAction,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  actionTypes: ActionType[];
  models: PetitionModelV2[];
  modelsPerAction: Record<string, number>;
  getModelsForAction: (id: string) => PetitionModelV2[];
  onNavigate: (actionId: string, modelId: string) => void;
}) {
  const [step, setStep] = useState<ModalStep>("action");
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [search, setSearch] = useState("");

  const handleClose = () => {
    setStep("action");
    setSelectedAction(null);
    setSearch("");
    onClose();
  };

  const handleSelectAction = (action: ActionType) => {
    const actionModels = getModelsForAction(action.id);
    if (actionModels.length === 1) {
      onNavigate(action.id, actionModels[0].id);
      handleClose();
    } else {
      setSelectedAction(action);
      setStep("model");
    }
  };

  const handleSelectModel = (model: PetitionModelV2) => {
    if (!selectedAction) return;
    onNavigate(selectedAction.id, model.id);
    handleClose();
  };

  const filteredActions = useMemo(() => {
    if (!search) return actionTypes;
    return actionTypes.filter(
      (a) =>
        a.nome.toLowerCase().includes(search.toLowerCase()) ||
        (a.descricao || "").toLowerCase().includes(search.toLowerCase()),
    );
  }, [actionTypes, search]);

  const actionModels = selectedAction ? getModelsForAction(selectedAction.id) : [];
  const selectedColors = selectedAction ? COLOR_MAP[selectedAction.cor] || COLOR_MAP.slate : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-card shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step === "model" && selectedAction && (
                <button
                  onClick={() => {
                    setStep("action");
                    setSearch("");
                  }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </button>
              )}
              <div>
                <DialogTitle className="font-semibold text-base flex items-center gap-2">
                  {step === "action" ? (
                    <>
                      <Scale className="h-4 w-4 text-primary" /> Nova Petição
                    </>
                  ) : (
                    <>
                      {selectedAction && selectedColors && (
                        <span
                          className={cn(
                            "p-1 rounded-md bg-gradient-to-br text-white inline-flex",
                            selectedColors.gradient,
                          )}
                        >
                          {ICON_MAP[selectedAction.icone] || <FileText className="h-4 w-4" />}
                        </span>
                      )}
                      {selectedAction?.nome}
                    </>
                  )}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step === "action" ? "Selecione o tipo de ação jurídica" : "Escolha o modelo para esta ação"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === "action" && (
            <div className="relative mt-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar tipo de ação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5">
            {/* Step: Ação */}
            {step === "action" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredActions.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-muted-foreground">
                    <Scale className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum tipo de ação encontrado</p>
                  </div>
                ) : (
                  filteredActions.map((action) => {
                    const colors = COLOR_MAP[action.cor] || COLOR_MAP.slate;
                    const count = modelsPerAction[action.id] || 0;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleSelectAction(action)}
                        className="group w-full text-left rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden"
                      >
                        <div className={cn("h-1 bg-gradient-to-r", colors.gradient)} />
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2.5">
                            <div
                              className={cn("p-2 rounded-lg bg-gradient-to-br text-white shadow-sm", colors.gradient)}
                            >
                              {ICON_MAP[action.icone] || <FileText className="h-4 w-4" />}
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {count} {count === 1 ? "modelo" : "modelos"}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                            {action.nome}
                          </p>
                          {action.descricao && (
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{action.descricao}</p>
                          )}
                          <div className="mt-2.5 flex items-center gap-1 text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            Selecionar <ArrowRight className="h-3 w-3" />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Step: Modelo */}
            {step === "model" && (
              <div className="space-y-3">
                {actionModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelectModel(model)}
                    className="group w-full text-left flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {model.nome}
                        </p>
                        {model.is_default && (
                          <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">Padrão</Badge>
                        )}
                      </div>
                      {model.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{model.descricao}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {model.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[9px] font-normal px-1.5 py-0 h-4">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-card shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {step === "action"
              ? `${filteredActions.length} tipo${filteredActions.length !== 1 ? "s" : ""} de ação`
              : `${actionModels.length} modelo${actionModels.length !== 1 ? "s" : ""} disponível${actionModels.length !== 1 ? "is" : ""}`}
          </p>
          <button
            onClick={handleClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel lateral de modelos ─────────────────────────────────────────────────

function ModelsSidePanel({
  actionTypes,
  models,
  modelsPerAction,
  getModelsForAction,
  onSelectModel,
}: {
  actionTypes: ActionType[];
  models: PetitionModelV2[];
  modelsPerAction: Record<string, number>;
  getModelsForAction: (id: string) => PetitionModelV2[];
  onSelectModel: (actionId: string, modelId: string) => void;
}) {
  const [sideSearch, setSideSearch] = useState("");
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const filteredActions = useMemo(() => {
    if (!sideSearch) return actionTypes;
    const q = sideSearch.toLowerCase();
    return actionTypes.filter(
      (a) => a.nome.toLowerCase().includes(q) || getModelsForAction(a.id).some((m) => m.nome.toLowerCase().includes(q)),
    );
  }, [actionTypes, sideSearch, getModelsForAction]);

  const totalModels = models.length;

  return (
    <Card className="border-border/60 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <LayoutTemplate size={14} className="text-primary" />
            Modelos Disponíveis
          </h2>
          <Badge variant="secondary" className="text-[10px] font-medium">
            {totalModels}
          </Badge>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar modelo..."
            value={sideSearch}
            onChange={(e) => setSideSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {filteredActions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <SlidersHorizontal size={26} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">Nenhum resultado</p>
            </div>
          ) : (
            filteredActions.map((action) => {
              const actionModels = getModelsForAction(action.id);
              const colors = COLOR_MAP[action.cor] || COLOR_MAP.slate;
              const isExpanded = expandedAction === action.id;

              return (
                <div key={action.id}>
                  {/* Action row */}
                  <button
                    onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <span className={cn("p-1.5 rounded-md bg-gradient-to-br text-white shrink-0", colors.gradient)}>
                      {ICON_MAP[action.icone] || <FileText className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 text-left text-xs font-medium text-foreground truncate">{action.nome}</span>
                    <Badge variant="secondary" className="text-[9px] shrink-0 font-mono h-4 px-1">
                      {actionModels.length}
                    </Badge>
                    <ChevronRight
                      size={12}
                      className={cn("text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-90")}
                    />
                  </button>

                  {/* Models under action */}
                  {isExpanded && (
                    <div className="ml-9 mt-0.5 space-y-0.5">
                      {actionModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => onSelectModel(action.id, model.id)}
                          className="group w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          <FileText size={11} className="text-muted-foreground group-hover:text-primary shrink-0" />
                          <span className="text-[11px] truncate flex-1">{model.nome}</span>
                          {model.is_default && (
                            <Badge className="bg-primary/10 text-primary text-[9px] px-1 py-0 h-3.5 shrink-0">
                              Padrão
                            </Badge>
                          )}
                          <ArrowRight size={10} className="text-primary opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ─── Page Principal ────────────────────────────────────────────────────────────

export default function PeticoesPage() {
  const navigate = useNavigate();
  const {
    actionTypes,
    models,
    petitions,
    loading,
    duplicatePetition,
    archivePetition,
    deletePetition,
    getModelsForAction,
  } = usePeticoesV2();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  // Stats
  const stats = useMemo(
    () => ({
      total: petitions.length,
      draft: petitions.filter((p) => p.status === "draft").length,
      generated: petitions.filter((p) => p.status === "generated").length,
      filed: petitions.filter((p) => p.status === "filed").length,
      review: petitions.filter((p) => p.status === "review").length,
    }),
    [petitions],
  );

  // Models count per action
  const modelsPerAction = useMemo(() => {
    const map: Record<string, number> = {};
    models.forEach((m) => {
      map[m.action_type_id] = (map[m.action_type_id] || 0) + 1;
    });
    return map;
  }, [models]);

  // Filtered petitions
  const filteredPetitions = useMemo(() => {
    return petitions.filter((p) => {
      const fd = p.form_data_json as Record<string, unknown>;
      const clientName = (fd?.cliente as Record<string, string>)?.nome_completo || "";
      const actionName = p.action_types?.nome || "";
      const matchesSearch =
        !searchTerm ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        actionName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [petitions, searchTerm, statusFilter]);

  const getClientName = (p: (typeof petitions)[0]) => {
    const fd = p.form_data_json as Record<string, unknown>;
    return (fd?.cliente as Record<string, string>)?.nome_completo || "—";
  };

  const handleNavigate = (actionId: string, modelId: string) => {
    navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`);
  };

  const handleOpenPetition = (id: string, status: string) => {
    if (status === "generated" || status === "filed") {
      navigate(`/peticoes/${id}/revisao`);
    } else {
      navigate(`/peticoes/${id}/editar`);
    }
  };

  // Quick-create from sidebar (same logic as modal)
  const handleSidebarModel = (actionId: string, modelId: string) => {
    navigate(`/peticoes/nova?action=${actionId}&model=${modelId}`);
  };

  return (
    <AppLayout>
      <AppHeader title="Gerador de Petições" />

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Gerador de Petições</h1>
                <p className="text-xs text-muted-foreground">
                  {models.length} modelos · {petitions.length} petições geradas
                </p>
              </div>
            </div>
            <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-9 shadow-sm">
              <Plus className="h-4 w-4" />
              Nova Petição
            </Button>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total", value: stats.total, dot: "bg-foreground/40" },
              { label: "Rascunhos", value: stats.draft, dot: "bg-amber-500" },
              { label: "Em Revisão", value: stats.review, dot: "bg-yellow-500" },
              { label: "Gerados", value: stats.generated, dot: "bg-emerald-500" },
              { label: "Protocolados", value: stats.filed, dot: "bg-violet-500" },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", stat.dot)} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                      {stat.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Main 2-col layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Petitions table (2/3) */}
            <div className="lg:col-span-2 space-y-3">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="relative flex-1 w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente ou ação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-sm rounded-xl border-border/50"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { value: "all", label: "Todos" },
                    { value: "draft", label: "Rascunho" },
                    { value: "review", label: "Revisão" },
                    { value: "generated", label: "Gerado" },
                    { value: "filed", label: "Protocolado" },
                  ].map((f) => (
                    <Button
                      key={f.value}
                      variant={statusFilter === f.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(f.value)}
                      className={cn(
                        "rounded-lg text-xs h-8 px-3",
                        statusFilter !== f.value && "border-border/50 hover:bg-muted/50",
                      )}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Data
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Tipo de Ação
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Cliente
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Atualização
                      </TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredPetitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3">
                            <Scale className="h-12 w-12 text-muted-foreground/20" />
                            <p className="text-sm text-muted-foreground">Nenhuma petição encontrada</p>
                            <Button size="sm" onClick={() => setModalOpen(true)} className="gap-2 rounded-xl">
                              <Plus className="h-4 w-4" /> Criar primeira petição
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPetitions.map((p) => {
                        const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                        return (
                          <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => handleOpenPetition(p.id, p.status)}
                          >
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(p.created_at), "dd/MM/yy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{p.action_types?.nome || "—"}</TableCell>
                            <TableCell className="text-sm">{getClientName(p)}</TableCell>
                            <TableCell>
                              <Badge className={cn("gap-1 text-[11px] font-medium", statusCfg.color)}>
                                {statusCfg.icon} {statusCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(p.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPetition(p.id, p.status);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" /> Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      duplicatePetition(p.id);
                                    }}
                                  >
                                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      archivePetition(p.id);
                                    }}
                                  >
                                    <Archive className="h-4 w-4 mr-2" /> Arquivar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deletePetition(p.id);
                                    }}
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

            {/* Right: Models sidebar (1/3) */}
            <div className="hidden lg:flex lg:flex-col" style={{ maxHeight: "calc(100vh - 220px)" }}>
              <ModelsSidePanel
                actionTypes={actionTypes}
                models={models}
                modelsPerAction={modelsPerAction}
                getModelsForAction={getModelsForAction}
                onSelectModel={handleSidebarModel}
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Modal Nova Petição */}
      <NovaPeticaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        actionTypes={actionTypes}
        models={models}
        modelsPerAction={modelsPerAction}
        getModelsForAction={getModelsForAction}
        onNavigate={handleNavigate}
      />
    </AppLayout>
  );
}
