import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, TrendingUp, CreditCard, AlertTriangle, Ban, ShoppingCart,
  Plus, Search, MoreHorizontal, Eye, Copy, FileText, Archive, ArrowLeft, Trash2,
  Sparkles, FileCheck2, Clock, CheckCircle2, XCircle, BarChart3, Plane
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePeticoes } from '@/hooks/usePeticoes';
import { STATUS_LABELS, type PetitionType } from '@/types/peticoes';
import { TemplatePicker } from '@/components/peticoes/TemplatePicker';
import { getTemplatesByType, type PetitionTemplate } from '@/lib/petitionTemplates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ReactNode> = {
  Package: <Package className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
  Ban: <Ban className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  ShoppingCart: <ShoppingCart className="h-5 w-5" />,
  Plane: <Plane className="h-5 w-5" />,
};

const TYPE_COLORS: Record<string, { gradient: string; bg: string; border: string }> = {
  cobranca_pacote_bancario: { 
    gradient: 'from-blue-600 via-blue-500 to-indigo-600', 
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800'
  },
  juros_abusivos: { 
    gradient: 'from-rose-600 via-red-500 to-pink-600',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800'
  },
  rmc_rcc: { 
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800'
  },
  negativacao_indevida: { 
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800'
  },
  emprestimo_nao_reconhecido: { 
    gradient: 'from-emerald-600 via-teal-500 to-cyan-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800'
  },
  vendas_casadas: { 
    gradient: 'from-pink-600 via-fuchsia-500 to-purple-600',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800'
  },
  seguro_nao_contratado: {
    gradient: 'from-orange-600 via-amber-500 to-yellow-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800'
  },
  tarifa_bancaria: {
    gradient: 'from-cyan-600 via-sky-500 to-blue-600',
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200 dark:border-cyan-800'
  },
  cancelamento_voo: {
    gradient: 'from-sky-600 via-indigo-500 to-violet-600',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-800'
  },
  emprestimo_fraudulento: {
    gradient: 'from-red-600 via-rose-500 to-pink-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800'
  },
  renovacao_emprestimo: {
    gradient: 'from-fuchsia-600 via-purple-500 to-indigo-600',
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
    border: 'border-fuchsia-200 dark:border-fuchsia-800'
  },
  servidor_publico_promocao: {
    gradient: 'from-teal-600 via-emerald-500 to-green-600',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800'
  },
  diferenca_salarial: {
    gradient: 'from-lime-600 via-green-500 to-emerald-600',
    bg: 'bg-lime-50 dark:bg-lime-950/30',
    border: 'border-lime-200 dark:border-lime-800'
  },
  revisao_contrato_emprestimo: {
    gradient: 'from-slate-600 via-gray-500 to-zinc-600',
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    border: 'border-slate-200 dark:border-slate-800'
  },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  rascunho: <FileText className="h-4 w-4" />,
  em_revisao: <Clock className="h-4 w-4" />,
  aprovado: <CheckCircle2 className="h-4 w-4" />,
  gerado: <FileCheck2 className="h-4 w-4" />,
  protocolado: <Sparkles className="h-4 w-4" />,
  arquivado: <Archive className="h-4 w-4" />,
};

