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
  const { petitions, petitionTypes, loading, duplicatePetition, archivePetition, deletePetition } = usePeticoes();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('lista');

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
    navigate(`/peticoes/nova?type=${typeSlug}`);
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
        <div className="p-6 space-y-6">
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Gerador de Petições com IA</h1>
                  <p className="text-primary-foreground/80">
                    Crie petições profissionais em minutos com assistência inteligente
                  </p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold">{stats.total}</div>
                  <div className="text-sm text-primary-foreground/70">Total</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold text-amber-300">{stats.rascunhos}</div>
                  <div className="text-sm text-primary-foreground/70">Rascunhos</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold text-yellow-300">{stats.emRevisao}</div>
                  <div className="text-sm text-primary-foreground/70">Em Revisão</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold text-emerald-300">{stats.gerados}</div>
                  <div className="text-sm text-primary-foreground/70">Gerados</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-3xl font-bold text-purple-300">{stats.protocolados}</div>
                  <div className="text-sm text-primary-foreground/70">Protocolados</div>
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {activeTab === 'nova' && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setActiveTab('lista')}
                    className="shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="lista" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Minhas Petições
                  </TabsTrigger>
                  <TabsTrigger value="nova" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Petição
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {activeTab === 'lista' && (
                <Button onClick={() => setActiveTab('nova')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Petição
                </Button>
              )}
            </div>

            {/* Lista de petições */}
            <TabsContent value="lista" className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-1 w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente ou tipo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="h-9 bg-muted/50">
                    <TabsTrigger value="all" className="text-xs px-3">Todos</TabsTrigger>
                    <TabsTrigger value="rascunho" className="text-xs px-3">Rascunhos</TabsTrigger>
                    <TabsTrigger value="em_revisao" className="text-xs px-3">Em Revisão</TabsTrigger>
                    <TabsTrigger value="gerado" className="text-xs px-3">Gerados</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Tabela */}
              <Card className="border-0 shadow-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/80">
                      <TableHead className="text-primary-foreground font-semibold">Data</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">Tipo</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">Cliente</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-primary-foreground font-semibold">Atualização</TableHead>
                      <TableHead className="text-primary-foreground font-semibold text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <span className="text-muted-foreground">Carregando petições...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredPetitions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                            <span className="text-muted-foreground">Nenhuma petição encontrada</span>
                            <Button variant="outline" onClick={() => setActiveTab('nova')}>
                              <Plus className="mr-2 h-4 w-4" />
                              Criar primeira petição
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
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleOpenPetition(petition.id, petition.status)}
                          >
                            <TableCell className="font-medium">
                              {format(new Date(petition.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "p-1.5 rounded-lg",
                                  typeColor.bg,
                                  typeColor.border,
                                  "border"
                                )}>
                                  {ICON_MAP[petition.petition_types?.icon || 'FileText']}
                                </div>
                                <span className="text-sm font-medium">{petition.petition_types?.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {petition.client_name || petition.leads_juridicos?.nome || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                "gap-1.5",
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
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
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

            {/* Nova petição - seleção de tipo */}
            <TabsContent value="nova" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Escolha o tipo de ação</h2>
                <p className="text-muted-foreground">
                  Selecione o tipo de petição para começar a preencher os dados
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {petitionTypes.map((type) => {
                  const colors = TYPE_COLORS[type.slug] || TYPE_COLORS.cobranca_pacote_bancario;
                  return (
                    <Card
                      key={type.slug}
                      className={cn(
                        "group cursor-pointer overflow-hidden transition-all duration-300",
                        "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
                        "border-2 hover:border-primary/50"
                      )}
                      onClick={() => handleCreatePetition(type.slug)}
                    >
                      <CardContent className="p-0">
                        {/* Header com gradiente */}
                        <div className={cn(
                          "relative h-24 bg-gradient-to-br text-white",
                          colors.gradient,
                          "flex items-center justify-center"
                        )}>
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg">
                              {ICON_MAP[type.icon]}
                            </div>
                          </div>
                          {/* Decorative circles */}
                          <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full" />
                          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full" />
                        </div>
                        
                        {/* Content */}
                        <div className="p-5">
                          <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                            {type.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {type.description}
                          </p>
                          
                          {/* Action hint */}
                          <div className="mt-4 flex items-center gap-2 text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Iniciar</span>
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </AppLayout>
  );
}
