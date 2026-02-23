import { Lead } from '@/types/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, User, Phone, Mail, Briefcase, DollarSign, Calendar,
  MessageCircle, Clock, Tag, Sparkles,
  MessageSquare, Zap, ZapOff, Plus, 
  Loader2, ExternalLink, History, Link2, Pencil, Check
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { LeadHistoryTimeline } from './LeadHistoryTimeline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

const formatCurrency = (value: number | null): string => {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

function ContractLinkField({ leadId, initialValue }: { leadId: string; initialValue: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('leads_juridicos')
      .update({ link_contrato: value || null })
      .eq('id', leadId);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar link');
    } else {
      toast.success('Link salvo');
      setEditing(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Link2 className="w-3 h-3" />
        Link do Contrato
      </h3>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://..."
            className="h-8 text-xs"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={save} disabled={saving}>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setEditing(false); setValue(initialValue || ''); }}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          {value ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate max-w-[220px]">
              {value}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Nenhum link</span>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function LeadDetailDrawer({ lead, isOpen, onClose }: LeadDetailDrawerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');
  const [followupActive, setFollowupActive] = useState(true);
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [checkingConversation, setCheckingConversation] = useState(false);

  useEffect(() => {
    if (lead?.id && isOpen) {
      setActiveTab('info');
      fetchFollowupStatus();
      checkExistingConversation();
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

  const checkExistingConversation = async () => {
    if (!lead?.telefone) {
      setHasConversation(false);
      return;
    }
    setCheckingConversation(true);
    try {
      const normalizedPhone = lead.telefone.replace(/\D/g, '');
      const { data } = await supabase
        .from('manychat_subscribers')
        .select('id')
        .or(`telefone.ilike.%${normalizedPhone}%,telefone_normalizado.ilike.%${normalizedPhone}%,lead_id.eq.${lead.id}`)
        .maybeSingle();
      setHasConversation(!!data);
    } catch {
      setHasConversation(false);
    } finally {
      setCheckingConversation(false);
    }
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
    } catch {
      toast.error('Erro ao alterar status do follow-up');
    } finally {
      setLoadingFollowup(false);
    }
  };

  const handleOpenChat = async () => {
    if (!lead) return;
    // Navigate to chat - will auto-create conversation if needed
    navigate(`/chat?lead_id=${lead.id}`);
  };

  if (!lead) return null;

  const statusColor = STATUS_COLORS[lead.status || ''] || 'bg-muted text-muted-foreground';

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
      <TooltipProvider delayDuration={200}>
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
            "fixed top-0 right-0 h-full w-full max-w-md bg-card border-l shadow-2xl z-50",
            "transform transition-transform duration-300 ease-out",
            isOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-foreground truncate max-w-[200px]">
                  {lead.nome || 'Sem nome'}
                </h2>
                <Badge variant="secondary" className={cn("text-[10px] mt-0.5 h-5", statusColor)}>
                  {lead.status || 'Sem status'}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* CTA: Open Chat - Main Action */}
          <div className="p-3 border-b bg-gradient-to-r from-emerald-50 to-green-50">
            <Button 
              onClick={handleOpenChat} 
              className="w-full h-10 gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={!lead.telefone}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium">
                {checkingConversation ? 'Verificando...' : hasConversation ? 'Abrir Chat' : 'Iniciar Conversa'}
              </span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-60" />
            </Button>
            {!lead.telefone && (
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Lead sem telefone cadastrado
              </p>
            )}
          </div>

          {/* Quick Actions - Compact */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={handleCall} disabled={!lead.telefone}>
                    <Phone className="w-4 h-4 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ligar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={handleEmail} disabled={!lead.email}>
                    <Mail className="w-4 h-4 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Email</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setIsTaskModalOpen(true)}>
                    <Plus className="w-4 h-4 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Nova Tarefa</TooltipContent>
              </Tooltip>

              {/* Follow-up Toggle - Compact */}
              <div className="flex items-center gap-2 ml-auto px-2 py-1.5 rounded-md bg-muted/50 border">
                {followupActive ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : <ZapOff className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-xs">{followupActive ? 'Auto' : 'Pausado'}</span>
                <Switch checked={followupActive} onCheckedChange={toggleFollowup} disabled={loadingFollowup} className="h-4 w-7" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9 px-3">
              <TabsTrigger value="info" className="text-xs h-7 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                Informações
              </TabsTrigger>
              <TabsTrigger value="historico" className="text-xs h-7 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1">
                <History className="w-3 h-3" />
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="mt-0 flex-1">
              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="p-4 space-y-4">
                  {/* Contact */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Contato</h3>
                    {lead.telefone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{lead.telefone}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Case Info */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Caso</h3>
                    {lead.tipo_acao && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{lead.tipo_acao}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-emerald-600">{formatCurrency(lead.valor_causa)}</span>
                    </div>
                    {lead.origem && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">{lead.origem}</Badge>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Timeline */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Datas</h3>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Criado {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                    {lead.updated_at && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Atualizado {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    )}
                  </div>

                  {/* Contract Link */}
                  <Separator />
                  <ContractLinkField leadId={lead.id} initialValue={lead.link_contrato} />

                  {/* AI Summary */}
                  {lead.resumo_ia && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Resumo IA
                        </h3>
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">{lead.resumo_ia}</p>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="historico" className="mt-0 flex-1">
              <LeadHistoryTimeline leadId={lead.id} telefone={lead.telefone} />
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-card">
            <Button variant="outline" className="w-full h-9 gap-2 text-xs" onClick={handleEditFull}>
              <ExternalLink className="w-3.5 h-3.5" />
              Ver Ficha Completa
            </Button>
          </div>
        </div>
      </TooltipProvider>

      <TarefaModal open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen} />
    </>
  );
}