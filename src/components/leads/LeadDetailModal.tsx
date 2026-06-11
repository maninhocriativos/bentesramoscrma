import { useState, useEffect, useMemo, useCallback } from 'react';
import { Lead, LeadStatus, LeadOrigem } from '@/types/leads';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, User, Phone, Mail, Briefcase, DollarSign, Calendar,
  MessageCircle, Clock, Tag, Sparkles, Bot, Scale, FileSignature,
  Zap, ZapOff, Plus, Loader2, ExternalLink, History, Link2,
  Pencil, Check, Minus, Megaphone, Globe, Building2, Hash,
  Save, ChevronRight, Copy, Trash2, ArrowRight, MessageSquare
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useLeadContracts } from '@/hooks/useLeadContracts';
import { useLeadProcessos } from '@/hooks/useLeadProcessos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LeadHistoryTimeline } from './LeadHistoryTimeline';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
}

const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string }> = {
  'Lead Frio': { dot: 'bg-stage-frio', bg: 'bg-stage-frio-bg', text: 'text-stage-frio' },
  'Bentes Ramos': { dot: 'bg-stage-bentes', bg: 'bg-stage-bentes-bg', text: 'text-stage-bentes' },
  'Em Atendimento': { dot: 'bg-stage-atendimento', bg: 'bg-stage-atendimento-bg', text: 'text-stage-atendimento' },
  'Em Negociação': { dot: 'bg-stage-negociacao', bg: 'bg-stage-negociacao-bg', text: 'text-stage-negociacao' },
  'Aguardando Contrato': { dot: 'bg-stage-aguardando', bg: 'bg-stage-aguardando-bg', text: 'text-stage-aguardando' },
  'Contrato Assinado': { dot: 'bg-stage-assinado', bg: 'bg-stage-assinado-bg', text: 'text-stage-assinado' },
  'Ganho': { dot: 'bg-stage-ganho', bg: 'bg-stage-ganho-bg', text: 'text-stage-ganho' },
  'Perdido': { dot: 'bg-stage-perdido', bg: 'bg-stage-perdido-bg', text: 'text-stage-perdido' },
};

const STATUSES: LeadStatus[] = [
  'Lead Frio', 'Bentes Ramos', 'Em Atendimento', 'Em Negociação',
  'Aguardando Contrato', 'Contrato Assinado', 'Ganho', 'Perdido',
];

const ORIGENS: LeadOrigem[] = ['Instagram', 'Google', 'Site', 'Indicação', 'Bentes Ramos', 'Escritório', 'Tráfego Pago', 'WhatsApp Z-API', 'Outro'];

