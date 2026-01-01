import { useState, useCallback, useMemo } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { KanbanColumn } from './KanbanColumn';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { useIsaInsights } from '@/hooks/useIsaInsights';

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

const STATUSES: LeadStatus[] = [
  'Lead Frio',
  'Em Atendimento',
  'Aguardando Contrato',
  'Contrato Assinado',
  'Ganho',
  'Perdido',
];

export function KanbanBoard({ leads, onLeadClick }: KanbanBoardProps) {
  const { updateLeadStatus } = useLeads();
  const { toast } = useToast();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  // Buscar insights da Isa para todos os leads
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const { insights: isaInsights } = useIsaInsights(leadIds);

  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
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
          title: 'Lead movido!',
          description: `${draggedLead.nome || 'Lead'} movido para ${status}`,
        });
      }
    }
    
    setDraggedLead(null);
  }, [draggedLead, updateLeadStatus, toast]);

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden pb-2">
      <div 
        className="inline-flex gap-3 pb-2 pr-2 min-w-max"
        onDragLeave={handleDragLeave}
      >
        {STATUSES.map((status) => (
          <div 
            key={status}
            onDragEnter={() => handleDragEnter(status)}
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
            />
          </div>
        ))}
      </div>
    </div>
  );
}
