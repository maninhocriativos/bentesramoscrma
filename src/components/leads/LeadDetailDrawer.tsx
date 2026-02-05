 import { Lead } from '@/types/leads';
 import { formatDistanceToNow } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import {
   X, User, Phone, Mail, Briefcase, DollarSign, Calendar,
   MessageCircle, FileSignature, Clock, Tag, Sparkles,
   MessageSquare, Zap, ZapOff, Plus, ArrowDownLeft, ArrowUpRight,
   Video, FileText, Loader2, Edit
 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Separator } from '@/components/ui/separator';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Switch } from '@/components/ui/switch';
 import { cn } from '@/lib/utils';
 import { useNavigate } from 'react-router-dom';
 import { useState, useEffect } from 'react';
 import { useInteracoes } from '@/hooks/useInteracoes';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { TarefaModal } from '@/components/tarefas/TarefaModal';
 
 interface LeadDetailDrawerProps {
   lead: Lead | null;
   isOpen: boolean;
   onClose: () => void;
 }
 
 const STATUS_COLORS: Record<string, string> = {
   'Lead Frio': 'bg-slate-100 text-slate-700',
   'Em Atendimento': 'bg-amber-100 text-amber-700',
   'Em Negociação': 'bg-blue-100 text-blue-700',
   'Aguardando Contrato': 'bg-purple-100 text-purple-700',
   'Contrato Assinado': 'bg-cyan-100 text-cyan-700',
   'Ganho': 'bg-emerald-100 text-emerald-700',
   'Perdido': 'bg-red-100 text-red-700',
 };
 
 const INTERACAO_ICONS: Record<string, React.ElementType> = {
   'Ligação': Phone,
   'Email': Mail,
   'WhatsApp': MessageCircle,
   'Reunião': Video,
   'Documento': FileText,
   'Outro': MessageSquare,
 };
 
 const INTERACAO_COLORS: Record<string, string> = {
   'Ligação': 'text-green-600 bg-green-100',
   'Email': 'text-blue-600 bg-blue-100',
   'WhatsApp': 'text-emerald-600 bg-emerald-100',
   'Reunião': 'text-purple-600 bg-purple-100',
   'Documento': 'text-amber-600 bg-amber-100',
   'Outro': 'text-slate-600 bg-slate-100',
 };
 
 const formatCurrency = (value: number | null): string => {
   if (!value) return 'Não informado';
   return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
 };
 
 export function LeadDetailDrawer({ lead, isOpen, onClose }: LeadDetailDrawerProps) {
   const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState('info');
   const [followupActive, setFollowupActive] = useState(true);
   const [loadingFollowup, setLoadingFollowup] = useState(false);
   const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
 
   const { interacoes, loading: loadingInteracoes, fetchInteracoes } = useInteracoes(lead?.id);
 
   useEffect(() => {
     if (lead?.id && isOpen) {
       setActiveTab('info');
       fetchInteracoes();
       fetchFollowupStatus();
     }
   }, [lead?.id, isOpen]);
 
   const fetchFollowupStatus = async () => {
     if (!lead?.id) return;
     const { data } = await supabase
       .from('lead_followups')
       .select('followup_lock_reason')
       .eq('lead_id', lead.id)
       .maybeSingle();
     setFollowupActive(data?.followup_lock_reason !== 'manual_pause');
   };
 
   const toggleFollowup = async () => {
     if (!lead?.id) return;
     setLoadingFollowup(true);
     try {
       const newLockReason = followupActive ? 'manual_pause' : null;
       const { data: existing } = await supabase
         .from('lead_followups')
         .select('id')
         .eq('lead_id', lead.id)
         .maybeSingle();
 
       if (existing) {
         await supabase
           .from('lead_followups')
           .update({ followup_lock_reason: newLockReason, updated_at: new Date().toISOString() })
           .eq('lead_id', lead.id);
       } else {
         await supabase
           .from('lead_followups')
           .insert({ lead_id: lead.id, followup_lock_reason: newLockReason, primeiro_contato_em: new Date().toISOString() });
       }
 
       setFollowupActive(!followupActive);
       toast.success(followupActive ? 'Follow-up pausado' : 'Follow-up reativado');
     } catch (error) {
       toast.error('Erro ao alterar status do follow-up');
     } finally {
       setLoadingFollowup(false);
     }
   };
 
   if (!lead) return null;
 
   const statusColor = STATUS_COLORS[lead.status || ''] || 'bg-muted text-muted-foreground';
 
   const handleWhatsApp = () => navigate(`/chat?lead_id=${lead.id}`);
   const handleCall = () => {
     if (lead.telefone) {
       const phone = lead.telefone.replace(/\D/g, '');
       window.location.href = `tel:+55${phone}`;
     }
   };
   const handleEmail = () => {
     if (lead.email) window.location.href = `mailto:${lead.email}`;
   };
   const handleEditFull = () => navigate(`/leads/${lead.id}`);
 
   return (
     <>
       {/* Backdrop */}
       <div
         className={cn(
           "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
           isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
         )}
         onClick={onClose}
       />
 
       {/* Drawer */}
       <div
         className={cn(
           "fixed top-0 right-0 h-full w-full max-w-lg bg-card border-l shadow-2xl z-50",
           "transform transition-transform duration-300 ease-out",
           isOpen ? "translate-x-0" : "translate-x-full"
         )}
       >
         {/* Header */}
         <div className="flex items-center justify-between p-4 border-b bg-muted/30">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
               <User className="w-5 h-5 text-primary" />
             </div>
             <div>
               <h2 className="font-semibold text-foreground truncate max-w-[240px]">
                 {lead.nome || 'Sem nome'}
               </h2>
               <Badge variant="secondary" className={cn("text-[10px] mt-0.5", statusColor)}>
                 {lead.status || 'Sem status'}
               </Badge>
             </div>
           </div>
           <Button variant="ghost" size="icon" onClick={onClose}>
             <X className="w-4 h-4" />
           </Button>
         </div>
 
         {/* Quick Actions */}
         <div className="p-4 border-b space-y-3">
           <div className="grid grid-cols-4 gap-2">
             <Button variant="outline" size="sm" className="h-12 flex-col gap-1" onClick={handleCall} disabled={!lead.telefone}>
               <Phone className="w-4 h-4 text-green-600" />
               <span className="text-[10px]">Ligar</span>
             </Button>
             <Button variant="outline" size="sm" className="h-12 flex-col gap-1" onClick={handleWhatsApp} disabled={!lead.telefone}>
               <MessageCircle className="w-4 h-4 text-emerald-600" />
               <span className="text-[10px]">WhatsApp</span>
             </Button>
             <Button variant="outline" size="sm" className="h-12 flex-col gap-1" onClick={handleEmail} disabled={!lead.email}>
               <Mail className="w-4 h-4 text-blue-600" />
               <span className="text-[10px]">Email</span>
             </Button>
             <Button variant="outline" size="sm" className="h-12 flex-col gap-1" onClick={() => setIsTaskModalOpen(true)}>
               <Plus className="w-4 h-4 text-primary" />
               <span className="text-[10px]">Tarefa</span>
             </Button>
           </div>
 
           {/* Follow-up Toggle */}
           <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
             <div className="flex items-center gap-2">
               {followupActive ? <Zap className="w-4 h-4 text-amber-500" /> : <ZapOff className="w-4 h-4 text-muted-foreground" />}
               <div>
                 <p className="text-sm font-medium">Follow-up automático</p>
                 <p className="text-[10px] text-muted-foreground">
                   {followupActive ? 'Ativo' : 'Pausado'}
                 </p>
               </div>
             </div>
             <Switch checked={followupActive} onCheckedChange={toggleFollowup} disabled={loadingFollowup} />
           </div>
         </div>
 
         {/* Tabs */}
         <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
           <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 px-4">
             <TabsTrigger value="info" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
               Informações
             </TabsTrigger>
             <TabsTrigger value="interacoes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1">
               Histórico
               {interacoes.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{interacoes.length}</Badge>}
             </TabsTrigger>
           </TabsList>
 
           {/* Info Tab */}
           <TabsContent value="info" className="mt-0 flex-1">
             <ScrollArea className="h-[calc(100vh-340px)]">
               <div className="p-4 space-y-5">
                 {/* Contact */}
                 <div className="space-y-3">
                   <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</h3>
                   {lead.telefone && (
                     <div className="flex items-center gap-3 text-sm">
                       <Phone className="w-4 h-4 text-muted-foreground" />
                       <span>{lead.telefone}</span>
                     </div>
                   )}
                   {lead.email && (
                     <div className="flex items-center gap-3 text-sm">
                       <Mail className="w-4 h-4 text-muted-foreground" />
                       <span className="truncate">{lead.email}</span>
                     </div>
                   )}
                 </div>
 
                 <Separator />
 
                 {/* Case Info */}
                 <div className="space-y-3">
                   <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Caso</h3>
                   {lead.tipo_acao && (
                     <div className="flex items-center gap-3 text-sm">
                       <Briefcase className="w-4 h-4 text-muted-foreground" />
                       <span>{lead.tipo_acao}</span>
                     </div>
                   )}
                   <div className="flex items-center gap-3 text-sm">
                     <DollarSign className="w-4 h-4 text-muted-foreground" />
                     <span className="font-medium text-emerald-600">{formatCurrency(lead.valor_causa)}</span>
                   </div>
                   {lead.origem && (
                     <div className="flex items-center gap-3 text-sm">
                       <Tag className="w-4 h-4 text-muted-foreground" />
                       <Badge variant="secondary" className="text-xs">{lead.origem}</Badge>
                     </div>
                   )}
                 </div>
 
                 <Separator />
 
                 {/* Timeline */}
                 <div className="space-y-3">
                   <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h3>
                   <div className="flex items-center gap-3 text-sm">
                     <Calendar className="w-4 h-4 text-muted-foreground" />
                     <span>Criado {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}</span>
                   </div>
                   {lead.updated_at && (
                     <div className="flex items-center gap-3 text-sm">
                       <Clock className="w-4 h-4 text-muted-foreground" />
                       <span>Atualizado {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}</span>
                     </div>
                   )}
                 </div>
 
                 {/* AI Summary */}
                 {lead.resumo_ia && (
                   <>
                     <Separator />
                     <div className="space-y-2">
                       <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                         <Sparkles className="w-3 h-3" />
                         Resumo IA
                       </h3>
                       <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{lead.resumo_ia}</p>
                     </div>
                   </>
                 )}
               </div>
             </ScrollArea>
           </TabsContent>
 
           {/* Interactions Tab */}
           <TabsContent value="interacoes" className="mt-0 flex-1">
             <ScrollArea className="h-[calc(100vh-340px)]">
               <div className="p-4">
                 {loadingInteracoes ? (
                   <div className="flex items-center justify-center py-8">
                     <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                   </div>
                 ) : interacoes.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-12 text-center">
                     <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
                     <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {interacoes.map((interacao) => {
                       const Icon = INTERACAO_ICONS[interacao.tipo] || MessageSquare;
                       const colorClass = INTERACAO_COLORS[interacao.tipo] || INTERACAO_COLORS['Outro'];
                       const isEntrada = interacao.direcao === 'Entrada';
 
                       return (
                         <div key={interacao.id} className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors">
                           <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                               <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", colorClass)}>
                                 <Icon className="w-3.5 h-3.5" />
                               </div>
                               <div>
                                 <span className="text-xs font-medium">{interacao.tipo}</span>
                                 <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                   {isEntrada ? <ArrowDownLeft className="w-2.5 h-2.5 text-blue-500" /> : <ArrowUpRight className="w-2.5 h-2.5 text-emerald-500" />}
                                   {isEntrada ? 'Recebida' : 'Enviada'}
                                 </div>
                               </div>
                             </div>
                             <span className="text-[10px] text-muted-foreground">
                               {formatDistanceToNow(new Date(interacao.data_interacao), { addSuffix: true, locale: ptBR })}
                             </span>
                           </div>
                           <p className="text-sm">{interacao.resumo}</p>
                           {interacao.detalhes && <p className="text-xs text-muted-foreground mt-1">{interacao.detalhes}</p>}
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
             </ScrollArea>
           </TabsContent>
         </Tabs>
 
         {/* Footer */}
         <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-card">
           <Button className="w-full gap-2" onClick={handleEditFull}>
             <Edit className="w-4 h-4" />
             Editar Lead Completo
           </Button>
         </div>
       </div>
 
       <TarefaModal open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen} />
     </>
   );
 }