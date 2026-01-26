import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { LeadModal } from '@/components/LeadModal';
import { LeadSidePanel } from '@/components/kanban/LeadSidePanel';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { useLeads } from '@/hooks/useLeads';
import { usePerfil } from '@/hooks/usePerfil';
import { Lead } from '@/types/leads';
import { 
  Loader2, RefreshCw, Wifi, Plus, Users, 
  ChevronDown, LayoutGrid
} from 'lucide-react';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Lazy import panels for cleaner code
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

  // Stats
  const activeLeads = leads.filter(l => !['Perdido', 'Ganho'].includes(l.status || '')).length;
  const wonLeads = leads.filter(l => l.status === 'Ganho').length;

  return (
    <AppLayout>
      {/* Clean Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          {/* Title + Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Pipeline de Leads</h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activeLeads} ativos</span>
                  <span>•</span>
                  <span className="text-success">{wonLeads} ganhos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Status Indicator - Minimal */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
              realtimeStatus === 'connected' && "bg-success/10 text-success",
              realtimeStatus === 'connecting' && "bg-amber-500/10 text-amber-600",
              realtimeStatus === 'disconnected' && "bg-destructive/10 text-destructive"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                realtimeStatus === 'connected' && "bg-success",
                realtimeStatus === 'connecting' && "bg-amber-500 animate-pulse",
                realtimeStatus === 'disconnected' && "bg-destructive"
              )} />
              <Wifi className="w-3 h-3" />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>

            <Button onClick={handleNewLead} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Lead</span>
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-4 md:px-6 pb-3">
          <LeadFilters leads={leads} onFilterChange={handleFilterChange} />
        </div>
      </header>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando leads...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Kanban Area */}
            <div className="flex-1 min-h-0 px-4 md:px-6 py-4">
              <KanbanBoard leads={filteredLeads} onLeadClick={handleLeadClick} />
            </div>
            
            {/* Collapsible Intelligence Panels */}
            <Collapsible open={showPanels} onOpenChange={setShowPanels}>
              <div className="border-t border-border/50 bg-muted/30">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Painéis de Inteligência</span>
                    <ChevronDown className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      showPanels && "rotate-180"
                    )} />
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-4 md:px-6 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
