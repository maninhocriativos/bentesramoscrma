import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { usePetitionV3, PetitionTypeV3, PetitionCase } from '@/hooks/usePetitionV3';
import PetitionCaseModal from '@/components/peticoes-v3/PetitionCaseModal';
import PetitionPreviewModal from '@/components/peticoes-v3/PetitionPreviewModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, Plus, FileEdit, Eye, Trash2, MoreHorizontal, Clock, CheckCircle,
  Loader2, Scale, Landmark, Building2, Plane, FileText, Sparkles, Archive,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_ICONS: Record<string, typeof Landmark> = {
  'bancario-consumidor': Landmark,
  'fazenda-publica-servidor': Building2,
  'transporte-aereo-consumo': Plane,
};

const CATEGORY_COLORS: Record<string, string> = {
  'bancario-consumidor': 'from-amber-500/10 to-amber-500/[0.03] ring-amber-500/15',
  'fazenda-publica-servidor': 'from-blue-500/10 to-blue-500/[0.03] ring-blue-500/15',
  'transporte-aereo-consumo': 'from-violet-500/10 to-violet-500/[0.03] ring-violet-500/15',
};

const CATEGORY_ICON_COLORS: Record<string, string> = {
  'bancario-consumidor': 'text-amber-600 bg-amber-500/10',
  'fazenda-publica-servidor': 'text-blue-600 bg-blue-500/10',
  'transporte-aereo-consumo': 'text-violet-600 bg-violet-500/10',
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  rascunho: { label: 'Rascunho', className: 'bg-muted text-muted-foreground border-border/50', icon: FileEdit },
  gerando: { label: 'Gerando...', className: 'bg-amber-50 text-amber-700 border-amber-200/60', icon: Loader2 },
  gerado: { label: 'Gerado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', icon: CheckCircle },
  revisao: { label: 'Em Revisão', className: 'bg-blue-50 text-blue-700 border-blue-200/60', icon: Eye },
  aprovado: { label: 'Aprovado', className: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle },
  exportado: { label: 'Exportado', className: 'bg-purple-50 text-purple-700 border-purple-200/60', icon: FileText },
  arquivado: { label: 'Arquivado', className: 'bg-muted text-muted-foreground/60 border-border/30', icon: Archive },
};