export default function PeticoesPage() {
  const navigate = useNavigate();
  const { petitions, petitionTypes, loading, createPetition, duplicatePetition, archivePetition, deletePetition } = usePeticoes();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('lista');
  const [selectedTypeForTemplate, setSelectedTypeForTemplate] = useState<PetitionType | null>(null);

  // Stats
  const stats = useMemo(() => {
    const total = petitions.length;
    const rascunhos = petitions.filter(p => p.status === 'rascunho').length;
    const emRevisao = petitions.filter(p => p.status === 'em_revisao').length;
    const gerados = petitions.filter(p => p.status === 'gerado' || p.status === 'aprovado').length;
    const protocolados = petitions.filter(p => p.status === 'protocolado').length;
    
    return { total, rascunhos, emRevisao, gerados, protocolados };
  }, [petitions]);

  const filteredPetitions = useMemo(() => {
    return petitions.filter(p => {
      const matchesSearch = !searchTerm || 
        p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.petition_types?.title?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [petitions, searchTerm, statusFilter]);

  const handleCreatePetition = (typeSlug: string) => {
    // Check if there are templates for this type
    const templates = getTemplatesByType(typeSlug);
    const selectedType = petitionTypes.find(t => t.slug === typeSlug);
    
    if (templates.length > 0 && selectedType) {
      setSelectedTypeForTemplate(selectedType);
    } else {
      navigate(`/peticoes/nova?type=${typeSlug}`);
    }
  };

  const handleTemplateSelected = async (template: PetitionTemplate, html: string) => {
    // Create petition and navigate to editor with template HTML stored in sessionStorage
    const newId = await createPetition(template.typeSlug);
    if (newId) {
      sessionStorage.setItem(`petition-template-${newId}`, html);
      sessionStorage.setItem(`petition-template-title-${newId}`, template.acaoTitulo);
      navigate(`/peticoes/${newId}/editar?fromTemplate=true`);
    }
  };

  const handleSkipTemplate = () => {
    if (selectedTypeForTemplate) {
      navigate(`/peticoes/nova?type=${selectedTypeForTemplate.slug}`);
      setSelectedTypeForTemplate(null);
    }
  };

  const handleOpenPetition = (id: string, status: string) => {
    if (status === 'gerado' || status === 'protocolado') {
      navigate(`/peticoes/${id}/saida`);
    } else if (status === 'em_revisao' || status === 'aprovado') {
      navigate(`/peticoes/${id}/revisao`);
    } else {
      navigate(`/peticoes/${id}/editar`);
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Gerador de Petições" />
      
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
          {/* Hero Section - Compact & Premium */}
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
            <div className="relative p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-2xl text-primary-foreground shadow-md">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
                      Gerador de Petições com IA
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Crie petições profissionais em minutos com assistência inteligente
                    </p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => setActiveTab('nova')} 
                  className="gap-2 rounded-xl bg-primary hover:bg-primary/90 shadow-md h-11 px-6 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Nova Petição
                </Button>
              </div>
              
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
                {[
                  { label: 'Total', value: stats.total, color: 'text-foreground', dotColor: 'bg-foreground/60' },
                  { label: 'Rascunhos', value: stats.rascunhos, color: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
                  { label: 'Em Revisão', value: stats.emRevisao, color: 'text-yellow-600 dark:text-yellow-400', dotColor: 'bg-yellow-500' },
                  { label: 'Gerados', value: stats.gerados, color: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
                  { label: 'Protocolados', value: stats.protocolados, color: 'text-violet-600 dark:text-violet-400', dotColor: 'bg-violet-500' },
                ].map((stat) => (
                  <div key={stat.label} className="relative bg-muted/40 rounded-xl p-4 border border-border/30 hover:border-border/60 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("h-2 w-2 rounded-full", stat.dotColor)} />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</span>
                    </div>
                    <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
            <div className="flex items-center gap-3">
              {activeTab === 'nova' && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setActiveTab('lista')}
                  className="shrink-0 rounded-xl"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <TabsList className="bg-card border border-border/50 shadow-sm rounded-xl h-10">
                <TabsTrigger value="lista" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <BarChart3 className="h-4 w-4" />
                  Minhas Petições
                </TabsTrigger>
                <TabsTrigger value="nova" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Plus className="h-4 w-4" />
                  Nova Petição
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Lista de petições */}
            <TabsContent value="lista" className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente ou tipo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-xl border-border/50 bg-card h-10"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { value: 'all', label: 'Todos' },
                    { value: 'rascunho', label: 'Rascunhos' },
                    { value: 'em_revisao', label: 'Em Revisão' },
                    { value: 'gerado', label: 'Gerados' },
                  ].map((filter) => (
                    <Button
                      key={filter.value}
                      variant={statusFilter === filter.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(filter.value)}
                      className={cn(
                        "rounded-lg text-xs h-8 px-3",
                        statusFilter === filter.value 
                          ? "bg-primary text-primary-foreground" 
                          : "border-border/50 hover:bg-muted/50"
                      )}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tabela */}
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
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <span className="text-muted-foreground text-sm">Carregando petições...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredPetitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16">
                          <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-muted/30 rounded-2xl">
                              <FileText className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">Nenhuma petição encontrada</p>
                              <p className="text-sm text-muted-foreground">Comece criando sua primeira petição</p>
                            </div>
                            <Button variant="outline" onClick={() => setActiveTab('nova')} className="rounded-xl gap-2">
                              <Plus className="h-4 w-4" />
                              Criar petição
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPetitions.map((petition) => {
                        const status = STATUS_LABELS[petition.status];
                        const typeColor = TYPE_COLORS[petition.petition_type_slug] || TYPE_COLORS.cobranca_pacote_bancario;
                        return (
                          <TableRow 
                            key={petition.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/30"
                            onClick={() => handleOpenPetition(petition.id, petition.status)}
                          >
                            <TableCell className="font-medium text-sm">
                              {format(new Date(petition.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  "p-1.5 rounded-lg border",
                                  typeColor.bg,
                                  typeColor.border,
                                )}>
                                  {ICON_MAP[petition.petition_types?.icon || 'FileText']}
                                </div>
                                <span className="text-sm font-medium">{petition.petition_types?.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-sm">
                                {petition.client_name || petition.leads_juridicos?.nome || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                "gap-1.5 rounded-lg text-[11px] font-medium",
                                status.color,
                                "text-white shadow-sm"
                              )}>
                                {STATUS_ICONS[petition.status]}
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(petition.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                  <DropdownMenuItem onClick={() => handleOpenPetition(petition.id, petition.status)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Abrir
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicatePetition(petition.id)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => archivePetition(petition.id)}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Arquivar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => deletePetition(petition.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
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

            {/* Nova petição - seleção de tipo ou template */}
            <TabsContent value="nova" className="space-y-6">
              {selectedTypeForTemplate ? (
                <div className="space-y-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedTypeForTemplate(null)}
                    className="gap-2 rounded-xl"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar aos tipos
                  </Button>
                  <TemplatePicker
                    typeSlug={selectedTypeForTemplate.slug}
                    typeTitle={selectedTypeForTemplate.title}
                    onSelectTemplate={handleTemplateSelected}
                    onSkip={handleSkipTemplate}
                  />
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-foreground mb-1">Escolha o tipo de ação</h2>
                    <p className="text-sm text-muted-foreground">
                      Selecione o tipo de petição para começar
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {petitionTypes.map((type) => {
                      const colors = TYPE_COLORS[type.slug] || TYPE_COLORS.cobranca_pacote_bancario;
                      const templateCount = getTemplatesByType(type.slug).length;
                      return (
                        <div
                          key={type.slug}
                          className={cn(
                            "group cursor-pointer rounded-xl border border-border/50 bg-card overflow-hidden",
                            "transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
                          )}
                          onClick={() => handleCreatePetition(type.slug)}
                        >
                          {/* Color accent bar */}
                          <div className={cn("h-1.5 bg-gradient-to-r", colors.gradient)} />
                          
                          <div className="p-5">
                            <div className="flex items-start gap-3.5">
                              <div className={cn(
                                "p-2.5 rounded-xl border shrink-0",
                                colors.bg,
                                colors.border,
                              )}>
                                {ICON_MAP[type.icon]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-tight mb-1">
                                  {type.title}
                                </h3>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {type.description}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                              {templateCount > 0 ? (
                                <span className="text-[11px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                                  {templateCount} {templateCount === 1 ? 'modelo' : 'modelos'}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60">Sem modelos</span>
                              )}
                              <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                Iniciar
                                <ArrowLeft className="h-3 w-3 rotate-180" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
