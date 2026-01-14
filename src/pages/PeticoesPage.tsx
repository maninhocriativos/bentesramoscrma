import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, TrendingUp, CreditCard, AlertTriangle, Ban,
  Plus, Search, Filter, MoreHorizontal, Eye, Copy, FileText, Archive
} from 'lucide-react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const ICON_MAP: Record<string, React.ReactNode> = {
  Package: <Package className="h-6 w-6" />,
  TrendingUp: <TrendingUp className="h-6 w-6" />,
  CreditCard: <CreditCard className="h-6 w-6" />,
  AlertTriangle: <AlertTriangle className="h-6 w-6" />,
  Ban: <Ban className="h-6 w-6" />,
  FileText: <FileText className="h-6 w-6" />,
};

const TYPE_COLORS: Record<string, string> = {
  cobranca_pacote_bancario: 'from-blue-500 to-indigo-600',
  juros_abusivos: 'from-red-500 to-rose-600',
  rmc_rcc: 'from-amber-500 to-orange-600',
  negativacao_indevida: 'from-purple-500 to-violet-600',
  emprestimo_nao_reconhecido: 'from-emerald-500 to-teal-600',
};

export default function PeticoesPage() {
  const navigate = useNavigate();
  const { petitions, petitionTypes, loading, duplicatePetition, archivePetition } = usePeticoes();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPetitions = petitions.filter(p => {
    const matchesSearch = !searchTerm || 
      p.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.petition_types?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
      
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <Tabs defaultValue="lista" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="lista">Minhas Petições</TabsTrigger>
              <TabsTrigger value="nova">Nova Petição</TabsTrigger>
            </TabsList>
          </div>

          {/* Lista de petições */}
          <TabsContent value="lista" className="space-y-4">
            {/* Filtros */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente ou tipo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs px-3">Todos</TabsTrigger>
                  <TabsTrigger value="rascunho" className="text-xs px-3">Rascunhos</TabsTrigger>
                  <TabsTrigger value="em_revisao" className="text-xs px-3">Em Revisão</TabsTrigger>
                  <TabsTrigger value="gerado" className="text-xs px-3">Gerados</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Tabela */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary hover:bg-primary">
                    <TableHead className="text-primary-foreground">Data</TableHead>
                    <TableHead className="text-primary-foreground">Tipo</TableHead>
                    <TableHead className="text-primary-foreground">Cliente</TableHead>
                    <TableHead className="text-primary-foreground">Status</TableHead>
                    <TableHead className="text-primary-foreground">Atualização</TableHead>
                    <TableHead className="text-primary-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPetitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma petição encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPetitions.map((petition) => {
                      const status = STATUS_LABELS[petition.status];
                      return (
                        <TableRow 
                          key={petition.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenPetition(petition.id, petition.status)}
                        >
                          <TableCell className="font-medium">
                            {format(new Date(petition.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {ICON_MAP[petition.petition_types?.icon || 'FileText']}
                              <span className="text-sm">{petition.petition_types?.title}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {petition.client_name || petition.leads_juridicos?.nome || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${status.color} text-white`}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(petition.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
          <TabsContent value="nova" className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Escolha o tipo de ação</h2>
              <p className="text-muted-foreground">
                Selecione o tipo de petição para começar o preenchimento
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {petitionTypes.map((type) => (
                <Card
                  key={type.slug}
                  className="group cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all hover:-translate-y-1 overflow-hidden"
                  onClick={() => handleCreatePetition(type.slug)}
                >
                  <CardContent className="p-0">
                    <div className={`p-4 bg-gradient-to-r text-white ${TYPE_COLORS[type.slug] || 'from-gray-500 to-gray-600'}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                          {ICON_MAP[type.icon]}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{type.title}</h3>
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {type.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
