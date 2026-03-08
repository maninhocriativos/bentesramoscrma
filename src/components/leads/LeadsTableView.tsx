import { useState, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { LeadsTableHeader } from './LeadsTableHeader';
import { LeadsDataTable } from './LeadsDataTable';
import { PipelineStagePills } from './PipelineStagePills';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { useLeads } from '@/hooks/useLeads';
import { Loader2, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pipeline stages in fixed order
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

type ViewMode = 'list' | 'board';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Count leads by linha_whatsapp
  const { countBentesRamos, countTrafego } = useMemo(() => {
    let bentes = 0;
    let trafego = 0;
    leads.forEach(lead => {
      if (lead.linha_whatsapp === 'bentes_ramos_antigo' || lead.empresa_tag === 'BENTES_RAMOS') {
        bentes++;
      } else if (lead.linha_whatsapp === 'trafego_isa' || lead.tipo_origem === 'trafego') {
        trafego++;
      }
    });
    return { countBentesRamos: bentes, countTrafego: trafego };
  }, [leads]);

  // Count leads by stage (before other filters)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach(stage => { counts[stage.status] = 0; });
    
    let baseLeads = [...leads];
    if (filterLinha !== 'all') {
      baseLeads = baseLeads.filter(lead => {
        if (filterLinha === 'bentes_ramos_antigo') {
          return lead.linha_whatsapp === 'bentes_ramos_antigo' || 
                 lead.empresa_tag === 'BENTES_RAMOS' ||
                 lead.tipo_origem === 'whatsapp_direto';
        }
        if (filterLinha === 'trafego_isa') {
          return lead.linha_whatsapp === 'trafego_isa' || 
                 lead.tipo_origem === 'trafego';
        }
        return true;
      });
    }
    
    baseLeads.forEach(lead => {
      const status = lead.status || 'Lead Frio';
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
    return counts;
  }, [leads, filterLinha]);

  const stagesWithCounts = useMemo(() => {
    return PIPELINE_STAGES.map(stage => ({
      ...stage,
      count: stageCounts[stage.status] || 0,
    }));
  }, [stageCounts]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (filterLinha !== 'all') {
      result = result.filter(lead => {
        if (filterLinha === 'bentes_ramos_antigo') {
          return lead.linha_whatsapp === 'bentes_ramos_antigo' || 
                 lead.empresa_tag === 'BENTES_RAMOS' ||
                 lead.tipo_origem === 'whatsapp_direto';
        }
        if (filterLinha === 'trafego_isa') {
          return lead.linha_whatsapp === 'trafego_isa' || 
                 lead.tipo_origem === 'trafego';
        }
        return true;
      });
    }

    if (activeStage !== 'all') {
      result = result.filter(lead => lead.status === activeStage);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(lead =>
        (lead.nome?.toLowerCase() || '').includes(searchLower) ||
        (lead.email?.toLowerCase() || '').includes(searchLower) ||
        (lead.telefone || '').includes(search)
      );
    }

    if (filterOrigem !== 'all') {
      result = result.filter(lead => lead.origem === filterOrigem);
    }

    if (filterEtapa !== 'all') {
      result = result.filter(lead => lead.status === filterEtapa);
    }

    return result;
  }, [leads, search, filterOrigem, filterEtapa, filterLinha, activeStage]);

  // Get unique origins for filter
  const origens = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(lead => {
      if (lead.origem) set.add(lead.origem);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Calculate total pipeline value
  const totalValue = useMemo(() => {
    return filteredLeads.reduce((sum, l) => sum + (l.valor_causa || 0), 0);
  }, [filteredLeads]);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const handleMoveStage = async (leadId: string, newStatus: LeadStatus) => {
    await updateLeadStatus(leadId, newStatus);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
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
      {/* Header */}
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
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Pipeline Stage Pills + View Toggle */}
      <div className="px-4 lg:px-6 py-2.5 border-b bg-card">
        <PipelineStagePills
          stages={stagesWithCounts}
          activeStage={activeStage}
          onStageChange={setActiveStage}
        />
      </div>

      {/* Content - List or Board */}
      {viewMode === 'list' ? (
        <div className="flex-1 overflow-hidden px-4 lg:px-6 py-4">
          <LeadsDataTable
            leads={filteredLeads}
            onLeadClick={handleLeadClick}
            onMoveStage={handleMoveStage}
            allStages={PIPELINE_STAGES}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 lg:px-6 py-4">
          <KanbanBoard
            leads={filteredLeads}
            onLeadClick={handleLeadClick}
          />
        </div>
      )}

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
