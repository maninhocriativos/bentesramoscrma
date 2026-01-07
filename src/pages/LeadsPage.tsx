import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadModal } from '@/components/LeadModal';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { RecentActivities } from '@/components/crm/RecentActivities';
import { QuickTasks } from '@/components/crm/QuickTasks';
import { FollowupStatusPanel } from '@/components/crm/FollowupStatusPanel';
import { useLeads } from '@/hooks/useLeads';
import { useCompromissos } from '@/hooks/useCompromissos';
import { usePerfil } from '@/hooks/usePerfil';
import { Lead } from '@/types/leads';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { CompromissoModal } from '@/components/agenda/CompromissoModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LeadsPage() {
  const { leads, loading } = useLeads();
  const { compromissos } = useCompromissos();
  const { canDelete } = usePerfil();
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [showMobilePanels, setShowMobilePanels] = useState(false);

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
      
      <div className="flex-1 flex flex-col px-3 md:px-6 lg:px-8 py-3 md:py-4 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Filters */}
            <LeadFilters leads={leads} onFilterChange={handleFilterChange} />
            
            {/* Kanban Area - Full Width */}
            <div className="flex-1 min-h-0 overflow-hidden mb-4">
              <KanbanBoard leads={filteredLeads} onLeadClick={handleLeadClick} />
            </div>
            
            {/* Intelligence Panels - Below Kanban */}
            <div className="border-t border-border/50 pt-4">
              {/* Mobile Toggle */}
              <div className="lg:hidden mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobilePanels(!showMobilePanels)}
                  className="w-full justify-between h-9"
                >
                  <span className="text-xs font-medium">
                    Painéis de Inteligência
                  </span>
                  {showMobilePanels ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* Panels Grid */}
              <div className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300",
                // Mobile: collapsible
                "lg:max-h-none lg:opacity-100",
                showMobilePanels ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 lg:max-h-none lg:opacity-100 overflow-hidden lg:overflow-visible"
              )}>
                <FollowupStatusPanel />
                <RecentActivities leads={leads} />
                <QuickTasks 
                  compromissos={compromissos} 
                  onNewTask={handleNewTask}
                />
              </div>
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
