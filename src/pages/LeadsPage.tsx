import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadModal } from '@/components/LeadModal';
import { LeadSidePanel } from '@/components/kanban/LeadSidePanel';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { RecentActivities } from '@/components/crm/RecentActivities';
import { DashboardTarefas } from '@/components/crm/DashboardTarefas';
import { FollowupStatusPanel } from '@/components/crm/FollowupStatusPanel';
import { AguardandoDocumentosPanel } from '@/components/crm/AguardandoDocumentosPanel';
import { useLeads } from '@/hooks/useLeads';

import { usePerfil } from '@/hooks/usePerfil';
import { Lead } from '@/types/leads';
import { Loader2, ChevronDown, ChevronUp, Activity, RefreshCw, Wifi } from 'lucide-react';
import { TarefaModal } from '@/components/tarefas/TarefaModal';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AnimatedCounter } from '@/components/ui/animated-counter';

export default function LeadsPage() {
  const { leads, loading, fetchLeads } = useLeads();
  
  const { canDelete } = usePerfil();
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [showMobilePanels, setShowMobilePanels] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track realtime connection and recent updates
  useEffect(() => {
    const channel = supabase
      .channel('leads-page-realtime-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        () => {
          setLastUpdate(new Date());
          setRealtimeStatus('connected');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('disconnected');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeads();
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleFilterChange = useCallback((leads: Lead[]) => {
    setFilteredLeads(leads);
  }, []);

  // Click on card opens side panel for quick view
  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsSidePanelOpen(true);
  };

  // Open full modal for editing
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
            {/* Filters + Real-time Status */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex-1">
                <LeadFilters leads={leads} onFilterChange={handleFilterChange} />
              </div>
              
              {/* Real-time Status Bar */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "flex items-center gap-1.5 text-xs h-7",
                    realtimeStatus === 'connected' && "bg-success/10 text-success border-success/30",
                    realtimeStatus === 'connecting' && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                    realtimeStatus === 'disconnected' && "bg-destructive/10 text-destructive border-destructive/30"
                  )}
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    realtimeStatus === 'connected' && "bg-success animate-pulse",
                    realtimeStatus === 'connecting' && "bg-amber-500 animate-pulse",
                    realtimeStatus === 'disconnected' && "bg-destructive"
                  )} />
                  <Wifi className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {realtimeStatus === 'connected' ? 'Ao vivo' : realtimeStatus === 'connecting' ? 'Conectando...' : 'Offline'}
                  </span>
                </Badge>

                <Badge variant="outline" className="flex items-center gap-1.5 text-xs h-7">
                  <Activity className="w-3 h-3 text-primary" />
                  <AnimatedCounter value={leads.length} duration={500} />
                  <span className="hidden sm:inline">leads</span>
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-7 px-2"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                </Button>
              </div>
            </div>
            
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
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-300",
                // Mobile: collapsible
                "lg:max-h-none lg:opacity-100",
                showMobilePanels ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 lg:max-h-none lg:opacity-100 overflow-hidden lg:overflow-visible"
              )}>
                <FollowupStatusPanel />
                <AguardandoDocumentosPanel />
                <RecentActivities leads={leads} />
                <DashboardTarefas onNewTask={handleNewTask} />
              </div>
            </div>
          </>
        )}
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
