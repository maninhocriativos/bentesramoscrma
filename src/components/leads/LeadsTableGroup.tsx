 import { useState } from 'react';
 import { Lead, LeadStatus } from '@/types/leads';
 import { LeadsTableRow } from './LeadsTableRow';
 import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 import { LeadModal } from '@/components/LeadModal';
 
 interface LeadsTableGroupProps {
   status: LeadStatus;
   label: string;
   leads: Lead[];
   isCollapsed: boolean;
   onToggle: () => void;
   onLeadClick: (lead: Lead) => void;
   onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
   allStages: { status: LeadStatus; label: string }[];
 }
 
 const STATUS_COLORS: Record<string, { bg: string; accent: string; text: string }> = {
   'Lead Frio': { bg: 'bg-slate-50', accent: 'bg-slate-400', text: 'text-slate-700' },
   'Em Atendimento': { bg: 'bg-amber-50', accent: 'bg-amber-400', text: 'text-amber-700' },
   'Em Negociação': { bg: 'bg-blue-50', accent: 'bg-blue-400', text: 'text-blue-700' },
   'Aguardando Contrato': { bg: 'bg-purple-50', accent: 'bg-purple-400', text: 'text-purple-700' },
   'Contrato Assinado': { bg: 'bg-cyan-50', accent: 'bg-cyan-400', text: 'text-cyan-700' },
   'Ganho': { bg: 'bg-emerald-50', accent: 'bg-emerald-500', text: 'text-emerald-700' },
   'Perdido': { bg: 'bg-red-50', accent: 'bg-red-400', text: 'text-red-700' },
 };
 
 export function LeadsTableGroup({
   status,
   label,
   leads,
   isCollapsed,
   onToggle,
   onLeadClick,
   onMoveStage,
   allStages,
 }: LeadsTableGroupProps) {
   const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
   const colors = STATUS_COLORS[status] || STATUS_COLORS['Lead Frio'];
 
   return (
     <div className="rounded-xl border bg-card overflow-hidden">
       {/* Group Header */}
       <button
         onClick={onToggle}
         className={cn(
           "w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors",
           colors.bg
         )}
       >
         <div className="flex items-center gap-3">
           {/* Accent Bar */}
           <div className={cn("w-1 h-6 rounded-full", colors.accent)} />
           
           {/* Chevron */}
           {isCollapsed ? (
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
           ) : (
             <ChevronDown className="h-4 w-4 text-muted-foreground" />
           )}
           
           {/* Label & Count */}
           <span className={cn("font-medium", colors.text)}>{label}</span>
           <span className="text-sm text-muted-foreground">· {leads.length}</span>
         </div>
 
         {/* Add Lead Button */}
         <Button
           variant="ghost"
           size="sm"
           className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
           onClick={(e) => {
             e.stopPropagation();
             setIsNewLeadModalOpen(true);
           }}
         >
           <Plus className="h-3 w-3" />
           Adicionar lead
         </Button>
       </button>
 
       {/* Table */}
       {!isCollapsed && leads.length > 0 && (
         <div className="overflow-x-hidden">
           <table className="w-full text-sm">
             <thead>
               <tr className="border-b bg-muted/30">
                 <th className="sticky left-0 z-10 bg-muted/30 text-left px-4 py-2 font-medium text-muted-foreground w-[200px] min-w-[200px]">Lead</th>
                 <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[130px]">WhatsApp</th>
                 <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[100px]">Origem</th>
                 <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[110px]">Status</th>
                 <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[110px]">Último contato</th>
                 <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[120px]">Valor estimado</th>
                 <th className="sticky right-0 z-10 bg-muted/30 text-center px-3 py-2 font-medium text-muted-foreground w-[120px]">Ações</th>
               </tr>
             </thead>
             <tbody>
               {leads.map((lead) => (
                 <LeadsTableRow
                   key={lead.id}
                   lead={lead}
                   onClick={() => onLeadClick(lead)}
                   onMoveStage={onMoveStage}
                   allStages={allStages}
                 />
               ))}
             </tbody>
           </table>
         </div>
       )}
 
       {/* Empty State */}
       {!isCollapsed && leads.length === 0 && (
         <div className="px-4 py-8 text-center text-muted-foreground text-sm">
           Nenhum lead nesta etapa
         </div>
       )}
 
       {/* New Lead Modal with preset status */}
       <LeadModal
         lead={null}
         isOpen={isNewLeadModalOpen}
         onClose={() => setIsNewLeadModalOpen(false)}
         isNew={true}
         canDelete={false}
       />
     </div>
   );
 }