import { Calendar, Filter, MapPin, Target, Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface DashboardFilters {
  period: string;
  origem: string;
  status: string;
  search: string;
}

interface DashboardFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export function DashboardFiltersBar({ filters, onFiltersChange }: DashboardFiltersProps) {
  const handleChange = (key: keyof DashboardFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({ period: 'all', origem: 'all', status: 'all', search: '' });
  };

  const hasActiveFilters = filters.period !== 'all' || filters.origem !== 'all' || filters.status !== 'all' || filters.search !== '';

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 border border-border/40">
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="pl-10 pr-10 h-11 bg-muted/30 border-0 rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-ring"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
              onClick={() => handleChange('search', '')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros</span>
          </div>
          
          <Select value={filters.period} onValueChange={(v) => handleChange('period', v)}>
            <SelectTrigger className="w-[130px] h-8 bg-muted/30 border-0 text-xs rounded-lg">
              <Calendar className="h-3 w-3 mr-1 text-muted-foreground/60" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo Período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.origem} onValueChange={(v) => handleChange('origem', v)}>
            <SelectTrigger className="w-[120px] h-8 bg-muted/30 border-0 text-xs rounded-lg">
              <MapPin className="h-3 w-3 mr-1 text-muted-foreground/60" />
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="Google">Google</SelectItem>
              <SelectItem value="Site">Site</SelectItem>
              <SelectItem value="Indicação">Indicação</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger className="w-[140px] h-8 bg-muted/30 border-0 text-xs rounded-lg">
              <Target className="h-3 w-3 mr-1 text-muted-foreground/60" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Lead Frio">Lead Frio</SelectItem>
              <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
              <SelectItem value="Aguardando Contrato">Aguardando Contrato</SelectItem>
              <SelectItem value="Contrato Assinado">Contrato Assinado</SelectItem>
              <SelectItem value="Ganho">Ganho</SelectItem>
              <SelectItem value="Perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
