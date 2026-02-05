 import { Lead, LeadStatus } from '@/types/leads';
 import { formatDistanceToNow } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import { MessageCircle, Eye, MoreHorizontal, Phone, CheckCircle, XCircle } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Avatar, AvatarFallback } from '@/components/ui/avatar';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import { cn } from '@/lib/utils';
 import { useNavigate } from 'react-router-dom';
 
 interface LeadsTableRowProps {
   lead: Lead;
   onClick: () => void;
   onMoveStage: (leadId: string, newStatus: LeadStatus) => void;
   allStages: { status: LeadStatus; label: string }[];
 }
 
 const STATUS_CHIP_COLORS: Record<string, string> = {
   'Lead Frio': 'bg-slate-100 text-slate-700',
   'Em Atendimento': 'bg-amber-100 text-amber-700',
   'Em Negociação': 'bg-blue-100 text-blue-700',
   'Aguardando Contrato': 'bg-purple-100 text-purple-700',
   'Contrato Assinado': 'bg-cyan-100 text-cyan-700',
   'Ganho': 'bg-emerald-100 text-emerald-700',
   'Perdido': 'bg-red-100 text-red-700',
 };
 
 const ORIGEM_CHIP_COLORS: Record<string, string> = {
   'Instagram': 'bg-pink-100 text-pink-700',
   'Google': 'bg-blue-100 text-blue-700',
   'Site': 'bg-indigo-100 text-indigo-700',
   'Indicação': 'bg-amber-100 text-amber-700',
   'WhatsApp Z-API': 'bg-emerald-100 text-emerald-700',
   'Tráfego Pago': 'bg-violet-100 text-violet-700',
 };
 
 const formatCurrency = (value: number | null): string => {
   if (!value) return '-';
   return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
 };
 
 export function LeadsTableRow({ lead, onClick, onMoveStage, allStages }: LeadsTableRowProps) {
   const navigate = useNavigate();
 
   const handleWhatsApp = (e: React.MouseEvent) => {
     e.stopPropagation();
     navigate(`/chat?lead_id=${lead.id}`);
   };
 
   const handleCall = (e: React.MouseEvent) => {
     e.stopPropagation();
     if (lead.telefone) {
       const phone = lead.telefone.replace(/\D/g, '');
       window.location.href = `tel:+55${phone}`;
     }
   };
 
   const initials = (lead.nome || 'L')
     .split(' ')
     .map(n => n[0])
     .slice(0, 2)
     .join('')
     .toUpperCase();
 
   const statusColor = STATUS_CHIP_COLORS[lead.status || ''] || 'bg-muted text-muted-foreground';
   const origemColor = ORIGEM_CHIP_COLORS[lead.origem || ''] || 'bg-muted text-muted-foreground';
 
   const lastContact = lead.last_contact_at || lead.updated_at || lead.created_at;
 
   return (
     <tr 
       className="border-b hover:bg-muted/30 transition-colors cursor-pointer group"
       onClick={onClick}
     >
       {/* Lead - Sticky */}
       <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 px-4 py-3">
         <div className="flex items-center gap-3">
           <Avatar className="h-8 w-8">
             <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
           </Avatar>
           <span className="font-medium truncate max-w-[140px]">{lead.nome || 'Sem nome'}</span>
         </div>
       </td>
 
       {/* WhatsApp */}
       <td className="px-3 py-3">
         {lead.telefone ? (
           <button 
             onClick={handleCall}
             className="text-muted-foreground hover:text-foreground transition-colors text-left"
           >
             {lead.telefone}
           </button>
         ) : (
           <span className="text-muted-foreground">-</span>
         )}
       </td>
 
       {/* Origem */}
       <td className="px-3 py-3">
         {lead.origem ? (
           <Badge variant="secondary" className={cn("text-[10px] font-normal", origemColor)}>
             {lead.origem}
           </Badge>
         ) : (
           <span className="text-muted-foreground">-</span>
         )}
       </td>
 
       {/* Status */}
       <td className="px-3 py-3">
         <Badge variant="secondary" className={cn("text-[10px] font-normal", statusColor)}>
           {lead.status || 'Lead Frio'}
         </Badge>
       </td>
 
       {/* Último contato */}
       <td className="px-3 py-3 text-muted-foreground">
         {formatDistanceToNow(new Date(lastContact), { addSuffix: true, locale: ptBR })}
       </td>
 
       {/* Valor estimado */}
       <td className="px-3 py-3">
         <span className={cn(lead.valor_causa ? 'text-emerald-600 font-medium' : 'text-muted-foreground')}>
           {formatCurrency(lead.valor_causa)}
         </span>
       </td>
 
       {/* Ações - Sticky */}
       <td className="sticky right-0 z-10 bg-card group-hover:bg-muted/30 px-3 py-3">
         <div className="flex items-center justify-center gap-1">
           <Button
             variant="ghost"
             size="icon"
             className="h-7 w-7"
             onClick={handleWhatsApp}
             title="Abrir WhatsApp"
           >
             <MessageCircle className="h-4 w-4 text-emerald-600" />
           </Button>
 
           <Button
             variant="ghost"
             size="icon"
             className="h-7 w-7"
             onClick={onClick}
             title="Ver detalhes"
           >
             <Eye className="h-4 w-4 text-muted-foreground" />
           </Button>
 
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-7 w-7"
                 onClick={(e) => e.stopPropagation()}
               >
                 <MoreHorizontal className="h-4 w-4" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
               <DropdownMenuSub>
                 <DropdownMenuSubTrigger>Mover para etapa</DropdownMenuSubTrigger>
                 <DropdownMenuSubContent>
                   {allStages.map(stage => (
                     <DropdownMenuItem
                       key={stage.status}
                       onClick={() => onMoveStage(lead.id, stage.status)}
                       disabled={lead.status === stage.status}
                     >
                       {stage.label}
                     </DropdownMenuItem>
                   ))}
                 </DropdownMenuSubContent>
               </DropdownMenuSub>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Ganho')}>
                 <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                 Marcar como Ganho
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => onMoveStage(lead.id, 'Perdido')}>
                 <XCircle className="h-4 w-4 mr-2 text-red-600" />
                 Marcar como Perdido
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
         </div>
       </td>
     </tr>
   );
 }