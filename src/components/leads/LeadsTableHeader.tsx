import { Search, Download, Plus, Building2, Megaphone, Filter, X } from 'lucide-react';
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
}

export function LeadsTableHeader({
  totalLeads,
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
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b shadow-soft">
          {/* Row 1: Title + Linha Tabs + Actions */}
          <div className="h-16 px-4 lg:px-6 flex items-center gap-4">
            {/* Title */}
            <div className="flex items-center gap-3 min-w-fit">
              <div>
                <h1 className="text-xl font-display font-semibold text-foreground tracking-tight">Pipeline</h1>
              </div>
              <Badge variant="secondary" className="h-6 px-2.5 text-xs font-semibold bg-primary/10 text-primary border-0">
                {totalLeads}
              </Badge>
            </div>

            {/* Linha WhatsApp Tabs */}
            <div className="hidden md:flex items-center bg-muted/60 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => onFilterLinhaChange('all')}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium transition-all duration-200",
                  filterLinha === 'all'
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => onFilterLinhaChange('bentes_ramos_antigo')}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium transition-all duration-200",
                  filterLinha === 'bentes_ramos_antigo'
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">B&R</span>
                <span className="text-[10px] font-semibold opacity-60">{countBentesRamos}</span>
              </button>
              <button
                onClick={() => onFilterLinhaChange('trafego_isa')}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-medium transition-all duration-200",
                  filterLinha === 'trafego_isa'
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Megaphone className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Tráfego</span>
                <span className="text-[10px] font-semibold opacity-60">{countTrafego}</span>
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search */}
            <div className="relative w-full max-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm rounded-xl bg-muted/40 border-transparent focus:border-primary/30 focus:bg-card transition-all"
              />
              {search && (
                <button 
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="hidden lg:flex items-center gap-2">
              <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
                <SelectTrigger className={cn(
                  "w-[120px] h-9 text-xs rounded-xl border-transparent bg-muted/40 transition-all",
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
                  "w-[130px] h-9 text-xs rounded-xl border-transparent bg-muted/40 transition-all",
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
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Limpar filtros</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={exportToCSV}
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar CSV</TooltipContent>
              </Tooltip>

              <Button
                onClick={() => setIsNewLeadModalOpen(true)}
                size="sm"
                className="h-9 px-4 gap-2 rounded-xl font-medium shadow-soft"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Lead</span>
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
