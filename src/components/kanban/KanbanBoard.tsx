import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { KanbanColumn } from './KanbanColumn';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { useIsaInsights } from '@/hooks/useIsaInsights';
import { useLeadExtras } from '@/hooks/useLeadExtras';
import { useLeadFollowups } from '@/hooks/useLeadFollowups';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

const STATUSES: LeadStatus[] = [
  'Lead Frio',
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
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const { insights: isaInsights } = useIsaInsights(leadIds);
  const { extras: leadExtras } = useLeadExtras(leadIds);
  const { followups: leadFollowups } = useLeadFollowups(leadIds);

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 10);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollButtons();
    container.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      container.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons]);

  const scrollTo = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const columnWidth = 280;
    container.scrollBy({
      left: direction === 'left' ? -columnWidth : columnWidth,
      behavior: 'smooth'
    });
  }, []);

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
      }
    }
    
    setDraggedLead(null);
  }, [draggedLead, updateLeadStatus, toast]);

  return (
    <div className="relative w-full h-full">
      {/* Nav Arrows */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
          <div className="bg-gradient-to-r from-background to-transparent h-full w-16 flex items-center pl-1">
            <Button
              variant="outline"
              size="icon"
              className="pointer-events-auto h-9 w-9 rounded-full shadow-md bg-card/95 backdrop-blur"
              onClick={() => scrollTo('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
          <div className="bg-gradient-to-l from-background to-transparent h-full w-16 flex items-center justify-end pr-1">
            <Button
              variant="outline"
              size="icon"
              className="pointer-events-auto h-9 w-9 rounded-full shadow-md bg-card/95 backdrop-blur"
              onClick={() => scrollTo('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable Container */}
      <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-x-auto overflow-y-hidden pb-2 scroll-smooth"
      >
        <div 
          className="inline-flex gap-3 px-1 min-w-max h-full"
          onDragLeave={handleDragLeave}
        >
          {STATUSES.map((status) => (
            <div 
              key={status}
              onDragEnter={() => handleDragEnter(status)}
              className="h-full"
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
                leadFollowups={leadFollowups}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
