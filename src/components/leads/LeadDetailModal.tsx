import { useState, useEffect, useMemo } from 'react';
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
import { useLeads } from '@/hooks/useLeads';
import { LeadHistoryTimeline } from './LeadHistoryTimeline';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
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

// ============== RESUMO TAB ==============
function ResumoTab({ lead }: { lead: Lead }) {
  const { data: contractReminders } = useLeadContracts(lead.id);
  const { data: processosData } = useLeadProcessos(lead.id);
  const navigate = useNavigate();

  const config = STATUS_CONFIG[lead.status || 'Lead Frio'] || STATUS_CONFIG['Lead Frio'];
  const processoCount = processosData?.processos.length || 0;
  const reminders = contractReminders || [];
  const signedCount = reminders.filter(c => c.status === 'signed' || c.signed_at).length;
  const hasContract = lead.contract_signed_at || lead.status === 'Contrato Assinado' || lead.status === 'Ganho' || signedCount > 0;

  const whatsappLink = lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, '')}` : null;

  return (
    <ScrollArea className="h-[65vh]">
      <div className="p-5 space-y-5">
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {whatsappLink && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg border-[hsl(var(--success))]/30 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/5" asChild>
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
            <div className="text-center p-2 rounded-lg bg-card border">
              <p className="text-lg font-bold text-foreground">{processoCount}</p>
              <p className="text-[9px] text-muted-foreground">Processos</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-card border">
              <p className={cn("text-lg font-bold", hasContract ? "text-[hsl(var(--success))]" : "text-muted-foreground")}>
                {Math.max(signedCount, hasContract ? 1 : 0)}
              </p>
              <p className="text-[9px] text-muted-foreground">Contratos</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-card border">
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
                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
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
            {lead.tipo_origem === 'trafego' && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">📣 Tráfego</Badge>}
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
              <span className="font-medium text-[hsl(var(--success))]">{formatCurrency(lead.valor_causa)}</span>
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
function InfoEditTab({ lead }: { lead: Lead }) {
  const { updateLead } = useLeads();
  const [saving, setSaving] = useState(false);
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
    setForm({
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
  }, [lead.id]);

  const handleSave = async () => {
    setSaving(true);
    await updateLead(lead.id, {
      ...form,
      valor_causa: form.valor_causa ? Number(form.valor_causa) : null,
    } as any);
    setSaving(false);
    toast.success('Lead atualizado');
  };

  return (
    <ScrollArea className="h-[65vh]">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Nome *</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as LeadStatus })}>
              <SelectTrigger className="h-9 text-sm rounded-lg mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={form.origem} onValueChange={v => setForm({ ...form, origem: v as LeadOrigem })}>
              <SelectTrigger className="h-9 text-sm rounded-lg mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de Ação</Label>
            <Input value={form.tipo_acao} onChange={e => setForm({ ...form, tipo_acao: e.target.value })} className="h-9 text-sm rounded-lg mt-1" placeholder="Ex: Trabalhista" />
          </div>
          <div>
            <Label className="text-xs">Valor da Causa</Label>
            <Input type="number" value={form.valor_causa} onChange={e => setForm({ ...form, valor_causa: e.target.value })} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div>
            <Label className="text-xs">Fonte de Tráfego</Label>
            <Input value={form.fonte_trafego} onChange={e => setForm({ ...form, fonte_trafego: e.target.value })} className="h-9 text-sm rounded-lg mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Link do Contrato</Label>
            <Input value={form.link_contrato} onChange={e => setForm({ ...form, link_contrato: e.target.value })} className="h-9 text-sm rounded-lg mt-1" placeholder="https://..." />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Resumo / Anotações</Label>
            <Textarea value={form.resumo_ia} onChange={e => setForm({ ...form, resumo_ia: e.target.value })} className="min-h-[80px] text-sm rounded-lg mt-1" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !form.nome.trim()} className="w-full h-10 gap-2 rounded-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
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
    <ScrollArea className="h-[65vh]">
      <div className="p-5 space-y-4">
        {/* Header with count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{processos.length} Processo{processos.length !== 1 ? 's' : ''}</span>
            {autoLinked > 0 && (
              <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700">
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
    <ScrollArea className="h-[65vh]">
      <div className="p-5 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-muted/30 border">
            <p className="text-2xl font-bold">{totalContratos}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-stage-ganho-bg border border-stage-ganho/10">
            <p className="text-2xl font-bold text-[hsl(var(--success))]">{Math.max(signed.length, hasPrincipal ? 1 : 0)}</p>
            <p className="text-[9px] text-muted-foreground">Assinados</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-200/30">
            <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-[9px] text-muted-foreground">Pendentes</p>
          </div>
        </div>

        {lead.contract_signed_at && (
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--success))] bg-stage-ganho-bg p-2.5 rounded-lg">
            <Check className="w-3.5 h-3.5" />
            Assinado em {format(new Date(lead.contract_signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}

        {/* Contract list */}
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
                  c.signed_at || c.status === 'signed' ? 'bg-stage-ganho-bg text-stage-ganho' : 'bg-amber-100 text-amber-700'
                )}>
                  {c.signed_at || c.status === 'signed' ? 'Assinado' : 'Pendente'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Manual adjustment */}
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

        {/* Contract Link */}
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
export function LeadDetailModal({ lead, isOpen, onClose }: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState('resumo');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) setActiveTab('resumo');
  }, [lead?.id, isOpen]);

  if (!lead) return null;

  const config = STATUS_CONFIG[lead.status || 'Lead Frio'] || STATUS_CONFIG['Lead Frio'];
  const initials = (lead.nome || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl p-0 rounded-2xl overflow-hidden gap-0 max-h-[90vh]">
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(24,21%,28%)] px-6 py-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 ring-2 ring-white/20 shadow-lg">
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
            <InfoEditTab lead={lead} />
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

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/20">
          <span className="text-[10px] text-muted-foreground">
            ID: {lead.id.slice(0, 8)}
          </span>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg" onClick={() => navigate(`/leads/${lead.id}`)}>
            <ExternalLink className="h-3 w-3" /> Ficha Completa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
