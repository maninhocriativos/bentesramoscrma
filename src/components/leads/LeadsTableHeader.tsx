import { Search, Download, Plus, Building2, Megaphone, X, LayoutGrid, List, DollarSign, FileBarChart, FileSpreadsheet, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { ExportTrafegoModal } from './ExportTrafegoModal';
import { GerarRelatorioLeadsModal } from './GerarRelatorioLeadsModal';
import { supabase } from '@/integrations/supabase/client';
import { Lead, LeadStatus } from '@/types/leads';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NotificacoesBell } from '@/components/NotificacoesBell';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useNavigate } from 'react-router-dom';

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
  filteredLeads?: Lead[];
}

const formatCurrencyCompact = (value: number): string => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

const VIEW_TABS: { v: 'board' | 'list' | 'cards'; l: string; icon: typeof LayoutGrid }[] = [
  { v: 'board', l: 'Visual Board', icon: LayoutGrid },
  { v: 'list', l: 'Lista', icon: List },
  { v: 'cards', l: 'Cards', icon: LayoutGrid },
];

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
  filteredLeads = [],
}: LeadsTableHeaderProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { cargo, fullName } = usePerfil();
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isExportTrafegoOpen, setIsExportTrafegoOpen] = useState(false);
  const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);

  const handleSignOut = async () => { await signOut(); navigate('/auth'); };

  const exportToCSV = async () => {
    try {
      // Paginado — leads_juridicos já passa de 3 mil linhas, e um select sem
      // .range() é cortado silenciosamente no teto padrão de 1000 linhas do
      // PostgREST: a exportação perdia os leads mais antigos sem nenhum aviso.
      const PAGE = 1000;
      const leads: any[] = [];
      for (let page = 0; ; page++) {
        const { data, error } = await supabase
          .from('leads_juridicos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) throw error;
        leads.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

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

      const BOM = '﻿';
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
        <div className="bg-white border-b border-[#efebe4] px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl text-[#29201e] truncate" style={{ fontFamily: 'Lora, serif', fontWeight: 700 }}>Pipeline de Leads</h1>
            <p className="hidden sm:block text-sm text-[#6e5e5a] mt-1">Gerenciamento e conversão de novos clientes para o escritório</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#f5efe6] text-[#29201e]">
              {totalLeads} leads
              {totalValue > 0 && (
                <span className="text-[#15803d] flex items-center gap-0.5"><DollarSign className="h-3 w-3" />{formatCurrencyCompact(totalValue)}</span>
              )}
            </div>
            <NotificacoesBell />
            {user && (
              <>
                <span className="hidden xl:inline text-sm text-[#6e5e5a]">{fullName || user.email}</span>
                <span className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f5efe6] text-[#6e5e5a]">{cargo}</span>
                <button onClick={handleSignOut} title="Sair" className="h-9 w-9 rounded-full border border-[#efebe4] flex items-center justify-center text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border-b border-[#efebe4] px-4 sm:px-8 py-3 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* View mode toggle */}
            <div className="flex items-center bg-[#f5efe6] rounded-xl p-1 border border-[#efebe4]">
              {VIEW_TABS.map(tab => (
                <button
                  key={tab.v}
                  onClick={() => onViewModeChange?.(tab.v)}
                  className={cn('flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors',
                    viewMode === tab.v ? 'bg-white text-[#29201e] shadow-sm' : 'text-[#6e5e5a] hover:text-[#29201e]')}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.l}</span>
                </button>
              ))}
            </div>

            {/* Linha WhatsApp */}
            <div className="hidden md:flex items-center bg-[#f5efe6] rounded-xl p-1 border border-[#efebe4]">
              <button onClick={() => onFilterLinhaChange('all')}
                className={cn('h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors', filterLinha === 'all' ? 'bg-white text-[#29201e] shadow-sm' : 'text-[#6e5e5a] hover:text-[#29201e]')}>
                Todos
              </button>
              <button onClick={() => onFilterLinhaChange('bentes_ramos_antigo')}
                className={cn('flex items-center gap-1 h-8 px-2.5 rounded-lg text-[13px] font-semibold transition-colors', filterLinha === 'bentes_ramos_antigo' ? 'bg-white text-[#29201e] shadow-sm' : 'text-[#6e5e5a] hover:text-[#29201e]')}>
                <Building2 className="h-3 w-3" /><span className="hidden lg:inline">B&R</span> <span className="text-[11px] opacity-60">{countBentesRamos}</span>
              </button>
              <button onClick={() => onFilterLinhaChange('trafego_isa')}
                className={cn('flex items-center gap-1 h-8 px-2.5 rounded-lg text-[13px] font-semibold transition-colors', filterLinha === 'trafego_isa' ? 'bg-white text-[#29201e] shadow-sm' : 'text-[#6e5e5a] hover:text-[#29201e]')}>
                <Megaphone className="h-3 w-3" /><span className="hidden lg:inline">Tráfego</span> <span className="text-[11px] opacity-60">{countTrafego}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative w-full max-w-[220px] min-w-[150px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6e5e5a]" />
              <Input
                placeholder="Buscar leads..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9 text-[13px] rounded-xl border-[#efebe4] bg-white"
              />
              {search && (
                <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e5e5a] hover:text-[#29201e]">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="hidden xl:flex items-center gap-1.5">
              <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
                <SelectTrigger className={cn('w-[110px] h-9 text-[12px] rounded-xl border-[#efebe4]', filterOrigem !== 'all' && 'border-[#c5a47e] bg-[#f5efe6]')}>
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {origens.map(origem => <SelectItem key={origem} value={origem}>{origem}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterEtapa} onValueChange={onFilterEtapaChange}>
                <SelectTrigger className={cn('w-[120px] h-9 text-[12px] rounded-xl border-[#efebe4]', filterEtapa !== 'all' && 'border-[#c5a47e] bg-[#f5efe6]')}>
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas etapas</SelectItem>
                  {etapas.map(etapa => <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>)}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => { onFilterOrigemChange('all'); onFilterEtapaChange('all'); }} className="h-9 w-9 rounded-xl flex items-center justify-center text-[#6e5e5a] hover:text-[#dc2626] hover:bg-[#f5efe6] transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Limpar filtros</TooltipContent>
                </Tooltip>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => setIsExportTrafegoOpen(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#efebe4] text-[13px] font-medium text-[#29201e] hover:bg-[#f5efe6] transition-colors">
                  <FileBarChart className="h-3.5 w-3.5" /> <span className="hidden md:inline">Exportar Tráfego</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Exportar Leads de Tráfego</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={exportToCSV} className="h-9 w-9 rounded-xl border border-[#efebe4] flex items-center justify-center text-[#6e5e5a] hover:bg-[#f5efe6] transition-colors">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Exportar CSV</TooltipContent>
            </Tooltip>

            <button onClick={() => setIsRelatorioOpen(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#3e2f2b] hover:bg-[#2d211d] text-white text-[13px] font-semibold transition-colors">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Relatórios
            </button>

            <button onClick={() => setIsNewLeadModalOpen(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#c5a47e] hover:bg-[#b8935f] text-white text-[13px] font-semibold transition-colors">
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Novo</span>
            </button>
          </div>
        </div>
      </TooltipProvider>

      <LeadModal
        lead={null}
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        isNew={true}
        canDelete={false}
      />

      <ExportTrafegoModal
        open={isExportTrafegoOpen}
        onOpenChange={setIsExportTrafegoOpen}
      />

      <GerarRelatorioLeadsModal
        open={isRelatorioOpen}
        onOpenChange={setIsRelatorioOpen}
        leads={filteredLeads}
      />
    </>
  );
}
