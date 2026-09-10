import { useState, useCallback, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { KanbanColumn } from './KanbanColumn';
import { KanbanMobileTabs } from './KanbanMobileTabs';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { useIsaInsights } from '@/hooks/useIsaInsights';
import { useLeadExtras } from '@/hooks/useLeadExtras';
import { useMetaCapi } from '@/hooks/useMetaCapi';
import { useIsMobile } from '@/hooks/use-mobile';
import { LeadPerdidoDialog } from '@/components/leads/LeadPerdidoDialog';

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  // Quando uma pílula de etapa específica está ativa, `leads` já vem só com
  // aquela etapa — sem isso, o board continuava renderizando as 8 colunas
  // (7 delas sempre vazias) e a única coluna com dado real ficava fora da
  // tela, parecendo que "sumiu" o filtro.
  activeStage?: string;
}

export const STATUSES: LeadStatus[] = [
  'Lead Frio',
  'Bentes Ramos',
  'Em Atendimento',
  'Em Negociação',
  'Aguardando Contrato',
  'Contrato Assinado',
  'Ganho',
  'Perdido',
];

export function KanbanBoard({ leads, onLeadClick, activeStage }: KanbanBoardProps) {
  const { updateLeadStatus, markLeadAsLost } = useLeads();
  const { toast } = useToast();
  const { sendConversionEvent } = useMetaCapi();
  const isMobile = useIsMobile();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);
  const [pendingLostLead, setPendingLostLead] = useState<Lead | null>(null);
  const [markingLost, setMarkingLost] = useState(false);

  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const { insights: isaInsights } = useIsaInsights(leadIds);
  const { extras: leadExtras } = useLeadExtras(leadIds);

  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedLead(null);
    setDragOverStatus(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((status: LeadStatus) => {
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    if (draggedLead && draggedLead.status !== status) {
      // "Perdido" exige motivo — pede antes de mover, em vez de só trocar o
      // status sem deixar nenhum rastro na aba Histórico do lead.
      if (status === 'Perdido') {
        setPendingLostLead(draggedLead);
        setDraggedLead(null);
        return;
      }

      const result = await updateLeadStatus(draggedLead.id, status);

      if (!result.error) {
        toast({
          title: 'Lead movido',
          description: `${draggedLead.nome || 'Lead'} → ${status}`,
        });

        if (status === 'Ganho') {
          console.log('[Meta CAPI] Lead ganho - enviando evento de conversão');
          sendConversionEvent(draggedLead.id, {
            email: draggedLead.email,
            phone: draggedLead.telefone,
            facebook_lead_id: draggedLead.facebook_lead_id,
            valor_causa: draggedLead.valor_causa
          });
        }
      }
    }

    setDraggedLead(null);
  }, [draggedLead, updateLeadStatus, toast, sendConversionEvent]);

  const handleConfirmLost = useCallback(async (motivo: string) => {
    if (!pendingLostLead) return;
    setMarkingLost(true);
    const result = await markLeadAsLost(pendingLostLead.id, motivo);
    setMarkingLost(false);
    if (!result.error) {
      toast({ title: '❌ Lead marcado como Perdido', description: pendingLostLead.nome || undefined });
      setPendingLostLead(null);
    }
  }, [pendingLostLead, markLeadAsLost, toast]);

  const lostDialog = (
    <LeadPerdidoDialog
      open={!!pendingLostLead}
      leadNome={pendingLostLead?.nome || null}
      loading={markingLost}
      onConfirm={handleConfirmLost}
      onCancel={() => setPendingLostLead(null)}
    />
  );

  // Mobile: Show tabs instead of columns
  if (isMobile) {
    return (
      <>
        <KanbanMobileTabs
          leads={leads}
          onLeadClick={onLeadClick}
          isaInsights={isaInsights}
          leadExtras={leadExtras}
        />
        {lostDialog}
      </>
    );
  }

  const visibleStatuses = activeStage && activeStage !== 'all'
    ? STATUSES.filter(s => s === activeStage)
    : STATUSES;

  return (
    <>
      <div
        className="flex flex-row gap-4 w-full min-h-0 h-full overflow-x-auto pb-3 snap-x snap-mandatory scroll-pl-4"
        onDragLeave={handleDragLeave}
      >
        {visibleStatuses.map((status) => (
          <div
            key={status}
            onDragEnter={() => handleDragEnter(status)}
            className="flex flex-col h-full snap-start"
          >
            <KanbanColumn
              status={status}
              leads={leads}
              onLeadClick={onLeadClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragOver={dragOverStatus === status}
              isaInsights={isaInsights}
              leadExtras={leadExtras}
            />
          </div>
        ))}
      </div>
      {lostDialog}
    </>
  );
}
