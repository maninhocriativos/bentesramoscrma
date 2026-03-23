import { Search, Download, Plus, Building2, Megaphone, X, LayoutGrid, List, DollarSign, FileBarChart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeadModal } from '@/components/LeadModal';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LeadStatus } from '@/types/leads';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadsTableHeaderProps {
  totalLeads: number;
  totalValue?: number;
  search: string;
  onSearchChange: (value: string) => void;
  filterOrigem: string;
  onFilterOrigemChange: (value: string) => void;
  filterResponsavel: string;
  onFilterResponsavelChange: (value: string) => void;
  filterEtapa: string;
  onFilterEtapaChange: (value: string) => void;
  filterPrioridade: string;
  onFilterPrioridadeChange: (value: string) => void;
  filterLinha: string;
  onFilterLinhaChange: (value: string) => void;
  origens: string[];
  etapas: LeadStatus[];
  countBentesRamos: number;
  countTrafego: number;
  viewMode?: 'cards' | 'list' | 'board';
  onViewModeChange?: (mode: 'cards' | 'list' | 'board') => void;
}

const formatCurrencyCompact = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

export function LeadsTableHeader({
  totalLeads,
  totalValue = 0,
  search,
  onSearchChange,
  filterOrigem,
  onFilterOrigemChange,
  filterEtapa,
  onFilterEtapaChange,
  filterLinha,
  onFilterLinhaChange,
  origens,
  etapas,
  countBentesRamos,
  countTrafego,
  viewMode = 'cards',
  onViewModeChange,
}: LeadsTableHeaderProps) {
  const { toast } = useToast();
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);

  const exportToCSV = async () => {
    try {
      const { data: leads, error } = await supabase
        .from('leads_juridicos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!leads || leads.length === 0) {
        toast({ title: 'Nenhum lead para exportar', variant: 'destructive' });
        return;
      }

      const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Tipo de Ação', 'Valor da Causa', 'Linha WhatsApp', 'Empresa', 'Data de Criação'];
      const rows = leads.map(lead => [
        lead.nome || '', lead.email || '', lead.telefone || '', lead.status || '',
        lead.origem || '', lead.tipo_acao || '', lead.valor_causa || '',
        lead.linha_whatsapp || '', lead.empresa_tag || '',
        new Date(lead.created_at).toLocaleDateString('pt-BR'),
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

      toast({ title: 'Exportação concluída!', description: `${leads.length} leads exportados.` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Erro ao exportar', variant: 'destructive' });
    }
  };

  const hasActiveFilters = filterOrigem !== 'all' || filterEtapa !== 'all';

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <header className="sticky top-0 z-20 bg-card border-b">
          {/* Main Row */}
          <div className="h-14 px-4 lg:px-6 flex items-center gap-3">
            {/* Title + Count */}
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-display font-semibold text-foreground tracking-tight">Pipeline</h1>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="h-5.5 px-2 text-[11px] font-semibold bg-primary/8 text-primary border-0 rounded-md">
                  {totalLeads}
                </Badge>
                {totalValue > 0 && (
                  <Badge variant="secondary" className="h-5.5 px-2 text-[11px] font-medium bg-stage-ganho/8 text-stage-ganho border-0 rounded-md hidden sm:flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrencyCompact(totalValue)}
                  </Badge>
                )}
              </div>
            </div>

            {/* View Mode Toggle - 3 options */}
            <div className="hidden sm:flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/40">
              <button
                onClick={() => onViewModeChange?.('cards')}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200",
                  viewMode === 'cards'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                onClick={() => onViewModeChange?.('list')}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200",
                  viewMode === 'list'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                onClick={() => onViewModeChange?.('board')}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200",
                  viewMode === 'board'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Board
              </button>
            </div>

            {/* Linha WhatsApp Tabs */}
            <div className="hidden md:flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40">
              <button
                onClick={() => onFilterLinhaChange('all')}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-medium transition-all duration-200",
                  filterLinha === 'all'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => onFilterLinhaChange('bentes_ramos_antigo')}
                className={cn(
                  "flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200",
                  filterLinha === 'bentes_ramos_antigo'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Building2 className="h-3 w-3" />
                <span className="hidden lg:inline">B&R</span>
                <span className="text-[10px] opacity-50">{countBentesRamos}</span>
              </button>
              <button
                onClick={() => onFilterLinhaChange('trafego_isa')}
                className={cn(
                  "flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium transition-all duration-200",
                  filterLinha === 'trafego_isa'
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Megaphone className="h-3 w-3" />
                <span className="hidden lg:inline">Tráfego</span>
                <span className="text-[10px] opacity-50">{countTrafego}</span>
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full max-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-muted/30 border-border/40 focus:border-primary/40 focus:bg-card transition-all"
              />
              {search && (
                <button 
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="hidden lg:flex items-center gap-1.5">
              <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
                <SelectTrigger className={cn(
                  "w-[110px] h-8 text-[11px] rounded-lg border-border/40 bg-muted/30 transition-all",
                  filterOrigem !== 'all' && "border-primary/30 bg-primary/5"
                )}>
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {origens.map(origem => (
                    <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterEtapa} onValueChange={onFilterEtapaChange}>
                <SelectTrigger className={cn(
                  "w-[120px] h-8 text-[11px] rounded-lg border-border/40 bg-muted/30 transition-all",
                  filterEtapa !== 'all' && "border-primary/30 bg-primary/5"
                )}>
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas etapas</SelectItem>
                  {etapas.map(etapa => (
                    <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { onFilterOrigemChange('all'); onFilterEtapaChange('all'); }}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Limpar filtros</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={exportToCSV}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar CSV</TooltipContent>
              </Tooltip>

              <Button
                onClick={() => setIsNewLeadModalOpen(true)}
                size="sm"
                className="h-8 px-3 gap-1.5 rounded-lg font-medium text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Novo</span>
              </Button>
            </div>
          </div>
        </header>
      </TooltipProvider>

      <LeadModal
        lead={null}
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        isNew={true}
        canDelete={false}
      />
    </>
  );
}
