import { useState, useMemo } from 'react';
import { Search, Filter, X, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/types/leads';
import { useToast } from '@/hooks/use-toast';

interface LeadFiltersProps {
  leads: Lead[];
  onFilterChange: (filteredLeads: Lead[]) => void;
}

const VALOR_RANGES = [
  { label: 'Todos os valores', value: 'all', min: 0, max: Infinity },
  { label: 'Até R$ 10.000', value: '0-10000', min: 0, max: 10000 },
  { label: 'R$ 10.000 - R$ 50.000', value: '10000-50000', min: 10000, max: 50000 },
  { label: 'R$ 50.000 - R$ 100.000', value: '50000-100000', min: 50000, max: 100000 },
  { label: 'R$ 100.000 - R$ 500.000', value: '100000-500000', min: 100000, max: 500000 },
  { label: 'Acima de R$ 500.000', value: '500000+', min: 500000, max: Infinity },
];

const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export function LeadFilters({ leads, onFilterChange }: LeadFiltersProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [tipoAcao, setTipoAcao] = useState('all');
  const [valorRange, setValorRange] = useState('all');
  const [currentFiltered, setCurrentFiltered] = useState<Lead[]>([]);

  // Get unique tipos de ação from leads
  const tiposAcao = useMemo(() => {
    const tipos = new Set<string>();
    leads.forEach(lead => {
      if (lead.tipo_acao) tipos.add(lead.tipo_acao);
    });
    return Array.from(tipos).sort();
  }, [leads]);

  // Apply filters
  useMemo(() => {
    let filtered = [...leads];

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(lead =>
        (lead.nome?.toLowerCase() || '').includes(searchLower) ||
        (lead.email?.toLowerCase() || '').includes(searchLower) ||
        (lead.telefone || '').includes(search)
      );
    }

    // Tipo de ação filter
    if (tipoAcao !== 'all') {
      filtered = filtered.filter(lead => lead.tipo_acao === tipoAcao);
    }

    // Valor range filter
    if (valorRange !== 'all') {
      const range = VALOR_RANGES.find(r => r.value === valorRange);
      if (range) {
        filtered = filtered.filter(lead => {
          const valor = lead.valor_causa || 0;
          return valor >= range.min && valor < range.max;
        });
      }
    }

    setCurrentFiltered(filtered);
    onFilterChange(filtered);
  }, [leads, search, tipoAcao, valorRange, onFilterChange]);

  // Export to CSV function
  const exportToCSV = () => {
    if (currentFiltered.length === 0) {
      toast({
        title: 'Nenhum lead para exportar',
        description: 'Ajuste os filtros para ter leads disponíveis.',
        variant: 'destructive',
      });
      return;
    }

    const headers = [
      'Nome',
      'Email',
      'Telefone',
      'Status',
      'Origem',
      'Tipo de Ação',
      'Valor da Causa',
      'Data de Criação',
      'Última Atualização',
      'Link do Contrato',
      'Resumo/Anotações',
    ];

    const rows = currentFiltered.map(lead => [
      lead.nome || '',
      lead.email || '',
      lead.telefone || '',
      lead.status || '',
      lead.origem || '',
      lead.tipo_acao || '',
      formatCurrency(lead.valor_causa),
      formatDate(lead.created_at),
      lead.updated_at ? formatDate(lead.updated_at) : '',
      lead.link_contrato || '',
      (lead.resumo_ia || '').replace(/[\n\r]/g, ' '),
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';')),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída!',
      description: `${currentFiltered.length} lead(s) exportado(s) para CSV.`,
    });
  };

  const activeFiltersCount = [
    search.trim() !== '',
    tipoAcao !== 'all',
    valorRange !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setTipoAcao('all');
    setValorRange('all');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-soft mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-lg h-9"
        />
      </div>

      {/* Tipo de Ação */}
      <Select value={tipoAcao} onValueChange={setTipoAcao}>
        <SelectTrigger className="w-[160px] h-9 rounded-lg">
          <SelectValue placeholder="Tipo de Ação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {tiposAcao.map((tipo) => (
            <SelectItem key={tipo} value={tipo}>
              {tipo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Faixa de Valor */}
      <Select value={valorRange} onValueChange={setValorRange}>
        <SelectTrigger className="w-[180px] h-9 rounded-lg">
          <SelectValue placeholder="Faixa de valor" />
        </SelectTrigger>
        <SelectContent>
          {VALOR_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active filters indicator */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      {/* Export Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={exportToCSV}
        className="h-9 px-3 rounded-lg ml-auto"
      >
        <Download className="h-4 w-4 mr-2" />
        Exportar CSV
      </Button>
    </div>
  );
}