const formatCurrency = (value: number | null): string => {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Próxima ação sugerida com base no status do lead
function proximaAcao(lead: Lead, diasParado: number): { texto: string; cor: string } {
  const s = lead.status || '';
  if (s === 'Perdido') return { texto: 'Lead perdido — reative com uma nova abordagem ou prova social.', cor: 'rose' };
  if (s === 'Ganho' || s === 'Contrato Assinado') return { texto: 'Cliente fechado — acompanhe o processo e peça indicações.', cor: 'emerald' };
  if (s === 'Aguardando Contrato') return { texto: 'Cobre a assinatura do contrato (dê um prazo claro).', cor: 'amber' };
  if (s === 'Em Negociação') return { texto: 'Avance para o fechamento — crie senso de urgência.', cor: 'violet' };
  if (s === 'Em Atendimento') return { texto: 'Peça os documentos (contrato é a prioridade).', cor: 'blue' };
  if (s === 'Lead Frio') return { texto: 'Faça o primeiro contato e gere rapport.', cor: 'slate' };
  if (diasParado >= 3) return { texto: `Parado há ${diasParado} dias — faça um follow-up.`, cor: 'amber' };
  return { texto: 'Dê o próximo passo do atendimento.', cor: 'slate' };
}

// ============== RESUMO TAB ==============
function ResumoTab({ lead }: { lead: Lead }) {
  const { data: contractReminders } = useLeadContracts(lead.id);
  const { data: processosData } = useLeadProcessos(lead.id);
  const navigate = useNavigate();

  // Inteligência do lead: engajamento + duplicatas (tempo real)
  const [msgStats, setMsgStats] = useState<{ total: number; ultima?: string } | null>(null);
  const [duplicados, setDuplicados] = useState<{ id: string; nome: string; status: string }[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      // Engajamento: nº de mensagens e data da última
      const { data: msgs } = await supabase
        .from('manychat_mensagens').select('created_at')
        .eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1000);
      if (!cancel) setMsgStats({ total: msgs?.length || 0, ultima: msgs?.[0]?.created_at });

      // Duplicatas: outros leads com o mesmo telefone (sufixo de 8 dígitos)
      const suf = (lead.telefone || '').replace(/\D/g, '').slice(-8);
      if (suf.length >= 8) {
        const { data: dups } = await supabase
          .from('leads_juridicos').select('id, nome, status, telefone')
          .ilike('telefone', `%${suf}%`).neq('id', lead.id).limit(5);
        if (!cancel) setDuplicados((dups || []).map((d: any) => ({ id: d.id, nome: d.nome || 'Sem nome', status: d.status || '' })));
      }
    })();
    return () => { cancel = true; };
  }, [lead.id, lead.telefone]);

  const config = STATUS_CONFIG[lead.status || 'Lead Frio'] || STATUS_CONFIG['Lead Frio'];
  const processoCount = processosData?.processos.length || 0;
  const reminders = contractReminders || [];
  const signedCount = reminders.filter(c => c.status === 'signed' || c.signed_at).length;
  const hasContract = lead.contract_signed_at || lead.status === 'Contrato Assinado' || lead.status === 'Ganho' || signedCount > 0;

  const whatsappLink = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, '')}` : null;

  const refDate = msgStats?.ultima || lead.updated_at || lead.created_at;
  const diasParado = refDate ? Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000) : 0;
  const acao = proximaAcao(lead, diasParado);

  return (
    <ScrollArea className="h-[62vh]">
      <div className="p-5 space-y-5">
        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {whatsappLink && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950" asChild>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </Button>
          )}
          {lead.telefone && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" onClick={() => window.location.href = `tel:+55${lead.telefone?.replace(/\D/g, '')}`}>
              <Phone className="h-3.5 w-3.5" /> Ligar
            </Button>
          )}
          {lead.email && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" onClick={() => window.location.href = `mailto:${lead.email}`}>
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg ml-auto" onClick={() => navigate(`/chat?lead_id=${lead.id}`)}>
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </Button>
        </div>

        {/* ⚠️ Alerta de duplicata */}
        {duplicados.length > 0 && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Copy className="h-4 w-4" />
              <span className="text-xs font-semibold">
                {duplicados.length === 1 ? 'Possível duplicata' : `${duplicados.length} possíveis duplicatas`} — mesmo telefone
              </span>
            </div>
            <div className="space-y-1">
              {duplicados.map(d => (
                <button key={d.id} onClick={() => navigate(`/leads/${d.id}`)}
                  className="flex items-center justify-between w-full text-left text-xs px-2 py-1.5 rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <span className="truncate">{d.nome}</span>
                  <span className="flex items-center gap-1 text-muted-foreground shrink-0">{d.status} <ArrowRight className="h-3 w-3" /></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 🧠 Inteligência do lead */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Inteligência do lead
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/40"><MessageCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-sm font-bold leading-none">{msgStats?.total ?? '—'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">mensagens trocadas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", diasParado >= 3 ? "bg-amber-100 dark:bg-amber-950/40" : "bg-emerald-100 dark:bg-emerald-950/40")}><Clock className={cn("h-3.5 w-3.5", diasParado >= 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")} /></div>
              <div>
                <p className="text-sm font-bold leading-none">{diasParado === 0 ? 'Hoje' : `${diasParado}d`}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">desde o último contato</p>
              </div>
            </div>
          </div>
          <div className={cn("flex items-start gap-2 text-xs p-2.5 rounded-lg",
            acao.cor === 'rose' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400' :
            acao.cor === 'amber' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
            acao.cor === 'emerald' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
            acao.cor === 'violet' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400' :
            acao.cor === 'blue' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' :
            'bg-muted/50 text-muted-foreground')}>
            <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Próxima ação:</strong> {acao.texto}</span>
          </div>
        </div>

        {/* Status + Stage Card */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", config.dot)} />
              <span className={cn("text-sm font-semibold", config.text)}>{lead.status}</span>
            </div>
            {lead.lead_state && (
              <Badge variant="outline" className="text-[10px] font-mono">{lead.lead_state}</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-card border">
              <p className="text-lg font-bold text-foreground">{processoCount}</p>
              <p className="text-[9px] text-muted-foreground">Processos</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-card border">
              <p className={cn("text-lg font-bold", hasContract ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                {Math.max(signedCount, hasContract ? 1 : 0)}
              </p>
              <p className="text-[9px] text-muted-foreground">Contratos</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-card border">
              <p className="text-lg font-bold text-foreground">
                {lead.valor_causa ? formatCurrency(lead.valor_causa).replace('R$', '').trim() : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground">Valor</p>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-2.5">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
          {lead.telefone && (
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{lead.telefone}</span>
              <button onClick={() => { navigator.clipboard.writeText(lead.telefone || ''); toast.success('Copiado'); }}>
                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>

        {/* Origin Info */}
        <div className="space-y-2.5">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Origem</h4>
          <div className="flex flex-wrap gap-1.5">
            {lead.origem && <Badge variant="secondary" className="text-[10px]">{lead.origem}</Badge>}
            {lead.tipo_origem === 'trafego' && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">📣 Tráfego</Badge>}
            {lead.empresa_tag && <Badge variant="secondary" className="text-[10px]">{lead.empresa_tag}</Badge>}
            {lead.fonte_trafego && <Badge variant="outline" className="text-[10px]">{lead.fonte_trafego}</Badge>}
          </div>
        </div>

        {/* Case Info */}
        {(lead.tipo_acao || lead.valor_causa) && (
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Caso</h4>
            {lead.tipo_acao && (
              <div className="flex items-center gap-2.5 text-sm">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{lead.tipo_acao}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(lead.valor_causa)}</span>
            </div>
          </div>
        )}

        {/* AI Summary */}
        {lead.resumo_ia && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Resumo IA
            </h4>
            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg leading-relaxed">{lead.resumo_ia}</p>
          </div>
        )}

        {/* Dates */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Datas</h4>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            Criado {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
          </div>
          {lead.updated_at && (
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Atualizado {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

// ============== INFO/EDIT TAB ==============
function InfoEditTab({ lead, onSaved }: { lead: Lead; onSaved: (updated: Lead) => void }) {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [form, setForm] = useState({
    nome: lead.nome || '',
    telefone: lead.telefone || '',
    email: lead.email || '',
    status: lead.status as LeadStatus || 'Lead Frio',
    origem: (lead.origem as LeadOrigem) || 'Outro',
    tipo_acao: lead.tipo_acao || '',
    valor_causa: lead.valor_causa?.toString() || '',
    resumo_ia: lead.resumo_ia || '',
    link_contrato: lead.link_contrato || '',
    fonte_trafego: lead.fonte_trafego || '',
  });

  useEffect(() => {
    const newForm = {
      nome: lead.nome || '',
      telefone: lead.telefone || '',
      email: lead.email || '',
      status: lead.status as LeadStatus || 'Lead Frio',
      origem: (lead.origem as LeadOrigem) || 'Outro',
      tipo_acao: lead.tipo_acao || '',
      valor_causa: lead.valor_causa?.toString() || '',
      resumo_ia: lead.resumo_ia || '',
      link_contrato: lead.link_contrato || '',
      fonte_trafego: lead.fonte_trafego || '',
    };
    setForm(newForm);
    setHasChanges(false);
  }, [lead.id, lead.updated_at]);

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    setSaving(true);
    const updates: Record<string, any> = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      status: form.status,
      origem: form.origem,
      tipo_acao: form.tipo_acao.trim() || null,
      valor_causa: form.valor_causa ? Number(form.valor_causa) : null,
      resumo_ia: form.resumo_ia.trim() || null,
      link_contrato: form.link_contrato.trim() || null,
      fonte_trafego: form.fonte_trafego.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('leads_juridicos')
      .update(updates)
      .eq('id', lead.id)
      .select()
      .single();

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    setHasChanges(false);
    toast.success('Lead salvo com sucesso');
    if (data) onSaved(data as Lead);
  };

  return (
    <ScrollArea className="h-[62vh]">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={form.nome} onChange={e => updateField('nome', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Telefone</Label>
            <Input value={form.telefone} onChange={e => updateField('telefone', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Email</Label>
            <Input value={form.email} onChange={e => updateField('email', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Status</Label>
            <Select value={form.status} onValueChange={v => { setForm(prev => ({ ...prev, status: v as LeadStatus })); setHasChanges(true); }}>
              <SelectTrigger className="h-9 text-sm rounded-lg mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium">Origem</Label>
            <Select value={form.origem} onValueChange={v => { setForm(prev => ({ ...prev, origem: v as LeadOrigem })); setHasChanges(true); }}>
              <SelectTrigger className="h-9 text-sm rounded-lg mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium">Tipo de Ação</Label>
            <Input value={form.tipo_acao} onChange={e => updateField('tipo_acao', e.target.value)} className="h-9 text-sm rounded-lg mt-1" placeholder="Ex: Trabalhista" />
          </div>
          <div>
            <Label className="text-xs font-medium">Valor da Causa (R$)</Label>
            <Input type="number" value={form.valor_causa} onChange={e => updateField('valor_causa', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs font-medium">Fonte de Tráfego</Label>
            <Input value={form.fonte_trafego} onChange={e => updateField('fonte_trafego', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium">Link do Contrato</Label>
            <Input value={form.link_contrato} onChange={e => updateField('link_contrato', e.target.value)} className="h-9 text-sm rounded-lg mt-1" placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-medium">Resumo / Anotações</Label>
            <Textarea value={form.resumo_ia} onChange={e => updateField('resumo_ia', e.target.value)} className="min-h-[80px] text-sm rounded-lg mt-1" />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ============== PROCESSOS TAB ==============
function ProcessosTab({ lead }: { lead: Lead }) {
  const { data: processosData, isLoading } = useLeadProcessos(lead.id);
  const navigate = useNavigate();
  const processos = processosData?.processos || [];
  const autoLinked = processosData?.autoLinked || 0;

  return (
    <ScrollArea className="h-[62vh]">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{processos.length} Processo{processos.length !== 1 ? 's' : ''}</span>
            {autoLinked > 0 && (
              <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {autoLinked} auto-vinculado{autoLinked > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs rounded-lg" onClick={() => navigate('/processos')}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : processos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum processo vinculado</p>
            <p className="text-xs mt-1">Processos serão vinculados automaticamente por CPF/nome</p>
          </div>
        ) : (
          <div className="space-y-2">
            {processos.map(proc => (
              <div
                key={proc.id}
                onClick={() => navigate('/processos')}
                className="p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-muted-foreground truncate">{proc.numero_processo || 'Sem número'}</p>
                    <p className="text-sm font-medium truncate mt-0.5">{proc.titulo_acao || 'Sem título'}</p>
                  </div>
                  <Badge variant="secondary" className={cn("text-[9px] shrink-0",
                    proc.status === 'Em Andamento' ? 'bg-stage-atendimento-bg text-stage-atendimento' :
                    proc.status === 'Ganho' ? 'bg-stage-ganho-bg text-stage-ganho' :
                    proc.status === 'Perdido' ? 'bg-stage-perdido-bg text-stage-perdido' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {proc.status || 'Indefinido'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  {proc.tribunal && <span>{proc.tribunal}</span>}
                  {proc.advogado_responsavel && <span>• {proc.advogado_responsavel}</span>}
                  {proc.origem_cliente && (
                    <Badge variant="outline" className="text-[8px] h-3.5 ml-auto">
                      {proc.origem_cliente === 'manual' ? 'Manual' : 'Auto'}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ============== CONTRATOS TAB ==============
function ContratosTab({ lead }: { lead: Lead }) {
  const { data: contractReminders } = useLeadContracts(lead.id);
  const [contratosAdicionais, setContratosAdicionais] = useState(lead.contratos_adicionais || 0);
  const [saving, setSaving] = useState(false);

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
    if (error) { toast.error('Erro ao atualizar'); return; }
    setContratosAdicionais(newValue);
    toast.success(`Contratos adicionais: ${newValue}`);
  };

  const reminders = contractReminders || [];
  const signed = reminders.filter(c => c.status === 'signed' || c.signed_at);
  const pending = reminders.filter(c => c.status === 'pending' && !c.signed_at);
  const isConverted = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'].includes(lead.lead_state || '');
  const hasPrincipal = lead.contract_signed_at || lead.status === 'Contrato Assinado' || lead.status === 'Ganho' || isConverted || signed.length > 0;
  const totalContratos = Math.max(signed.length, hasPrincipal ? 1 : 0) + contratosAdicionais;

  return (
    <ScrollArea className="h-[62vh]">
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-muted/30 border">
            <p className="text-2xl font-bold">{totalContratos}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-200/30 dark:bg-emerald-950/20 dark:border-emerald-800/30">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{Math.max(signed.length, hasPrincipal ? 1 : 0)}</p>
            <p className="text-[9px] text-muted-foreground">Assinados</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-200/30 dark:bg-amber-950/20 dark:border-amber-800/30">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pending.length}</p>
            <p className="text-[9px] text-muted-foreground">Pendentes</p>
          </div>
        </div>

        {lead.contract_signed_at && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-lg">
            <Check className="w-3.5 h-3.5" />
            Assinado em {format(new Date(lead.contract_signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}

        {reminders.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documentos</h4>
            {reminders.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.document_name || c.document_key}</p>
                  {c.signer_name && <p className="text-[10px] text-muted-foreground mt-0.5">{c.signer_name}</p>}
                </div>
                <Badge variant="secondary" className={cn("text-[9px] shrink-0",
                  c.signed_at || c.status === 'signed'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}>
                  {c.signed_at || c.status === 'signed' ? 'Assinado' : 'Pendente'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contratos Adicionais</h4>
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => updateContratos(contratosAdicionais - 1)} disabled={contratosAdicionais <= 0 || saving}>
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-2xl font-bold w-12 text-center">{contratosAdicionais}</span>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => updateContratos(contratosAdicionais + 1)} disabled={saving}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Link do Contrato
          </h4>
          {lead.link_contrato ? (
            <a href={lead.link_contrato} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline truncate block">
              {lead.link_contrato}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum link cadastrado</p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

// ============== MAIN MODAL ==============
export function LeadDetailModal({ lead: initialLead, isOpen, onClose, onLeadUpdated }: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState('resumo');
  const [localLead, setLocalLead] = useState<Lead | null>(initialLead);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const navigate = useNavigate();

  // Form state for edit tab — lifted here so save button in footer works
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', status: 'Lead Frio' as LeadStatus,
    origem: 'Outro' as LeadOrigem, tipo_acao: '', valor_causa: '',
    resumo_ia: '', link_contrato: '', fonte_trafego: '',
  });

  // Sync local lead when prop changes
  useEffect(() => {
    if (initialLead) {
      setLocalLead(initialLead);
      setForm({
        nome: initialLead.nome || '',
        telefone: initialLead.telefone || '',
        email: initialLead.email || '',
        status: initialLead.status as LeadStatus || 'Lead Frio',
        origem: (initialLead.origem as LeadOrigem) || 'Outro',
        tipo_acao: initialLead.tipo_acao || '',
        valor_causa: initialLead.valor_causa?.toString() || '',
        resumo_ia: initialLead.resumo_ia || '',
        link_contrato: initialLead.link_contrato || '',
        fonte_trafego: initialLead.fonte_trafego || '',
      });
      setHasChanges(false);
    }
  }, [initialLead?.id, initialLead?.updated_at]);

  useEffect(() => {
    if (isOpen) setActiveTab('resumo');
  }, [initialLead?.id, isOpen]);

  const handleSave = useCallback(async () => {
    if (!localLead) return;
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    setSaving(true);
    const updates: Record<string, any> = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      status: form.status,
      origem: form.origem,
      tipo_acao: form.tipo_acao.trim() || null,
      valor_causa: form.valor_causa ? Number(form.valor_causa) : null,
      resumo_ia: form.resumo_ia.trim() || null,
      link_contrato: form.link_contrato.trim() || null,
      fonte_trafego: form.fonte_trafego.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('leads_juridicos')
      .update(updates)
      .eq('id', localLead.id)
      .select()
      .single();

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }
    setHasChanges(false);
    toast.success('Lead salvo com sucesso');
    if (data) {
      const updated = data as Lead;
      setLocalLead(updated);
      onLeadUpdated?.(updated);
    }
  }, [localLead, form, onLeadUpdated]);

  const updateFormField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (!localLead) return null;

  const lead = localLead;
  const config = STATUS_CONFIG[lead.status || 'Lead Frio'] || STATUS_CONFIG['Lead Frio'];
  const initials = (lead.nome || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl p-0 rounded-2xl overflow-hidden gap-0 max-h-[90vh]">
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(24,21%,28%)] px-6 py-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-13 w-13 ring-2 ring-white/20 shadow-lg">
              <AvatarFallback className="bg-white/15 text-white text-sm font-bold backdrop-blur-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">
                {lead.nome || 'Sem nome'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-[10px] border-0", config.bg, config.text)}>
                  {lead.status}
                </Badge>
                {lead.origem && (
                  <span className="text-xs text-white/60">{lead.origem}</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost" size="icon"
              className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 rounded-lg"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-card h-10 px-4 gap-0">
            <TabsTrigger value="resumo" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1.5 px-3">
              <User className="w-3 h-3" /> Resumo
            </TabsTrigger>
            <TabsTrigger value="info" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1.5 px-3">
              <Pencil className="w-3 h-3" /> Editar
            </TabsTrigger>
            <TabsTrigger value="processos" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1.5 px-3">
              <Scale className="w-3 h-3" /> Processos
            </TabsTrigger>
            <TabsTrigger value="contratos" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1.5 px-3">
              <FileSignature className="w-3 h-3" /> Contratos
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs h-8 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none gap-1.5 px-3">
              <History className="w-3 h-3" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-0 flex-1">
            <ResumoTab lead={lead} />
          </TabsContent>

          <TabsContent value="info" className="mt-0 flex-1">
            <ScrollArea className="h-[62vh]">
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs font-medium">Nome *</Label>
                    <Input value={form.nome} onChange={e => updateFormField('nome', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Telefone</Label>
                    <Input value={form.telefone} onChange={e => updateFormField('telefone', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Email</Label>
                    <Input value={form.email} onChange={e => updateFormField('email', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Status</Label>
                    <Select value={form.status} onValueChange={v => { setForm(prev => ({ ...prev, status: v as LeadStatus })); setHasChanges(true); }}>
                      <SelectTrigger className="h-9 text-sm rounded-lg mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Origem</Label>
                    <Select value={form.origem} onValueChange={v => { setForm(prev => ({ ...prev, origem: v as LeadOrigem })); setHasChanges(true); }}>
                      <SelectTrigger className="h-9 text-sm rounded-lg mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Tipo de Ação</Label>
                    <Input value={form.tipo_acao} onChange={e => updateFormField('tipo_acao', e.target.value)} className="h-9 text-sm rounded-lg mt-1" placeholder="Ex: Trabalhista" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Valor da Causa (R$)</Label>
                    <Input type="number" value={form.valor_causa} onChange={e => updateFormField('valor_causa', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Fonte de Tráfego</Label>
                    <Input value={form.fonte_trafego} onChange={e => updateFormField('fonte_trafego', e.target.value)} className="h-9 text-sm rounded-lg mt-1" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium">Link do Contrato</Label>
                    <Input value={form.link_contrato} onChange={e => updateFormField('link_contrato', e.target.value)} className="h-9 text-sm rounded-lg mt-1" placeholder="https://..." />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium">Resumo / Anotações</Label>
                    <Textarea value={form.resumo_ia} onChange={e => updateFormField('resumo_ia', e.target.value)} className="min-h-[80px] text-sm rounded-lg mt-1" />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="processos" className="mt-0 flex-1">
            <ProcessosTab lead={lead} />
          </TabsContent>
          <TabsContent value="contratos" className="mt-0 flex-1">
            <ContratosTab lead={lead} />
          </TabsContent>
          <TabsContent value="historico" className="mt-0 flex-1">
            <div className="p-1">
              <LeadHistoryTimeline leadId={lead.id} telefone={lead.telefone} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer with Save */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
          <span className="text-[10px] text-muted-foreground">
            ID: {lead.id.slice(0, 8)}
          </span>
          <div className="flex items-center gap-2">
            {(activeTab === 'info' && hasChanges) && (
              <Button
                onClick={handleSave}
                disabled={saving || !form.nome.trim()}
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg" onClick={() => navigate(`/leads/${lead.id}`)}>
              <ExternalLink className="h-3 w-3" /> Ficha Completa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
