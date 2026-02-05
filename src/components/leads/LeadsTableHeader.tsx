import { Search, Download, Plus, Building2, Megaphone } from 'lucide-react';
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
        toast({
          title: 'Nenhum lead para exportar',
          variant: 'destructive',
        });
        return;
      }

      const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Tipo de Ação', 'Valor da Causa', 'Linha WhatsApp', 'Empresa', 'Data de Criação'];
      const rows = leads.map(lead => [
        lead.nome || '',
        lead.email || '',
        lead.telefone || '',
        lead.status || '',
        lead.origem || '',
        lead.tipo_acao || '',
        lead.valor_causa || '',
        lead.linha_whatsapp || '',
        lead.empresa_tag || '',
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

      toast({
        title: 'Exportação concluída!',
        description: `${leads.length} leads exportados.`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Erro ao exportar',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-background border-b">
        <div className="h-[72px] px-4 lg:px-6 flex items-center gap-4">
          {/* Title & Count */}
          <div className="flex items-baseline gap-3 min-w-fit">
            <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
            <span className="text-sm text-muted-foreground">{totalLeads} leads</span>
          </div>

          {/* Quick Filters - Linha WhatsApp */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant={filterLinha === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onFilterLinhaChange('all')}
              className="h-8 gap-1.5"
            >
              Todos
            </Button>
            <Button
              variant={filterLinha === 'bentes_ramos_antigo' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterLinhaChange('bentes_ramos_antigo')}
              className={cn(
                "h-8 gap-1.5",
                filterLinha === 'bentes_ramos_antigo' && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Bentes & Ramos
              <Badge variant="outline" className="ml-1 h-5 px-1.5 bg-blue-100 text-blue-800 border-0">
                {countBentesRamos}
              </Badge>
            </Button>
            <Button
              variant={filterLinha === 'trafego_isa' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onFilterLinhaChange('trafego_isa')}
              className={cn(
                "h-8 gap-1.5",
                filterLinha === 'trafego_isa' && "bg-orange-600 hover:bg-orange-700"
              )}
            >
              <Megaphone className="h-3.5 w-3.5" />
              Tráfego (ISA)
              <Badge variant="outline" className="ml-1 h-5 px-1.5 bg-orange-100 text-orange-800 border-0">
                {countTrafego}
              </Badge>
            </Button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, WhatsApp ou e-mail"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10 rounded-lg bg-muted/50"
            />
          </div>

          {/* Filters - Desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
              <SelectTrigger className="w-[130px] h-10 rounded-lg bg-muted/50 border-0">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Origens</SelectItem>
                {origens.map(origem => (
                  <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterEtapa} onValueChange={onFilterEtapaChange}>
              <SelectTrigger className="w-[150px] h-10 rounded-lg bg-muted/50 border-0">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Etapas</SelectItem>
                {etapas.map(etapa => (
                  <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsNewLeadModalOpen(true)}
              className="h-10 gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Lead</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={exportToCSV}
              className="h-10 w-10 rounded-lg"
              title="Exportar CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

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