export default function PeticoesIniciaisPage() {
  const { categories, types, cases, loading, createCase, updateCase, generatePetition, deleteCase, getTypesForCategory, fetchCases } = usePetitionV3();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PetitionTypeV3 | null>(null);
  const [selectedCase, setSelectedCase] = useState<PetitionCase | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    let result = cases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.cliente_nome?.toLowerCase().includes(q) ||
        c.titulo?.toLowerCase().includes(q) ||
        c.reu_nome?.toLowerCase().includes(q) ||
        c.petition_types_v3?.nome?.toLowerCase().includes(q)
      );
    }
    if (activeCategory !== 'all') {
      result = result.filter(c => c.petition_types_v3?.petition_categories?.slug === activeCategory);
    }
    return result;
  }, [cases, search, activeCategory]);

  const handleNewPetition = (type: PetitionTypeV3) => {
    setSelectedType(type);
    setSelectedCase(null);
    setCurrentCaseId(null);
    setModalOpen(true);
  };

  const handleEditCase = (c: PetitionCase) => {
    const type = types.find(t => t.id === c.petition_type_id);
    if (!type) return;
    setSelectedType(type);
    setSelectedCase(c);
    setCurrentCaseId(c.id);
    setModalOpen(true);
  };

  const handleSave = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (currentCaseId) {
        await updateCase(currentCaseId, data);
      } else if (selectedType) {
        const id = await createCase(selectedType.id, data);
        if (id) setCurrentCaseId(id);
      }
      await fetchCases();
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let caseId = currentCaseId;
      if (!caseId && selectedType) {
        caseId = await createCase(selectedType.id);
        if (caseId) setCurrentCaseId(caseId);
      }
      if (!caseId) return;
      const content = await generatePetition(caseId);
      if (content) {
        setModalOpen(false);
        await fetchCases();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = (c: PetitionCase) => {
    setSelectedCase(c);
    setPreviewOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Petições Iniciais</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gere petições estruturadas com IA a partir dos modelos do escritório
                </p>
              </div>
            </div>
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar petições..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-60 h-9 text-sm"
            />
          </div>
        </div>

        {/* Categories + Types */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary/60" />
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Nova Petição</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {categories.map(cat => {
              const CatIcon = CATEGORY_ICONS[cat.slug] || FileText;
              const catTypes = getTypesForCategory(cat.id);
              const colorClass = CATEGORY_COLORS[cat.slug] || 'from-primary/10 to-primary/[0.03] ring-primary/15';
              const iconColorClass = CATEGORY_ICON_COLORS[cat.slug] || 'text-primary bg-primary/10';

              return (
                <Card key={cat.id} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className={`px-5 py-4 border-b border-border/30 bg-gradient-to-r ${colorClass} flex items-center gap-3`}>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconColorClass}`}>
                      <CatIcon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate">{cat.nome}</h3>
                      <p className="text-[11px] text-muted-foreground">{catTypes.length} tipos de ação</p>
                    </div>
                  </div>
                  <CardContent className="p-1.5">
                    <div className="space-y-px">
                      {catTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => handleNewPetition(type)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted/50 transition-colors group"
                        >
                          <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium truncate leading-tight">{type.nome}</p>
                            {type.descricao && (
                              <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{type.descricao}</p>
                            )}
                          </div>
                          <div className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 bg-primary/10 transition-all">
                            <Plus className="h-3.5 w-3.5 text-primary" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Cases History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Histórico</h2>
              {cases.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-semibold">{cases.length}</Badge>
              )}
            </div>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="h-8 bg-muted/40 p-0.5">
                <TabsTrigger value="all" className="text-[11px] px-3 h-7 font-medium">Todas</TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger key={cat.slug} value={cat.slug} className="text-[11px] px-3 h-7 font-medium">
                    {cat.nome.split('/')[0].trim()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                <p className="text-xs text-muted-foreground">Carregando petições...</p>
              </div>
            </div>
          ) : filteredCases.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-4 ring-1 ring-border/30">
                  <Scale className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-semibold text-foreground/70">Nenhuma petição encontrada</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                  Selecione um tipo de ação acima para começar a gerar sua primeira petição
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {filteredCases.map(c => {
                const typeInfo = c.petition_types_v3;
                const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.rascunho;
                const StatusIcon = statusCfg.icon;

                return (
                  <Card key={c.id} className="border-border/40 hover:border-border/60 hover:shadow-sm transition-all duration-150 group">
                    <CardContent className="p-3.5 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/[0.03] flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                        <FileText className="h-4.5 w-4.5 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{c.titulo || typeInfo?.nome || 'Petição'}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${statusCfg.className}`}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${c.status === 'gerando' ? 'animate-spin' : ''}`} />
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {c.cliente_nome && <span className="text-[11px] text-muted-foreground font-medium">👤 {c.cliente_nome}</span>}
                          {c.reu_nome && <span className="text-[11px] text-muted-foreground">🏛️ {c.reu_nome}</span>}
                          {typeInfo?.petition_categories?.nome && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{typeInfo.petition_categories.nome}</Badge>
                          )}
                          {c.updated_at && (
                            <span className="text-[11px] text-muted-foreground/50">
                              {format(new Date(c.updated_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEditCase(c)}>
                          <FileEdit className="h-3.5 w-3.5" />
                        </Button>
                        {c.generated_content && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handlePreview(c)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleEditCase(c)}>
                              <FileEdit className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            {c.generated_content && (
                              <DropdownMenuItem onClick={() => handlePreview(c)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> Visualizar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteCase(c.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedType && (
        <PetitionCaseModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          petitionType={selectedType}
          existingCase={selectedCase}
          onSave={handleSave}
          onGenerate={handleGenerate}
          saving={saving}
          generating={generating}
        />
      )}

      <PetitionPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        content={selectedCase?.generated_content as Record<string, unknown> | null}
        titulo={selectedCase?.titulo || undefined}
        onRegenerate={selectedCase ? async () => {
          setGenerating(true);
          await generatePetition(selectedCase.id);
          setGenerating(false);
        } : undefined}
        regenerating={generating}
      />
    </AppLayout>
  );
}
