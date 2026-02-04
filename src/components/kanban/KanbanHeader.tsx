import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Download, Filter, X, SlidersHorizontal, Users, Wifi, RefreshCw, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Lead } from '@/types/leads';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface KanbanHeaderProps {
  leads: Lead[];
  onFilterChange: (filteredLeads: Lead[]) => void;
  onNewLead: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
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
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

export function KanbanHeader({ 
  leads, 
  onFilterChange, 
  onNewLead, 
  onRefresh, 
  isRefreshing, 
  realtimeStatus 
}: KanbanHeaderProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [tipoAcao, setTipoAcao] = useState('all');
  const [valorRange, setValorRange] = useState('all');
  const [tipoOrigem, setTipoOrigem] = useState('all');
  const [currentFiltered, setCurrentFiltered] = useState<Lead[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const onFilterChangeRef = useRef(onFilterChange);
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

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(lead =>
        (lead.nome?.toLowerCase() || '').includes(searchLower) ||
        (lead.email?.toLowerCase() || '').includes(searchLower) ||
        (lead.telefone || '').includes(search)
      );
    }

    if (tipoAcao !== 'all') {
      filtered = filtered.filter(lead => lead.tipo_acao === tipoAcao);
    }

    if (valorRange !== 'all') {
      const range = VALOR_RANGES.find(r => r.value === valorRange);
      if (range) {
        filtered = filtered.filter(lead => {
          const valor = lead.valor_causa || 0;
          return valor >= range.min && valor < range.max;
        });
      }
    }

    if (tipoOrigem !== 'all') {
      filtered = filtered.filter(lead => {
        const origem = lead.tipo_origem || 'indefinido';
        return origem === tipoOrigem;
      });
    }

    return filtered;
  }, [leads, search, tipoAcao, valorRange, tipoOrigem]);

  useEffect(() => {
    setCurrentFiltered(filteredLeads);
    onFilterChangeRef.current(filteredLeads);
  }, [filteredLeads]);

  const exportToCSV = () => {
    if (currentFiltered.length === 0) {
      toast({ title: 'Nenhum lead para exportar', variant: 'destructive' });
      return;
    }

    const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Tipo de Ação', 'Valor da Causa', 'Data de Criação'];
    const rows = currentFiltered.map(lead => [
      lead.nome || '',
      lead.email || '',
      lead.telefone || '',
      lead.status || '',
      lead.origem || '',
      lead.tipo_acao || '',
      formatCurrency(lead.valor_causa),
      formatDate(lead.created_at),
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))].join('\n');
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

    toast({ title: 'Exportação concluída!', description: `${currentFiltered.length} leads exportados.` });
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

  const activeLeads = leads.filter(l => !['Perdido', 'Ganho'].includes(l.status || '')).length;
  const wonLeads = leads.filter(l => l.status === 'Ganho').length;

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
      {/* Top Row - Title + Actions */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Title + Stats */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Pipeline</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{currentFiltered.length}</span>
              <span>leads</span>
              {activeFiltersCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span>{activeLeads} ativos</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Realtime Status - Minimal */}
          <div className={cn(
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            realtimeStatus === 'connected' && "bg-success/10 text-success",
            realtimeStatus === 'connecting' && "bg-amber-500/10 text-amber-600",
            realtimeStatus === 'disconnected' && "bg-destructive/10 text-destructive"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              realtimeStatus === 'connected' && "bg-success",
              realtimeStatus === 'connecting' && "bg-amber-500 animate-pulse",
              realtimeStatus === 'disconnected' && "bg-destructive"
            )} />
            <Wifi className="w-3 h-3" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>

          <Button onClick={onNewLead} size="sm" className="gap-1.5 h-9">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Lead</span>
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-2 px-4 lg:px-6 pb-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg bg-background"
          />
        </div>

        {/* Desktop Filters */}
        <div className="hidden lg:flex items-center gap-2">
          <Select value={tipoAcao} onValueChange={setTipoAcao}>
            <SelectTrigger className="w-[150px] h-9 rounded-lg bg-background text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {tiposAcao.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={valorRange} onValueChange={setValorRange}>
            <SelectTrigger className="w-[160px] h-9 rounded-lg bg-background text-sm">
              <SelectValue placeholder="Valor" />
            </SelectTrigger>
            <SelectContent>
              {VALOR_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tipoOrigem} onValueChange={setTipoOrigem}>
            <SelectTrigger className="w-[140px] h-9 rounded-lg bg-background text-sm">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="trafego">Tráfego</SelectItem>
              <SelectItem value="whatsapp_direto">Direto</SelectItem>
              <SelectItem value="indefinido">Indefinido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filters badge + clear */}
        {activeFiltersCount > 0 && (
          <div className="hidden lg:flex items-center gap-1">
            <Badge variant="secondary" className="h-7 rounded-full px-2.5 text-xs font-medium">
              <Filter className="h-3 w-3 mr-1" />
              {activeFiltersCount}
            </Badge>
            <Button variant="ghost" size="icon" onClick={clearFilters} className="h-7 w-7">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Mobile Filter Sheet */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className={cn(
                "h-9 w-9 rounded-lg lg:hidden relative",
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
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Ação</label>
                <Select value={tipoAcao} onValueChange={setTipoAcao}>
                  <SelectTrigger className="w-full h-10 rounded-lg">
                    <SelectValue placeholder="Tipo de Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {tiposAcao.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Faixa de Valor</label>
                <Select value={valorRange} onValueChange={setValorRange}>
                  <SelectTrigger className="w-full h-10 rounded-lg">
                    <SelectValue placeholder="Faixa de valor" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALOR_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Origem</label>
                <Select value={tipoOrigem} onValueChange={setTipoOrigem}>
                  <SelectTrigger className="w-full h-10 rounded-lg">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="trafego">Tráfego</SelectItem>
                    <SelectItem value="whatsapp_direto">Direto</SelectItem>
                    <SelectItem value="indefinido">Indefinido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {activeFiltersCount > 0 && (
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Limpar filtros
                </Button>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setFiltersOpen(false)}>
                Fechar
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Export */}
        <Button variant="outline" size="icon" onClick={exportToCSV} className="h-9 w-9 rounded-lg" title="Exportar CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
