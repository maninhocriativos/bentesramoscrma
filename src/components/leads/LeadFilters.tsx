import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, X, Download, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/types/leads';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [tipoOrigem, setTipoOrigem] = useState('all');
  const [currentFiltered, setCurrentFiltered] = useState<Lead[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Store ref to avoid dependency issues
  const onFilterChangeRef = React.useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Get unique tipos de ação from leads
  const tiposAcao = useMemo(() => {
    const tipos = new Set<string>();
    leads.forEach(lead => {
      if (lead.tipo_acao) tipos.add(lead.tipo_acao);
    });
    return Array.from(tipos).sort();
  }, [leads]);

  // Apply filters
  const filteredLeads = useMemo(() => {
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

    // Tipo de origem filter (tráfego vs whatsapp direto)
    if (tipoOrigem !== 'all') {
      filtered = filtered.filter(lead => {
        const origem = lead.tipo_origem || 'indefinido';
        return origem === tipoOrigem;
      });
    }

    return filtered;
  }, [leads, search, tipoAcao, valorRange, tipoOrigem]);

  // Update parent when filtered leads change - using ref to avoid loop
  useEffect(() => {
    setCurrentFiltered(filteredLeads);
    onFilterChangeRef.current(filteredLeads);
  }, [filteredLeads]);

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
    tipoOrigem !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setTipoAcao('all');
    setValorRange('all');
    setTipoOrigem('all');
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-3">
      {/* Tipo de Ação */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Tipo de Ação</label>
        <Select value={tipoAcao} onValueChange={setTipoAcao}>
          <SelectTrigger className="w-full h-10 rounded-lg">
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
      </div>

      {/* Faixa de Valor */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Faixa de Valor</label>
        <Select value={valorRange} onValueChange={setValorRange}>
          <SelectTrigger className="w-full h-10 rounded-lg">
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
      </div>

      {/* Tipo de Origem */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Origem do Contato</label>
        <Select value={tipoOrigem} onValueChange={setTipoOrigem}>
          <SelectTrigger className="w-full h-10 rounded-lg">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="trafego">🎯 Tráfego Pago</SelectItem>
            <SelectItem value="whatsapp_direto">💬 WhatsApp Direto</SelectItem>
            <SelectItem value="indefinido">❓ Indefinido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {activeFiltersCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="w-full mt-2"
        >
          <X className="h-4 w-4 mr-2" />
          Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Mobile: Search + Filter Button */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-sm"
          />
        </div>

        {/* Mobile Filter Button */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className={cn(
                "h-9 w-9 rounded-lg shrink-0 md:hidden relative",
                activeFiltersCount > 0 && "border-primary text-primary"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </SheetTitle>
            </SheetHeader>
            <FilterControls />
            <div className="flex gap-2 mt-6">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setFiltersOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setFiltersOpen(false)}
              >
                Aplicar
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop Filters */}
        <div className="hidden md:flex items-center gap-2">
          <Select value={tipoAcao} onValueChange={setTipoAcao}>
            <SelectTrigger className="w-[160px] h-10 rounded-lg">
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

          <Select value={valorRange} onValueChange={setValorRange}>
            <SelectTrigger className="w-[180px] h-10 rounded-lg">
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

          <Select value={tipoOrigem} onValueChange={setTipoOrigem}>
            <SelectTrigger className="w-[170px] h-10 rounded-lg">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="trafego">🎯 Tráfego</SelectItem>
              <SelectItem value="whatsapp_direto">💬 Direto</SelectItem>
              <SelectItem value="indefinido">❓ Indefinido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filters indicator - Desktop */}
        {activeFiltersCount > 0 && (
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              {activeFiltersCount}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Export Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={exportToCSV}
          className="h-9 w-9 rounded-lg shrink-0"
          title="Exportar CSV"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Results Count - Compact */}
      <div className="text-xs text-muted-foreground px-1">
        {currentFiltered.length} lead{currentFiltered.length !== 1 ? 's' : ''} encontrado{currentFiltered.length !== 1 ? 's' : ''}
        {activeFiltersCount > 0 && (
          <button 
            onClick={clearFilters}
            className="text-primary hover:underline ml-2 md:hidden"
          >
            (limpar)
          </button>
        )}
      </div>
    </div>
  );
}
