import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Filter } from 'lucide-react';
import { MetaFormLeadStatus } from '@/types/metaFormLeads';
import { cn } from '@/lib/utils';

interface MetaLeadsHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterStatus: MetaFormLeadStatus | 'all';
  onFilterStatusChange: (status: MetaFormLeadStatus | 'all') => void;
  totalLeads: number;
  onRefresh: () => void;
}

const statusFilters: { value: MetaFormLeadStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'Todos', color: 'bg-gray-100 text-gray-700' },
  { value: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { value: 'em_atendimento', label: 'Em Atendimento', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'concluido', label: 'Concluído', color: 'bg-green-100 text-green-700' },
  { value: 'perdido', label: 'Perdido', color: 'bg-red-100 text-red-700' },
];

export function MetaLeadsHeader({
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  totalLeads,
  onRefresh,
}: MetaLeadsHeaderProps) {
  return (
    <div className="border-b bg-card px-4 py-3 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Leads da API (Meta Forms)</h1>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            {totalLeads} leads
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant="ghost"
              size="sm"
              onClick={() => onFilterStatusChange(filter.value)}
              className={cn(
                "h-7 px-2.5 text-xs font-medium rounded-full transition-all",
                filterStatus === filter.value
                  ? filter.color + " shadow-sm"
                  : "hover:bg-accent"
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
