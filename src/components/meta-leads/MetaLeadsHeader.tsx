import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Filter, Download, Sheet, Loader2, AlertTriangle } from 'lucide-react';
import { MetaFormLeadStatus, MetaFormLead } from '@/types/metaFormLeads';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface MetaLeadsHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterStatus: MetaFormLeadStatus | 'all';
  onFilterStatusChange: (status: MetaFormLeadStatus | 'all') => void;
  filterFormId: string | 'all';
  onFilterFormIdChange: (formId: string | 'all') => void;
  formIds: string[];
  totalLeads: number;
  onRefresh: () => void;
  onSync?: () => void;
  syncing?: boolean;
  syncError?: string | null;
  leads: MetaFormLead[];
}

const statusFilters: { value: MetaFormLeadStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'Todos', color: 'bg-muted text-muted-foreground' },
  { value: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700' },
  { value: 'em_atendimento', label: 'Em Atendimento', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'concluido', label: 'Concluído', color: 'bg-green-100 text-green-700' },
  { value: 'perdido', label: 'Perdido', color: 'bg-red-100 text-red-700' },
];

const statusLabels: Record<MetaFormLeadStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em Atendimento',
  concluido: 'Concluído',
  perdido: 'Perdido',
};

export function MetaLeadsHeader({
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterFormId,
  onFilterFormIdChange,
  formIds,
  totalLeads,
  onRefresh,
  onSync,
  syncing,
  syncError,
  leads,
}: MetaLeadsHeaderProps) {
  const { toast } = useToast();

  const exportToCSV = () => {
    if (leads.length === 0) {
      toast({ title: 'Nenhum lead para exportar', variant: 'destructive' });
      return;
    }

    const headers = ['Nome', 'Telefone', 'Email', 'Status', 'Data Criação', 'Último Contato', 'Form ID', 'Campaign ID'];
    const rows = leads.map((lead) => [
      lead.nome || '',
      lead.telefone || '',
      lead.email || '',
      statusLabels[lead.status] || lead.status,
      lead.created_at ? new Date(lead.created_at).toLocaleString('pt-BR') : '',
      lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleString('pt-BR') : '',
      lead.form_id || '',
      lead.campaign_id || '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads-meta-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Exportação concluída', description: `${leads.length} leads exportados.` });
  };

  return (
    <div className="border-b bg-card px-4 py-3 space-y-3">
      {/* Sync error banner */}
      {syncError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-destructive">Erro na sincronização</p>
            <p className="text-muted-foreground text-xs mt-1 break-words">{syncError}</p>
          </div>
        </div>
      )}

      {/* Title row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold whitespace-nowrap">Leads Sheets / Meta</h1>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            {totalLeads} leads
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          {onSync && (
            <Button variant="default" size="sm" onClick={onSync} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700">
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sheet className="h-4 w-4 mr-2" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar Sheets'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
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
        
        {/* Form filter */}
        {formIds.length > 1 && (
          <Select value={filterFormId} onValueChange={onFilterFormIdChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Formulário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os formulários</SelectItem>
              {formIds.map((fid) => (
                <SelectItem key={fid} value={fid}>
                  Form ...{fid.slice(-6)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
