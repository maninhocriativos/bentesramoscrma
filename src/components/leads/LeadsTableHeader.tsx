 import { Search, Download, Plus, Filter } from 'lucide-react';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { LeadModal } from '@/components/LeadModal';
 import { useState } from 'react';
 import { useToast } from '@/hooks/use-toast';
 import { supabase } from '@/integrations/supabase/client';
 import { LeadStatus } from '@/types/leads';
 
 interface LeadsTableHeaderProps {
   totalLeads: number;
   search: string;
   onSearchChange: (value: string) => void;
   filterOrigem: string;
   onFilterOrigemChange: (value: string) => void;
   filterResponsavel: string;
   onFilterResponsavelChange: (value: string) => void;
   filterEtapa: string;
   onFilterEtapaChange: (value: string) => void;
   filterPrioridade: string;
   onFilterPrioridadeChange: (value: string) => void;
   origens: string[];
   etapas: LeadStatus[];
 }
 
 export function LeadsTableHeader({
   totalLeads,
   search,
   onSearchChange,
   filterOrigem,
   onFilterOrigemChange,
   filterEtapa,
   onFilterEtapaChange,
   origens,
   etapas,
 }: LeadsTableHeaderProps) {
   const { toast } = useToast();
   const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
 
   const exportToCSV = async () => {
     try {
       const { data: leads, error } = await supabase
         .from('leads_juridicos')
         .select('*')
         .order('created_at', { ascending: false });
 
       if (error) throw error;
       if (!leads || leads.length === 0) {
         toast({
           title: 'Nenhum lead para exportar',
           variant: 'destructive',
         });
         return;
       }
 
       const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Tipo de Ação', 'Valor da Causa', 'Data de Criação'];
       const rows = leads.map(lead => [
         lead.nome || '',
         lead.email || '',
         lead.telefone || '',
         lead.status || '',
         lead.origem || '',
         lead.tipo_acao || '',
         lead.valor_causa || '',
         new Date(lead.created_at).toLocaleDateString('pt-BR'),
       ]);
 
       const csvContent = [
         headers.join(';'),
         ...rows.map(row => row.map(cell => `"${cell}"`).join(';')),
       ].join('\n');
 
       const BOM = '\uFEFF';
       const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
       const url = URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.href = url;
       link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       URL.revokeObjectURL(url);
 
       toast({
         title: 'Exportação concluída!',
         description: `${leads.length} leads exportados.`,
       });
     } catch (error) {
       console.error('Export error:', error);
       toast({
         title: 'Erro ao exportar',
         variant: 'destructive',
       });
     }
   };
 
   return (
     <>
       <header className="sticky top-0 z-20 bg-background border-b">
         <div className="h-[72px] px-4 lg:px-6 flex items-center gap-4">
           {/* Title & Count */}
           <div className="flex items-baseline gap-3 min-w-fit">
             <h1 className="text-xl font-semibold text-foreground">Pipeline</h1>
             <span className="text-sm text-muted-foreground">{totalLeads} leads</span>
           </div>
 
           {/* Search */}
           <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Buscar por nome, WhatsApp ou e-mail"
               value={search}
               onChange={(e) => onSearchChange(e.target.value)}
               className="pl-9 h-10 rounded-lg bg-muted/50"
             />
           </div>
 
           {/* Filters - Desktop */}
           <div className="hidden lg:flex items-center gap-2">
             <Select value={filterOrigem} onValueChange={onFilterOrigemChange}>
               <SelectTrigger className="w-[130px] h-10 rounded-lg bg-muted/50 border-0">
                 <SelectValue placeholder="Origem" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todas Origens</SelectItem>
                 {origens.map(origem => (
                   <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
 
             <Select value={filterEtapa} onValueChange={onFilterEtapaChange}>
               <SelectTrigger className="w-[150px] h-10 rounded-lg bg-muted/50 border-0">
                 <SelectValue placeholder="Etapa" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todas Etapas</SelectItem>
                 {etapas.map(etapa => (
                   <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           {/* Actions */}
           <div className="flex items-center gap-2">
             <Button
               onClick={() => setIsNewLeadModalOpen(true)}
               className="h-10 gap-2"
             >
               <Plus className="h-4 w-4" />
               <span className="hidden sm:inline">Novo Lead</span>
             </Button>
 
             <Button
               variant="outline"
               size="icon"
               onClick={exportToCSV}
               className="h-10 w-10 rounded-lg"
               title="Exportar CSV"
             >
               <Download className="h-4 w-4" />
             </Button>
           </div>
         </div>
       </header>
 
       <LeadModal
         lead={null}
         isOpen={isNewLeadModalOpen}
         onClose={() => setIsNewLeadModalOpen(false)}
         isNew={true}
         canDelete={false}
       />
     </>
   );
 }