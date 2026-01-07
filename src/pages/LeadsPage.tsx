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
            
            {/* Mobile Panels Toggle */}
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
              
              {/* Mobile Panels */}
              <div className={cn(
                "grid gap-3 overflow-hidden transition-all duration-300",
                showMobilePanels ? "mt-3 max-h-[600px] opacity-100" : "max-h-0 opacity-0"
              )}>
                <FollowupStatusPanel />
                <RecentActivities leads={leads} />
                <QuickTasks 
                  compromissos={compromissos} 
                  onNewTask={handleNewTask}
                />
              </div>
            </div>
            
            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-0">
              {/* Kanban Area */}
              <div className="min-h-0 h-full overflow-hidden">
                <KanbanBoard leads={filteredLeads} onLeadClick={handleLeadClick} />
              </div>
              
              {/* Sidebar - Intelligence Panels (Desktop Only) */}
              <div className="hidden lg:flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-200px)]">
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
