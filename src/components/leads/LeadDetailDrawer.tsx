import { Lead } from '@/types/leads';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, User, Phone, Mail, Briefcase, DollarSign, Calendar,
  MessageCircle, Clock, Tag, Sparkles,
  MessageSquare, Zap, ZapOff, Plus, 
  Loader2, ExternalLink, History, Link2, Pencil, Check,
  FileSignature, Minus, Megaphone, Globe, Building2, Hash
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
import { useState, useEffect, useMemo } from 'react';
import { useLeadContracts } from '@/hooks/useLeadContracts';
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

function ContratosExtrasTab({ lead }: { lead: Lead }) {
  const [contratosAdicionais, setContratosAdicionais] = useState(lead.contratos_adicionais || 0);
  const [saving, setSaving] = useState(false);
  const [nota, setNota] = useState('');

  useEffect(() => {
    setContratosAdicionais(lead.contratos_adicionais || 0);
  }, [lead.id, lead.contratos_adicionais]);

  const updateContratos = async (newValue: number) => {
    if (newValue < 0) return;
    setSaving(true);
    const { error } = await supabase
      .from('leads_juridicos')
      .update({ contratos_adicionais: newValue, updated_at: new Date().toISOString() })
      .eq('id', lead.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao atualizar');
    } else {
      setContratosAdicionais(newValue);
      toast.success(`Contratos adicionais: ${newValue}`);
    }
  };

  const addContrato = async () => {
    const newValue = contratosAdicionais + 1;
    await updateContratos(newValue);
    if (nota.trim()) {
      await supabase.from('interacoes').insert({
        cliente_id: lead.id,
        tipo: 'Contrato',
        resumo: `Contrato adicional #${newValue} registrado`,
        detalhes: nota.trim(),
        direcao: 'Entrada',
        data_interacao: new Date().toISOString(),
      });
      setNota('');
    }
  };

  const isConverted = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'].includes(lead.lead_state || '');
  const totalContratos = (isConverted ? 1 : 0) + contratosAdicionais;

  return (
    <ScrollArea className="h-[calc(100vh-340px)]">
      <div className="p-4 space-y-5">
        <div className="text-center p-4 rounded-xl bg-muted/30 border">
          <p className="text-3xl font-bold text-foreground">{totalContratos}</p>
          <p className="text-xs text-muted-foreground mt-1">Contratos Totais</p>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
            {isConverted && (
              <span className="flex items-center gap-1 text-[hsl(var(--success))]">
                <FileSignature className="w-3 h-3" />
                1 principal
              </span>
            )}
            {contratosAdicionais > 0 && (
              <span className="flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {contratosAdicionais} adicional(is)
              </span>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Registrar Contrato Adicional
          </h3>
          <p className="text-xs text-muted-foreground">
            Contratos fechados por fora do fluxo automático. Serão contabilizados nas métricas do dashboard.
          </p>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descrição do contrato (opcional)..."
            className="h-9 text-xs"
          />
          <Button
            onClick={addContrato}
            disabled={saving}
            className="w-full h-9 gap-2 text-xs"
            variant="default"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />}
            Adicionar Contrato
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Ajustar Quantidade Manual
          </h3>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => updateContratos(contratosAdicionais - 1)}
              disabled={contratosAdicionais <= 0 || saving}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-2xl font-bold w-12 text-center">{contratosAdicionais}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => updateContratos(contratosAdicionais + 1)}
              disabled={saving}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">contratos adicionais</p>
        </div>
      </div>
    </ScrollArea>
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
              <TabsTrigger value="contratos" className="text-xs h-7 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1">
                <FileSignature className="w-3 h-3" />
                Contratos
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

                  {/* Origem / Source */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Origem</h3>
                    
                    {/* Tipo de Origem */}
                    <div className="flex items-center gap-2.5 text-sm">
                      <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs">Tipo:</span>
                      <Badge variant="secondary" className={cn("text-[10px]",
                        lead.tipo_origem === 'trafego' ? 'bg-amber-100 text-amber-700' : 
                        lead.tipo_origem === 'whatsapp_direto' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-muted text-muted-foreground'
                      )}>
                        {lead.tipo_origem === 'trafego' ? '📣 Tráfego Pago' : 
                         lead.tipo_origem === 'whatsapp_direto' ? '💬 WhatsApp Direto' : 
                         '❓ Indefinido'}
                      </Badge>
                    </div>

                    {/* Canal / Origem */}
                    {lead.origem && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Canal:</span>
                        <Badge variant="outline" className="text-[10px]">{lead.origem}</Badge>
                      </div>
                    )}

                    {/* Fonte de Tráfego */}
                    {lead.fonte_trafego && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Fonte:</span>
                        <span className="text-xs">{lead.fonte_trafego}</span>
                      </div>
                    )}

                    {/* Empresa / Linha */}
                    {lead.empresa_tag && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Empresa:</span>
                        <Badge variant="secondary" className="text-[10px]">{lead.empresa_tag}</Badge>
                      </div>
                    )}

                    {lead.linha_whatsapp && lead.linha_whatsapp !== 'indefinido' && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">Linha:</span>
                        <span className="text-xs">
                          {lead.linha_whatsapp === 'trafego_isa' ? 'Tráfego (ISA)' : 
                           lead.linha_whatsapp === 'bentes_ramos_antigo' ? 'Bentes Ramos' : 
                           lead.linha_whatsapp}
                        </span>
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
                      <span className="font-medium text-[hsl(var(--success))]">{formatCurrency(lead.valor_causa)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Contracts Summary */}
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <FileSignature className="w-3 h-3" />
                      Contratos
                    </h3>
                    {(() => {
                      const isConv = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'].includes(lead.lead_state || '');
                      const extras = lead.contratos_adicionais || 0;
                      const total = (isConv ? 1 : 0) + extras;
                      return (
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border">
                          <div className="text-center flex-1">
                            <p className="text-lg font-bold text-foreground">{total}</p>
                            <p className="text-[9px] text-muted-foreground">Total</p>
                          </div>
                          <div className="w-px h-8 bg-border/50" />
                          <div className="text-center flex-1">
                            <p className={cn("text-lg font-bold", isConv ? "text-[hsl(var(--success))]" : "text-muted-foreground")}>{isConv ? 1 : 0}</p>
                            <p className="text-[9px] text-muted-foreground">Principal</p>
                          </div>
                          <div className="w-px h-8 bg-border/50" />
                          <div className="text-center flex-1">
                            <p className="text-lg font-bold text-foreground">{extras}</p>
                            <p className="text-[9px] text-muted-foreground">Adicionais</p>
                          </div>
                        </div>
                      );
                    })()}
                    {lead.contract_signed_at && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Check className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                        <span className="text-xs text-muted-foreground">
                          Assinado em {format(new Date(lead.contract_signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
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

            {/* Contratos Tab */}
            <TabsContent value="contratos" className="mt-0 flex-1">
              <ContratosExtrasTab lead={lead} />
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