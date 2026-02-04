import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { KanbanHeader } from '@/components/kanban/KanbanHeader';
import { LeadModal } from '@/components/LeadModal';
import { LeadSidePanel } from '@/components/kanban/LeadSidePanel';
import { useLeads } from '@/hooks/useLeads';
import { usePerfil } from '@/hooks/usePerfil';
import { Lead } from '@/types/leads';
import { Loader2, LayoutGrid, ChevronDown } from 'lucide-react';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { AguardandoDocumentosPanel } from '@/components/crm/AguardandoDocumentosPanel';
import { RecentActivities } from '@/components/crm/RecentActivities';
import { DashboardTarefas } from '@/components/crm/DashboardTarefas';

export default function LeadsPage() {
  const { leads, loading, fetchLeads } = useLeads();
  const { canDelete } = usePerfil();
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [showPanels, setShowPanels] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track realtime connection
  useEffect(() => {
    const channel = supabase
      .channel('leads-page-realtime-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        () => setRealtimeStatus('connected')
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('disconnected');
        else setRealtimeStatus('connecting');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeads();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleFilterChange = useCallback((leads: Lead[]) => {
    setFilteredLeads(leads);
  }, []);

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsSidePanelOpen(true);
  };

  const handleOpenFullModal = () => {
    setIsSidePanelOpen(false);
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

  const handleCloseSidePanel = () => {
    setIsSidePanelOpen(false);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Premium Header with Search/Filters */}
        <KanbanHeader
          leads={leads}
          onFilterChange={handleFilterChange}
          onNewLead={handleNewLead}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          realtimeStatus={realtimeStatus}
        />
        
        {/* Main Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando leads...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Kanban Board */}
              <div className="p-4 lg:p-6">
                <KanbanBoard leads={filteredLeads} onLeadClick={handleLeadClick} />
              </div>
              
              {/* Collapsible Intelligence Panels */}
              <Collapsible open={showPanels} onOpenChange={setShowPanels}>
                <div className="border-t border-border/50 bg-muted/30">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      <span>Painéis de Inteligência</span>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        showPanels && "rotate-180"
                      )} />
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-4 lg:px-6 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <AguardandoDocumentosPanel />
                      <RecentActivities leads={leads} />
                      <DashboardTarefas onNewTask={() => setIsTaskModalOpen(true)} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </>
          )}
        </div>
      </div>

      {/* Side Panel for Quick View */}
      <LeadSidePanel
        lead={selectedLead}
        isOpen={isSidePanelOpen}
        onClose={handleCloseSidePanel}
        onOpenFullModal={handleOpenFullModal}
      />

      {/* Full Modal for Editing */}
      <LeadModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isNew={isNewLead}
        canDelete={canDelete}
      />

      <TarefaModal 
        open={isTaskModalOpen} 
        onOpenChange={setIsTaskModalOpen} 
      />
    </AppLayout>
  );
}
