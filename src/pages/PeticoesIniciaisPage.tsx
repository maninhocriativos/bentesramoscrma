import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { usePetitionV3, PetitionTypeV3, PetitionCase } from '@/hooks/usePetitionV3';
import PetitionCaseModal from '@/components/peticoes-v3/PetitionCaseModal';
import PetitionPreviewModal from '@/components/peticoes-v3/PetitionPreviewModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, Plus, FileEdit, Eye, Trash2, MoreHorizontal, Clock, CheckCircle,
  Loader2, Scale, Landmark, Building2, Plane, FileText, Sparkles, Archive,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_ICONS: Record<string, typeof Landmark> = {
  'bancario-consumidor': Landmark,
  'fazenda-publica-servidor': Building2,
  'transporte-aereo-consumo': Plane,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: FileEdit },
  gerando: { label: 'Gerando...', color: 'bg-amber-100 text-amber-700', icon: Loader2 },
  gerado: { label: 'Gerado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  revisao: { label: 'Em Revisão', color: 'bg-blue-100 text-blue-700', icon: Eye },
  aprovado: { label: 'Aprovado', color: 'bg-primary/10 text-primary', icon: CheckCircle },
  exportado: { label: 'Exportado', color: 'bg-purple-100 text-purple-700', icon: FileText },
  arquivado: { label: 'Arquivado', color: 'bg-muted text-muted-foreground/60', icon: Archive },
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

  // Filter cases
  const filteredCases = useMemo(() => {
    let result = cases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.cliente_nome?.toLowerCase().includes(q) ||
        c.titulo?.toLowerCase().includes(q) ||
        c.reu_nome?.toLowerCase().includes(q) ||
        (c.petition_types_v3 as any)?.nome?.toLowerCase().includes(q)
      );
    }
    if (activeCategory !== 'all') {
      result = result.filter(c => (c.petition_types_v3 as any)?.petition_categories?.slug === activeCategory);
    }
    return result;
  }, [cases, search, activeCategory]);

  // Open new petition modal
  const handleNewPetition = (type: PetitionTypeV3) => {
    setSelectedType(type);
    setSelectedCase(null);
    setCurrentCaseId(null);
    setModalOpen(true);
  };

  // Open existing case
  const handleEditCase = async (c: PetitionCase) => {
    const type = types.find(t => t.id === c.petition_type_id);
    if (!type) return;
    setSelectedType(type);
    setSelectedCase(c);
    setCurrentCaseId(c.id);
    setModalOpen(true);
  };

  // Save draft
  const handleSave = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (currentCaseId) {
        await updateCase(currentCaseId, data);
      } else if (selectedType) {
        const id = await createCase(selectedType.id, data as any);
        if (id) setCurrentCaseId(id);
      }
      await fetchCases();
    } finally {
      setSaving(false);
    }
  };

  // Generate
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
        // Find updated case
        await fetchCases();
      }
    } finally {
      setGenerating(false);
    }
  };

  // Preview
  const handlePreview = (c: PetitionCase) => {
    setSelectedCase(c);
    setPreviewOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Petições Iniciais</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gere petições estruturadas com IA a partir dos modelos do escritório
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar petições..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </div>

        {/* Categories + Types */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Nova Petição</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {categories.map(cat => {
              const CatIcon = CATEGORY_ICONS[cat.slug] || FileText;
              const catTypes = getTypesForCategory(cat.id);

              return (
                <Card key={cat.id} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow">
                  <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CatIcon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{cat.nome}</h3>
                      <p className="text-xs text-muted-foreground">{catTypes.length} tipos</p>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <div className="space-y-0.5">
                      {catTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => handleNewPetition(type)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted/60 transition-colors group"
                        >
                          <div className="h-7 w-7 rounded-md bg-primary/[0.06] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                            <FileText className="h-3.5 w-3.5 text-primary/70" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{type.nome}</p>
                            {type.descricao && (
                              <p className="text-xs text-muted-foreground truncate">{type.descricao}</p>
                            )}
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Histórico</h2>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3 h-7">Todas</TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger key={cat.slug} value={cat.slug} className="text-xs px-3 h-7">{cat.nome.split('/')[0].trim()}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCases.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                  <Scale className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="text-sm font-semibold text-muted-foreground">Nenhuma petição encontrada</h3>
                <p className="text-xs text-muted-foreground/70 mt-1">Selecione um tipo de ação acima para começar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredCases.map(c => {
                const typeInfo = c.petition_types_v3 as any;
                const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.rascunho;
                const StatusIcon = statusCfg.icon;

                return (
                  <Card key={c.id} className="hover:shadow-sm transition-shadow group">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{c.titulo || typeInfo?.nome || 'Petição'}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusCfg.color}`}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${c.status === 'gerando' ? 'animate-spin' : ''}`} />
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {c.cliente_nome && <span className="text-xs text-muted-foreground">👤 {c.cliente_nome}</span>}
                          {c.reu_nome && <span className="text-xs text-muted-foreground">🏛️ {c.reu_nome}</span>}
                          {typeInfo?.petition_categories?.nome && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{typeInfo.petition_categories.nome}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground/60">
                            {format(new Date(c.updated_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCase(c)}>
                          <FileEdit className="h-4 w-4" />
                        </Button>
                        {c.generated_content && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCase(c)}>
                              <FileEdit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            {c.generated_content && (
                              <DropdownMenuItem onClick={() => handlePreview(c)}>
                                <Eye className="h-4 w-4 mr-2" /> Visualizar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteCase(c.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
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
