import { useState, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { LeadsTableHeader } from './LeadsTableHeader';
import { LeadCardGrid } from './LeadCardGrid';
import { LeadsDataTable } from './LeadsDataTable';
import { PipelineStagePills } from './PipelineStagePills';
import { LeadDetailModal } from './LeadDetailModal';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useLeads } from '@/hooks/useLeads';
import { useLeadsProcessoCounts } from '@/hooks/useLeadProcessos';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LEADS_PER_PAGE = 30;

const PIPELINE_STAGES: { status: LeadStatus; label: string }[] = [
  { status: 'Lead Frio', label: 'Lead Frio' },
  { status: 'Bentes Ramos', label: 'Bentes Ramos' },
  { status: 'Em Atendimento', label: 'Em Atendimento' },
  { status: 'Em Negociação', label: 'Em Negociação' },
  { status: 'Aguardando Contrato', label: 'Aguardando' },
  { status: 'Contrato Assinado', label: 'Contrato Assinado' },
  { status: 'Ganho', label: 'Ganho' },
  { status: 'Perdido', label: 'Perdido' },
];

type ViewMode = 'cards' | 'list' | 'board';

export function LeadsTableView() {
  const { leads, loading, updateLeadStatus } = useLeads();
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [filterResponsavel, setFilterResponsavel] = useState('all');
  const [filterEtapa, setFilterEtapa] = useState('all');
  const [filterPrioridade, setFilterPrioridade] = useState('all');
  const [filterLinha, setFilterLinha] = useState('all');
  const [activeStage, setActiveStage] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [currentPage, setCurrentPage] = useState(1);

  const { countBentesRamos, countTrafego } = useMemo(() => {
    let bentes = 0, trafego = 0;
    leads.forEach(lead => {
      if (lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS') bentes++;
      else if (lead.linha_whatsapp === 'trafego_isa' || lead.tipo_origem === 'trafego') trafego++;
    });
    return { countBentesRamos: bentes, countTrafego: trafego };
  }, [leads]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach(stage => { counts[stage.status] = 0; });
    let baseLeads = [...leads];
    if (filterLinha !== 'all') {
      baseLeads = baseLeads.filter(lead => {
        if (filterLinha === 'bentes_ramos_antigo') return lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS' || lead.tipo_origem === 'whatsapp_direto';
        if (filterLinha === 'trafego_isa') return lead.linha_whatsapp === 'trafego_isa' || lead.tipo_origem === 'trafego';
        return true;
      });
    }
    baseLeads.forEach(lead => {
      const status = lead.status || 'Lead Frio';
      if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
  }, [leads, filterLinha]);

  const stagesWithCounts = useMemo(() =>
    PIPELINE_STAGES.map(stage => ({ ...stage, count: stageCounts[stage.status] || 0 })),
  [stageCounts]);

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (filterLinha !== 'all') {
      result = result.filter(lead => {
        if (filterLinha === 'bentes_ramos_antigo') return lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS' || lead.tipo_origem === 'whatsapp_direto';
        if (filterLinha === 'trafego_isa') return lead.linha_whatsapp === 'trafego_isa' || lead.tipo_origem === 'trafego';
        return true;
      });
    }
    if (activeStage !== 'all') result = result.filter(lead => lead.status === activeStage);
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(lead =>
        (lead.nome?.toLowerCase() || '').includes(s) ||
        (lead.email?.toLowerCase() || '').includes(s) ||
        (lead.telefone || '').includes(search)
      );
    }
    if (filterOrigem !== 'all') result = result.filter(lead => lead.origem === filterOrigem);
    if (filterEtapa !== 'all') result = result.filter(lead => lead.status === filterEtapa);
    return result;
  }, [leads, search, filterOrigem, filterEtapa, filterLinha, activeStage]);

  // Reset page when filters change
  const resetPage = () => setCurrentPage(1);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLeads = viewMode === 'board'
    ? filteredLeads // Board shows all (kanban needs all leads)
    : filteredLeads.slice((safePage - 1) * LEADS_PER_PAGE, safePage * LEADS_PER_PAGE);

  const origens = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(lead => { if (lead.origem) set.add(lead.origem); });
    return Array.from(set).sort();
  }, [leads]);

  const totalValue = useMemo(() => filteredLeads.reduce((sum, l) => sum + (l.valor_causa || 0), 0), [filteredLeads]);

  // Batch fetch processo counts for cards
  const leadIds = useMemo(() => paginatedLeads.map(l => l.id), [paginatedLeads]);
  const { data: processoCounts } = useLeadsProcessoCounts(leadIds);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setModalOpen(true);
  };

  const handleMoveStage = async (leadId: string, newStatus: LeadStatus) => {
    await updateLeadStatus(leadId, newStatus);
  };

  // Map viewMode for header (cards and list both show in header as list/board)
  const headerViewMode = viewMode === 'board' ? 'board' : viewMode === 'list' ? 'list' : 'cards';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Carregando pipeline</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sincronizando dados em tempo real...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <LeadsTableHeader
        totalLeads={filteredLeads.length}
        totalValue={totalValue}
        search={search}
        onSearchChange={setSearch}
        filterOrigem={filterOrigem}
        onFilterOrigemChange={setFilterOrigem}
        filterResponsavel={filterResponsavel}
        onFilterResponsavelChange={setFilterResponsavel}
        filterEtapa={filterEtapa}
        onFilterEtapaChange={setFilterEtapa}
        filterPrioridade={filterPrioridade}
        onFilterPrioridadeChange={setFilterPrioridade}
        filterLinha={filterLinha}
        onFilterLinhaChange={setFilterLinha}
        origens={origens}
        etapas={PIPELINE_STAGES.map(s => s.status)}
        countBentesRamos={countBentesRamos}
        countTrafego={countTrafego}
        viewMode={headerViewMode as any}
        onViewModeChange={(mode) => setViewMode(mode as ViewMode)}
      />

      <div className="px-4 lg:px-6 py-2.5 border-b bg-card">
        <PipelineStagePills stages={stagesWithCounts} activeStage={activeStage} onStageChange={setActiveStage} />
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <div className="flex-1 overflow-auto px-4 lg:px-6 py-4">
          <LeadCardGrid
            leads={filteredLeads}
            onLeadClick={handleLeadClick}
            onMoveStage={handleMoveStage}
            allStages={PIPELINE_STAGES}
            processoCounts={processoCounts || {}}
          />
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex-1 overflow-hidden px-4 lg:px-6 py-4">
          <LeadsDataTable leads={filteredLeads} onLeadClick={handleLeadClick} onMoveStage={handleMoveStage} allStages={PIPELINE_STAGES} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 lg:px-6 py-4">
          <KanbanBoard leads={filteredLeads} onLeadClick={handleLeadClick} />
        </div>
      )}

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onLeadUpdated={(updated) => setSelectedLead(updated)}
      />
    </div>
  );
}
