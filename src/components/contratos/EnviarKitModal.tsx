import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileSignature, Send, Loader2, CheckCircle2, User, Search,
  FileText, Scale, Building2, AlertCircle, ExternalLink, ChevronLeft,
  PenLine, Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  estado_civil: string | null;
  profissao: string | null;
  nacionalidade: string | null;
}

interface DadosCliente {
  id?: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  rg: string;
  endereco: string;
  numero: string;
  bairro: string;
  cep: string;
  estado_civil: string;
  profissao: string;
  nacionalidade: string;
}

interface EnviarKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedLead?: Lead | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const BANCOS = [
  'BANCO BRADESCO S/A',
  'BANCO DO BRASIL S/A',
  'CAIXA ECONÔMICA FEDERAL',
  'ITAÚ UNIBANCO S/A',
  'SANTANDER (BRASIL) S/A',
  'BANCO BMG S/A',
  'BANCO PAN S/A',
  'BANCO SAFRA S/A',
  'BANCO MERCANTIL DO BRASIL S/A',
  'BANCO DAYCOVAL S/A',
  'BANCO C6 S/A',
  'BANCO INTER S/A',
  'OUTRO',
];

const KIT_DOCS = [
  { icon: Scale,         label: 'Contrato de Honorários',        desc: '40% sobre êxito' },
  { icon: FileSignature, label: 'Procuração',                     desc: 'Ad Judicia et Extra' },
  { icon: FileText,      label: 'Declaração de Hipossuficiência', desc: 'Gratuidade de justiça' },
  { icon: AlertCircle,   label: 'Declaração Golpe Falso Advogado', desc: 'Orientação sobre fraudes' },
];

const DADOS_VAZIOS: DadosCliente = {
  nome: '', email: '', telefone: '', cpf: '', rg: '',
  endereco: '', numero: '', bairro: '', cep: '',
  estado_civil: '', profissao: '', nacionalidade: 'brasileiro(a)',
};

type Step = 'cliente' | 'banco' | 'revisao' | 'enviando' | 'sucesso';
type Origem = 'sistema' | 'manual';

