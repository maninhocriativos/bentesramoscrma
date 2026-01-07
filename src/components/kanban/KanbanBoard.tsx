import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Lead, LeadStatus } from '@/types/leads';
import { KanbanColumn } from './KanbanColumn';
import { useLeads } from '@/hooks/useLeads';
import { useToast } from '@/hooks/use-toast';
import { useIsaInsights } from '@/hooks/useIsaInsights';
import { useLeadExtras } from '@/hooks/useLeadExtras';
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
  
  // Scroll navigation state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Buscar insights da Isa e extras para todos os leads
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const { insights: isaInsights } = useIsaInsights(leadIds);
  const { extras: leadExtras } = useLeadExtras(leadIds);

  // Check scroll position
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

  // Smooth scroll navigation
  const scrollTo = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const columnWidth = 280; // Approximate column width + gap
    const scrollAmount = direction === 'left' ? -columnWidth : columnWidth;
    
    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }, []);

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
    <div className="relative w-full h-full">
      {/* Left Navigation Arrow */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-2 z-10 flex items-center",
          "pointer-events-none transition-opacity duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="bg-gradient-to-r from-background via-background/80 to-transparent h-full w-12 flex items-center">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "pointer-events-auto h-10 w-10 rounded-full shadow-lg",
              "bg-card/95 backdrop-blur border-border/50",
              "hover:bg-primary hover:text-primary-foreground hover:border-primary",
              "transition-all duration-200"
            )}
            onClick={() => scrollTo('left')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Right Navigation Arrow */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-2 z-10 flex items-center",
          "pointer-events-none transition-opacity duration-200",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="bg-gradient-to-l from-background via-background/80 to-transparent h-full w-12 flex items-center justify-end">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "pointer-events-auto h-10 w-10 rounded-full shadow-lg",
              "bg-card/95 backdrop-blur border-border/50",
              "hover:bg-primary hover:text-primary-foreground hover:border-primary",
              "transition-all duration-200"
            )}
            onClick={() => scrollTo('right')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div 
        ref={scrollContainerRef}
        className="w-full h-full overflow-x-auto overflow-y-hidden pb-2 scroll-smooth scrollbar-stable"
      >
        <div 
          className="inline-flex gap-3 pb-2 px-1 min-w-max"
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
                leadExtras={leadExtras}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
