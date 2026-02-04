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

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
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

export function KanbanBoard({ leads, onLeadClick }: KanbanBoardProps) {
  const { updateLeadStatus } = useLeads();
  const { toast } = useToast();
  const { sendConversionEvent } = useMetaCapi();
  const isMobile = useIsMobile();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

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

  // Mobile: Show tabs instead of columns
  if (isMobile) {
    return (
      <KanbanMobileTabs
        leads={leads}
        onLeadClick={onLeadClick}
        isaInsights={isaInsights}
        leadExtras={leadExtras}
      />
    );
  }

  return (
    <div 
      className="kanban-grid-container"
      onDragLeave={handleDragLeave}
    >
      {STATUSES.map((status) => (
        <div 
          key={status}
          onDragEnter={() => handleDragEnter(status)}
          className="kanban-column-wrapper"
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
  );
}