// ─── Componente principal ─────────────────────────────────────────────────────
export function EnviarKitModal({ isOpen, onClose, onSuccess, preSelectedLead }: EnviarKitModalProps) {
  const { toast } = useToast();

  // Steps
  const [step, setStep] = useState<Step>('cliente');
  const [origem, setOrigem] = useState<Origem>('sistema');

  // Dados do sistema
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Dados manuais
  const [manual, setManual] = useState<DadosCliente>(DADOS_VAZIOS);

  // Banco e envio
  const [bancoReu, setBancoReu] = useState('');
  const [bancoCustom, setBancoCustom] = useState('');
  const [authType, setAuthType] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [resultLinks, setResultLinks] = useState<{ nome: string; signLink: string }[]>([]);

  // ── Buscar leads ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setLoadingLeads(true);
    supabase
      .from('leads_juridicos')
      .select('id, nome, email, telefone, cpf, rg, endereco, numero, bairro, cep, cidade, uf, estado_civil, profissao, nacionalidade')
      .order('nome')
      .then(({ data }) => { setLeads(data || []); setLoadingLeads(false); });
  }, [isOpen]);

  // ── Pré-selecionar lead ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && preSelectedLead) {
      setSelectedLead(preSelectedLead);
      setOrigem('sistema');
      setStep('banco');
    }
  }, [isOpen, preSelectedLead]);

  // ── Reset ao fechar ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setStep('cliente');
      setOrigem('sistema');
      setSelectedLead(null);
      setManual(DADOS_VAZIOS);
      setBancoReu('');
      setBancoCustom('');
      setSearch('');
      setResultLinks([]);
    }
  }, [isOpen]);

  // ── Dados consolidados do cliente ───────────────────────────────────────────
  const dadosCliente: DadosCliente = origem === 'sistema' && selectedLead
    ? {
        id: selectedLead.id,
        nome: selectedLead.nome || '',
        email: selectedLead.email || '',
        telefone: selectedLead.telefone || '',
        cpf: selectedLead.cpf || '',
        rg: selectedLead.rg || '',
        endereco: selectedLead.endereco || '',
        numero: selectedLead.numero || '',
        bairro: selectedLead.bairro || '',
        cep: selectedLead.cep || '',
        estado_civil: selectedLead.estado_civil || '',
        profissao: selectedLead.profissao || '',
        nacionalidade: selectedLead.nacionalidade || 'brasileiro(a)',
      }
    : manual;

  const bancoFinal = bancoReu === 'OUTRO' ? bancoCustom.trim() : bancoReu;

  // ── Validações por step ─────────────────────────────────────────────────────
  const clienteOk =
    origem === 'sistema'
      ? !!selectedLead
      : !!manual.nome.trim() && !!manual.email.trim();

  const filteredLeads = leads.filter(l => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (l.nome || '').toLowerCase().includes(s) ||
      (l.email || '').toLowerCase().includes(s) ||
      (l.telefone || '').includes(s)
    );
  });

  // ── Enviar o kit ────────────────────────────────────────────────────────────
  const handleEnviar = async () => {
    if (!bancoFinal) return;
    setStep('enviando');
    try {
      const { data, error } = await supabase.functions.invoke('generate-kit', {
        body: {
          lead: {
            id: dadosCliente.id,
            nome: dadosCliente.nome,
            email: dadosCliente.email,
            telefone: dadosCliente.telefone,
            cpf: dadosCliente.cpf,
            rg: dadosCliente.rg,
            endereco: dadosCliente.endereco,
            numero: dadosCliente.numero,
            bairro: dadosCliente.bairro,
            cep: dadosCliente.cep,
            estado_civil: dadosCliente.estado_civil,
            profissao: dadosCliente.profissao,
            nacionalidade: dadosCliente.nacionalidade,
            banco_reu: bancoFinal,
          },
          signatario: {
            nome: dadosCliente.nome,
            email: dadosCliente.email,
            telefone: dadosCliente.telefone,
            cpf: dadosCliente.cpf,
            auth_type: authType,
          },
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || 'Erro ao enviar kit');

      setResultLinks(data.documentos || []);
      setStep('sucesso');
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar kit', description: err.message, variant: 'destructive' });
      setStep('revisao');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">

        {/* Header */}
        <div className="bg-[#3d2b1f] px-5 py-4 flex items-center gap-3">
          {step !== 'cliente' && step !== 'enviando' && step !== 'sucesso' && (
            <button
              onClick={() => setStep(step === 'revisao' ? 'banco' : 'cliente')}
              className="text-[#c9a96e]/60 hover:text-[#c9a96e] transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            <DialogTitle className="flex items-center gap-2 text-[#c9a96e] text-base">
              <FileSignature className="h-4 w-4" />
              Enviar Kit Bancário
            </DialogTitle>
            <p className="text-xs text-[#c9a96e]/50 mt-0.5">
              {step === 'cliente'  && 'Passo 1 — Informe o cliente'}
              {step === 'banco'    && 'Passo 2 — Informe o banco réu'}
              {step === 'revisao'  && 'Passo 3 — Revise antes de enviar'}
              {step === 'enviando' && 'Gerando documentos...'}
              {step === 'sucesso'  && `${resultLinks.length} documentos enviados com sucesso`}
            </p>
          </div>
          {!['enviando', 'sucesso'].includes(step) && (
            <div className="flex items-center gap-1.5">
              {(['cliente', 'banco', 'revisao'] as Step[]).map(s => (
                <div key={s} className={cn('h-1.5 rounded-full transition-all', step === s ? 'w-5 bg-[#c9a96e]' : 'w-1.5 bg-[#c9a96e]/30')} />
              ))}
            </div>
          )}
        </div>

        <div className="min-h-[420px]">

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 1 — Cliente                                               */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 'cliente' && (
            <div className="p-5 space-y-4">

              {/* Toggle sistema / manual */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl">
                <button
                  onClick={() => setOrigem('sistema')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                    origem === 'sistema'
                      ? 'bg-[#3d2b1f] text-[#c9a96e] shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Users className="h-4 w-4" />
                  Buscar no sistema
                </button>
                <button
                  onClick={() => setOrigem('manual')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
                    origem === 'manual'
                      ? 'bg-[#3d2b1f] text-[#c9a96e] shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <PenLine className="h-4 w-4" />
                  Preencher manual
                </button>
              </div>

              {/* ── Buscar no sistema ── */}
              {origem === 'sistema' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou telefone..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9 border-[#c9a96e]/20 focus-visible:ring-[#c9a96e]/30"
                    />
                  </div>
                  <ScrollArea className="h-[260px]">
                    {loadingLeads ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredLeads.length === 0 ? (
                      <div className="flex flex-col items-center py-10 gap-2">
                        <User className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                        <button onClick={() => setOrigem('manual')} className="text-xs text-[#c9a96e] hover:underline">
                          Preencher manualmente →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 pr-2">
                        {filteredLeads.map(lead => (
                          <button
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            className={cn(
                              'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                              'hover:border-[#c9a96e]/40 hover:bg-[#c9a96e]/5',
                              selectedLead?.id === lead.id
                                ? 'border-[#c9a96e] bg-[#c9a96e]/10'
                                : 'border-border'
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-[#c9a96e]/10 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-[#c9a96e]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{lead.nome || 'Sem nome'}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {lead.email || '—'}{lead.telefone ? ` • ${lead.telefone}` : ''}
                                </p>
                              </div>
                              {selectedLead?.id === lead.id && (
                                <CheckCircle2 className="h-4 w-4 text-[#c9a96e] ml-auto shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* ── Preencher manual ── */}
              {origem === 'manual' && (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3 pr-2">
                    {/* Nome e Email */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome completo *</Label>
                        <Input
                          placeholder="Nome do cliente"
                          value={manual.nome}
                          onChange={e => setManual(p => ({ ...p, nome: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          placeholder="email@exemplo.com"
                          value={manual.email}
                          onChange={e => setManual(p => ({ ...p, email: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Telefone e CPF */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Telefone</Label>
                        <Input
                          placeholder="(92) 99999-9999"
                          value={manual.telefone}
                          onChange={e => setManual(p => ({ ...p, telefone: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">CPF</Label>
                        <Input
                          placeholder="000.000.000-00"
                          value={manual.cpf}
                          onChange={e => setManual(p => ({ ...p, cpf: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* RG e Estado civil */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">RG</Label>
                        <Input
                          placeholder="0000000-0"
                          value={manual.rg}
                          onChange={e => setManual(p => ({ ...p, rg: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Estado civil</Label>
                        <Input
                          placeholder="solteiro(a)"
                          value={manual.estado_civil}
                          onChange={e => setManual(p => ({ ...p, estado_civil: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Profissão e Nacionalidade */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Profissão</Label>
                        <Input
                          placeholder="aposentado(a)"
                          value={manual.profissao}
                          onChange={e => setManual(p => ({ ...p, profissao: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nacionalidade</Label>
                        <Input
                          value={manual.nacionalidade}
                          onChange={e => setManual(p => ({ ...p, nacionalidade: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Endereço */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Endereço (rua)</Label>
                      <Input
                        placeholder="Rua das Flores"
                        value={manual.endereco}
                        onChange={e => setManual(p => ({ ...p, endereco: e.target.value }))}
                        className="border-[#c9a96e]/20 h-9 text-sm"
                      />
                    </div>

                    {/* Número, Bairro, CEP */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nº</Label>
                        <Input
                          placeholder="123"
                          value={manual.numero}
                          onChange={e => setManual(p => ({ ...p, numero: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bairro</Label>
                        <Input
                          placeholder="Centro"
                          value={manual.bairro}
                          onChange={e => setManual(p => ({ ...p, bairro: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">CEP</Label>
                        <Input
                          placeholder="69000-000"
                          value={manual.cep}
                          onChange={e => setManual(p => ({ ...p, cep: e.target.value }))}
                          className="border-[#c9a96e]/20 h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}

              {/* Botão avançar */}
              <Button
                className="w-full bg-[#3d2b1f] hover:bg-[#5c3d2e] text-[#c9a96e] border border-[#c9a96e]/30"
                disabled={!clienteOk}
                onClick={() => setStep('banco')}
              >
                Próximo — Escolher banco →
              </Button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 2 — Banco réu                                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 'banco' && (
            <div className="p-5 space-y-5">

              {/* Card do cliente selecionado */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/20">
                <div className="h-9 w-9 rounded-full bg-[#3d2b1f]/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-[#3d2b1f]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{dadosCliente.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{dadosCliente.email}</p>
                </div>
                <button onClick={() => setStep('cliente')} className="text-xs text-[#c9a96e] hover:underline shrink-0">
                  Trocar
                </button>
              </div>

              {/* Banco */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#c9a96e]" />
                  Banco / Instituição Ré *
                </Label>
                <Select value={bancoReu} onValueChange={setBancoReu}>
                  <SelectTrigger className="border-[#c9a96e]/20 focus:ring-[#c9a96e]/30">
                    <SelectValue placeholder="Selecione o banco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                {bancoReu === 'OUTRO' && (
                  <Input
                    placeholder="Nome completo do banco em maiúsculas..."
                    value={bancoCustom}
                    onChange={e => setBancoCustom(e.target.value.toUpperCase())}
                    className="border-[#c9a96e]/20"
                  />
                )}
              </div>

              {/* Autenticação */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Como o cliente vai se autenticar?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'email' as const,    label: '📧 Email' },
                    { value: 'whatsapp' as const, label: '💬 WhatsApp' },
                    { value: 'sms' as const,      label: '📱 SMS' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAuthType(opt.value)}
                      className={cn(
                        'py-2.5 rounded-lg border text-xs font-medium transition-all',
                        authType === opt.value
                          ? 'border-[#c9a96e] bg-[#c9a96e]/10 text-[#3d2b1f]'
                          : 'border-border text-muted-foreground hover:border-[#c9a96e]/30'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full bg-[#3d2b1f] hover:bg-[#5c3d2e] text-[#c9a96e] border border-[#c9a96e]/30"
                disabled={!bancoFinal}
                onClick={() => setStep('revisao')}
              >
                Revisar →
              </Button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP 3 — Revisão                                               */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 'revisao' && (
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-[#c9a96e]/20 overflow-hidden">
                <div className="bg-[#c9a96e]/8 px-4 py-2.5 border-b border-[#c9a96e]/15">
                  <p className="text-[11px] font-semibold text-[#3d2b1f] uppercase tracking-wider">Resumo do Envio</p>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { label: 'Cliente',      value: dadosCliente.nome },
                    { label: 'Email',        value: dadosCliente.email },
                    { label: 'Telefone',     value: dadosCliente.telefone || '—' },
                    { label: 'CPF',          value: dadosCliente.cpf || '—' },
                    { label: 'Banco réu',    value: bancoFinal },
                    { label: 'Autenticação', value: authType },
                  ].map(row => (
                    <div key={row.label} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs pt-0.5">{row.label}</span>
                      <span className="font-medium break-all">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Documentos que serão gerados
                </p>
                {KIT_DOCS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#c9a96e]/5 border border-[#c9a96e]/10">
                    <Icon className="h-4 w-4 text-[#c9a96e] shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full bg-gradient-to-r from-[#3d2b1f] to-[#5c3d2e] hover:from-[#5c3d2e] hover:to-[#3d2b1f] text-[#c9a96e] border border-[#c9a96e]/30"
                onClick={handleEnviar}
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar Kit para Assinatura
              </Button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP — Enviando                                                 */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 'enviando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="h-20 w-20 rounded-full bg-[#c9a96e]/10 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-[#c9a96e] animate-spin" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-semibold text-base">Gerando os documentos...</p>
                <p className="text-sm text-muted-foreground">Preenchendo e enviando {KIT_DOCS.length} documentos para o Clicksign</p>
                <p className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* STEP — Sucesso                                                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {step === 'sucesso' && (
            <div className="p-5 space-y-4">
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">Kit enviado com sucesso!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {resultLinks.length} documentos criados para{' '}
                    <strong>{dadosCliente.nome.split(' ')[0]}</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {resultLinks.map(({ nome, signLink }) => (
                  <a
                    key={nome}
                    href={signLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#c9a96e]/20 hover:bg-[#c9a96e]/5 hover:border-[#c9a96e]/40 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 text-[#c9a96e] shrink-0" />
                      <span className="text-sm font-medium truncate">{nome}</span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-[#c9a96e] shrink-0 ml-2" />
                  </a>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 border-[#c9a96e]/20"
                  onClick={() => { setStep('cliente'); setSelectedLead(null); setManual(DADOS_VAZIOS); setBancoReu(''); setResultLinks([]); }}
                >
                  Enviar outro kit
                </Button>
                <Button
                  className="flex-1 bg-[#3d2b1f] text-[#c9a96e] border border-[#c9a96e]/30 hover:bg-[#5c3d2e]"
                  onClick={onClose}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
