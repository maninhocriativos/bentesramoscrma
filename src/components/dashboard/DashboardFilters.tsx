import { Calendar, Filter, MapPin, Target } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface DashboardFilters {
  period: string;
  origem: string;
  status: string;
}

interface DashboardFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export function DashboardFiltersBar({ filters, onFiltersChange }: DashboardFiltersProps) {
  const handleChange = (key: keyof DashboardFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-card rounded-xl shadow-enterprise p-4 border border-border/50">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4 text-gold" />
          <span>Filtros:</span>
        </div>
        
        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.period} onValueChange={(v) => handleChange('period', v)}>
            <SelectTrigger className="w-[160px] h-9 bg-muted/50 border-border/50 text-sm">
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
        </div>

        {/* Origem Filter */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.origem} onValueChange={(v) => handleChange('origem', v)}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-border/50 text-sm">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Origens</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="Google">Google</SelectItem>
              <SelectItem value="Site">Site</SelectItem>
              <SelectItem value="Indicação">Indicação</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger className="w-[160px] h-9 bg-muted/50 border-border/50 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="Lead Frio">Lead Frio</SelectItem>
              <SelectItem value="Em Atendimento">Em Atendimento</SelectItem>
              <SelectItem value="Aguardando Contrato">Aguardando Contrato</SelectItem>
              <SelectItem value="Contrato Assinado">Contrato Assinado</SelectItem>
              <SelectItem value="Ganho">Ganho</SelectItem>
              <SelectItem value="Perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
