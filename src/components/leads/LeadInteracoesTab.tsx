import { useState, useMemo } from 'react';
import { Plus, Phone, Mail, MessageSquare, Users, Building, ArrowUpRight, ArrowDownLeft, Search, Filter, X } from 'lucide-react';
import { useInteracoes } from '@/hooks/useInteracoes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InteracaoModal } from './InteracaoModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadInteracoesTabProps {
  clienteId: string;
}

const tipoIcons: Record<string, React.ReactNode> = {
  'Ligação': <Phone className="h-4 w-4" />,
  'Email': <Mail className="h-4 w-4" />,
  'WhatsApp': <MessageSquare className="h-4 w-4" />,
  'Reunião': <Users className="h-4 w-4" />,
  'Atendimento Presencial': <Building className="h-4 w-4" />,
};

const tipoColors: Record<string, string> = {
  'Ligação': 'bg-blue-500/10 text-blue-600',
  'Email': 'bg-purple-500/10 text-purple-600',
  'WhatsApp': 'bg-green-500/10 text-green-600',
  'Reunião': 'bg-amber-500/10 text-amber-600',
  'Atendimento Presencial': 'bg-slate-500/10 text-slate-600',
};

const tiposInteracao = ['Ligação', 'Email', 'WhatsApp', 'Reunião', 'Atendimento Presencial'];

export function LeadInteracoesTab({ clienteId }: LeadInteracoesTabProps) {
  const { interacoes, loading, createInteracao } = useInteracoes(clienteId);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [direcaoFilter, setDirecaoFilter] = useState<string>('all');

  const filteredInteracoes = useMemo(() => {
    return interacoes.filter((interacao) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          interacao.resumo.toLowerCase().includes(query) ||
          (interacao.detalhes?.toLowerCase().includes(query) ?? false);
        if (!matchesSearch) return false;
      }

      // Tipo filter
      if (tipoFilter !== 'all' && interacao.tipo !== tipoFilter) {
        return false;
      }

      // Direção filter
      if (direcaoFilter !== 'all' && interacao.direcao !== direcaoFilter) {
        return false;
      }

      return true;
    });
  }, [interacoes, searchQuery, tipoFilter, direcaoFilter]);

  const hasActiveFilters = searchQuery || tipoFilter !== 'all' || direcaoFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setTipoFilter('all');
    setDirecaoFilter('all');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-medium">Histórico de Interações</h3>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Interação
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por resumo ou detalhes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {tiposInteracao.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={direcaoFilter} onValueChange={setDirecaoFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Direção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Entrada">Entrada</SelectItem>
                <SelectItem value="Saída">Saída</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpar filtros">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground mt-2">
            {filteredInteracoes.length} de {interacoes.length} interações
          </p>
        )}
      </Card>

      {interacoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma interação registrada</p>
            <Button variant="outline" className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar primeira interação
            </Button>
          </CardContent>
        </Card>
      ) : filteredInteracoes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma interação encontrada com os filtros aplicados</p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInteracoes.map((interacao) => (
            <Card key={interacao.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${tipoColors[interacao.tipo]}`}>
                    {tipoIcons[interacao.tipo]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{interacao.tipo}</span>
                      <Badge variant="outline" className="text-xs">
                        {interacao.direcao === 'Entrada' ? (
                          <ArrowDownLeft className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        )}
                        {interacao.direcao}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{interacao.resumo}</p>
                    {interacao.detalhes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {interacao.detalhes}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(interacao.data_interacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InteracaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clienteId={clienteId}
        onSave={createInteracao}
      />
    </div>
  );
}