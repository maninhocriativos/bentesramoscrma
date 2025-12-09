import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadModal } from '@/components/LeadModal';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { RecentActivities } from '@/components/crm/RecentActivities';
import { QuickTasks } from '@/components/crm/QuickTasks';
import { useLeads } from '@/hooks/useLeads';
import { useCompromissos } from '@/hooks/useCompromissos';
import { usePerfil } from '@/hooks/usePerfil';
import { Lead } from '@/types/leads';
import { Loader2 } from 'lucide-react';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';

export default function LeadsPage() {
  const { leads, loading } = useLeads();
  const { compromissos } = useCompromissos();
  const { canDelete } = usePerfil();
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);

  const handleFilterChange = useCallback((leads: Lead[]) => {
    setFilteredLeads(leads);
  }, []);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsNewLead(false);
    setIsModalOpen(true);
  };

  const handleNewLead = () => {
    setSelectedLead(null);
    setIsNewLead(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setIsNewLead(false);
  };

  const handleNewTask = () => {
    setIsTaskModalOpen(true);
  };

  return (
    <AppLayout>
      <AppHeader 
        title="CRM de Leads" 
        onNewItem={handleNewLead}
        newItemLabel="Novo Lead"
      />
      
      <div className="flex-1 flex flex-col px-4 md:px-6 lg:px-8 py-4 animate-fade-in overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Filters */}
            <LeadFilters leads={leads} onFilterChange={handleFilterChange} />
            
            {/* Kanban Area - 60% */}
            <div className="flex-[6] min-h-0 overflow-hidden">
              <KanbanBoard leads={filteredLeads} onLeadClick={handleLeadClick} />
            </div>
            
            {/* Intelligence Panels - 40% */}
            <div className="flex-[4] min-h-[240px] mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <RecentActivities leads={leads} />
              <QuickTasks 
                compromissos={compromissos} 
                onNewTask={handleNewTask}
              />
            </div>
          </>
        )}
      </div>

      <LeadModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isNew={isNewLead}
        canDelete={canDelete}
      />

      <CompromissoModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </AppLayout>
  );
}
