import { useState, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { LeadsTableGroup } from './LeadsTableGroup';
import { LeadsTableHeader } from './LeadsTableHeader';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { useLeads } from '@/hooks/useLeads';
import { Loader2 } from 'lucide-react';

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

export function LeadsTableView() {
  const { leads, loading, updateLeadStatus } = useLeads();
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [filterResponsavel, setFilterResponsavel] = useState('all');
  const [filterEtapa, setFilterEtapa] = useState('all');
  const [filterPrioridade, setFilterPrioridade] = useState('all');
  const [filterLinha, setFilterLinha] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Filter by linha_whatsapp
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
  }, [leads, search, filterOrigem, filterEtapa, filterLinha]);

  // Group leads by status
  const groupedLeads = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    PIPELINE_STAGES.forEach(stage => {
      groups[stage.status] = [];
    });

    filteredLeads.forEach(lead => {
      const status = lead.status || 'Lead Frio';
      if (groups[status]) {
        groups[status].push(lead);
      }
    });

    return groups;
  }, [filteredLeads]);

  // Get unique origins for filter
  const origens = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(lead => {
      if (lead.origem) set.add(lead.origem);
    });
    return Array.from(set).sort();
  }, [leads]);

  const toggleGroup = (status: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <LeadsTableHeader
        totalLeads={filteredLeads.length}
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
      />

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-6">
        <div className="space-y-3">
          {PIPELINE_STAGES.map(stage => (
            <LeadsTableGroup
              key={stage.status}
              status={stage.status}
              label={stage.label}
              leads={groupedLeads[stage.status] || []}
              isCollapsed={collapsedGroups.has(stage.status)}
              onToggle={() => toggleGroup(stage.status)}
              onLeadClick={handleLeadClick}
              onMoveStage={handleMoveStage}
              allStages={PIPELINE_STAGES}
            />
          ))}
        </div>
      </div>

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}