import { useState } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { KanbanColumn } from './KanbanColumn';
import { useLeads } from '@/hooks/useLeads';

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
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (status: LeadStatus) => {
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    
    if (draggedLead && draggedLead.status !== status) {
      await updateLeadStatus(draggedLead.id, status);
    }
    
    setDraggedLead(null);
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div 
        className="flex gap-4 min-w-max"
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
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragOver={dragOverStatus === status}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
