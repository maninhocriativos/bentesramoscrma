import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trash2, Loader2, Users, BadgeCheck, RefreshCw, MessageSquare,
  Building2, Scale, Calendar, DollarSign, Plus, X,
  FileText, Bell, Hash, FolderOpen, Shield, Pencil, ChevronRight,
  CheckCircle2, Search, Tag, UserPlus, AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Processo, ProcessoStatus, ProcessoParte, ProcessoMovimento } from '@/types/processos';
import { LeadName } from '@/hooks/useLeadNames';
import { useProcessos } from '@/hooks/useProcessos';
import { ProcessoNotificacaoConfig } from './ProcessoNotificacaoConfig';
import { ProcessoNotificacoesTab } from './ProcessoNotificacoesTab';
import { MovimentoDetailModal } from './MovimentoDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { enrichMovements, MovimentoEnriquecido, getCategoriaColor } from '@/lib/cnjMovimentosMap';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProcessoModalExpandedProps {
  processo: Processo | null;
  isOpen: boolean;
  onClose: () => void;
  isNew?: boolean;
  canDelete?: boolean;
  leads: LeadName[];
}

type ProcessoFormData = {
  numero_processo: string; numero_complementar: string; titulo_acao: string;
  status: ProcessoStatus; advogado_responsavel: string; cliente_id: string;
  cpf_cliente: string; tribunal: string; vara_comarca: string; assunto: string;
  valor_causa: string; orgao_julgador: string; grau: string; origem_cliente: string;
  descricao: string; marcadores: string; area: string; fase: string;
  classe_cnj: string; assunto_cnj: string; segredo_justica: boolean;
  data_distribuicao: string; data_citacao: string; data_recebimento: string;
  data_arquivamento: string; data_encerramento: string; valor_provisionado: string;
  probabilidade: string; monitorar_push: boolean; tipo_orgao_julgador: string;
  sistema_judicial: string; complemento_enderecamento: string;
};

interface ProcessoModalDraft {
  formData: ProcessoFormData;
  partes: ProcessoParte[];
  movimentos: ProcessoMovimento[];
  updatedAt: string;
}

interface Assunto { id: string; nome: string; categoria?: string; }

const STATUSES: ProcessoStatus[] = ['Em Andamento', 'Suspenso', 'Arquivado', 'Ganho', 'Perdido'];
const CNJ_REGEX    = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
const DRAFT_PREFIX = 'processo_modal_draft_v1';
const DRAFT_MAX_AGE = 1000 * 60 * 60 * 24;

const createEmptyForm = (): ProcessoFormData => ({
  numero_processo: '', numero_complementar: '', titulo_acao: '',
  status: 'Em Andamento', advogado_responsavel: '', cliente_id: '',
  cpf_cliente: '', tribunal: '', vara_comarca: '', assunto: '',
  valor_causa: '', orgao_julgador: '', grau: '', origem_cliente: '',
  descricao: '', marcadores: '', area: '', fase: '', classe_cnj: '',
  assunto_cnj: '', segredo_justica: false, data_distribuicao: '',
  data_citacao: '', data_recebimento: '', data_arquivamento: '',
  data_encerramento: '', valor_provisionado: '', probabilidade: '',
  monitorar_push: true, tipo_orgao_julgador: '', sistema_judicial: '',
  complemento_enderecamento: '',
});

const STATUS_CONFIG: Record<string, { cls: string; dot: string }> = {
  'Em Andamento': { cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40', dot: 'bg-blue-500' },
  'Ganho':        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
  'Perdido':      { cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300', dot: 'bg-red-500' },
  'Suspenso':     { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300', dot: 'bg-amber-500' },
  'Arquivado':    { cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

const parseMoney = (v: string): number | null => {
  if (!v || v.trim() === '') return null;
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

const parseDate = (v: string): string | null => {
  if (!v || v.trim() === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const pt = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`;
  try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch { /**/ }
  return null;
};

const normalizarCNJ = (numero: string | null | undefined): string | null => {
  if (!numero) return null;
  const digits = numero.replace(/[^\d]/g, '');
  return digits.length === 20 ? digits : null;
};

const extractFromProc = (proc: any) => ({
  classe:        proc.classe        || proc.titulo_acao   || proc.classeNome   || '',
  tribunal:      proc.tribunal      || proc.sigla_tribunal || '',
  orgaoJulgador: proc.orgaoJulgador || proc.orgao_julgador || proc.vara_comarca || proc.orgao || '',
  grau:          proc.grau          || proc.grauFormatado  || '',
  assunto:       proc.assuntos?.[0]?.nome || proc.assunto || '',
  assuntoCnj:    proc.assuntos?.[0]?.codigo?.toString() || proc.assunto_cnj || '',
  classeCnj:     proc.classe        || proc.classeCodigo   || '',
  valorCausa:    proc.valorCausa    || proc.valor_causa    || null,
  dataDistrib:   proc.dataDistribuicao || proc.data_distribuicao || proc.dataAjuizamento || '',
});

// ─── AssuntoPickerModal ────────────────────────────────────────────────────────

function AssuntoPickerModal({ isOpen, onClose, currentValue, onSelect }: {
  isOpen: boolean; onClose: () => void; currentValue: string; onSelect: (v: string) => void;
}) {
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [search, setSearch] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaCateg, setNovaCateg] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    supabase.from('assuntos_processo').select('*').order('categoria').order('nome')
      .then(({ data }) => { setAssuntos(data || []); setLoading(false); });
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search.trim()) return assuntos;
    const s = search.toLowerCase();
    return assuntos.filter(a => a.nome.toLowerCase().includes(s) || a.categoria?.toLowerCase().includes(s));
  }, [assuntos, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Assunto[]> = {};
    filtered.forEach(a => { const cat = a.categoria || 'Outros'; if (!map[cat]) map[cat] = []; map[cat].push(a); });
    return map;
  }, [filtered]);

  const handleSaveNovo = async () => {
    if (!novoNome.trim()) { toast.error('Informe o nome do assunto'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('assuntos_processo')
      .insert({ nome: novoNome.trim(), categoria: novaCateg.trim() || null }).select().single();
    if (error) { toast.error('Erro ao salvar', { description: error.message }); }
    else { setAssuntos(prev => [...prev, data as Assunto].sort((a, b) => a.nome.localeCompare(b.nome))); onSelect((data as Assunto).nome); setNovoNome(''); setNovaCateg(''); toast.success('Assunto cadastrado!'); onClose(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('assuntos_processo').delete().eq('id', id);
    setAssuntos(prev => prev.filter(a => a.id !== id));
    toast.success('Assunto removido');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl flex flex-col p-0" style={{ maxHeight: '85vh', height: '85vh' }}>
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4 text-primary" /> Selecionar Assunto</DialogTitle>
        </DialogHeader>
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar assunto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" autoFocus />
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0 px-5" style={{ height: 'calc(85vh - 240px)' }}>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          : Object.keys(grouped).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum assunto encontrado</p>
          : (
            <div className="space-y-4 pb-4">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</p>
                  <div className="space-y-1">
                    {items.map(a => (
                      <div key={a.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group ${currentValue === a.nome ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-muted/50 border border-transparent'}`} onClick={() => { onSelect(a.nome); onClose(); }}>
                        <span className="text-sm font-medium">{a.nome}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {currentValue === a.nome && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          <button onClick={e => { e.stopPropagation(); handleDelete(a.id); }} className="h-5 w-5 flex items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"><X className="h-3 w-3" /></button>
                        </div>
                        {currentValue === a.nome && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 group-hover:hidden" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="px-5 py-4 border-t shrink-0 space-y-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Plus className="h-3.5 w-3.5 text-primary" /> Cadastrar novo assunto</p>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-muted-foreground">Nome *</Label><Input value={novoNome} onChange={e => setNovoNome(e.target.value)} className="h-8 text-sm rounded-xl mt-1" placeholder="Ex: Bancários > Tarifas" onKeyDown={e => e.key === 'Enter' && handleSaveNovo()} /></div>
            <div><Label className="text-[10px] text-muted-foreground">Categoria</Label><Input value={novaCateg} onChange={e => setNovaCateg(e.target.value)} className="h-8 text-sm rounded-xl mt-1" placeholder="Ex: Bancário" onKeyDown={e => e.key === 'Enter' && handleSaveNovo()} /></div>
          </div>
          <Button className="w-full h-9 rounded-xl" onClick={handleSaveNovo} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Salvar e Selecionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── NovoClienteModal ──────────────────────────────────────────────────────────

function NovoClienteModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (lead: LeadName) => void; }) {
  const [nome, setNome] = useState(''); const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState(''); const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Informe o nome do cliente'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('leads_juridicos')
      .insert({ nome: nome.trim(), telefone: telefone.trim() || null, cpf: cpf.replace(/\D/g, '') || null, email: email.trim() || null, origem: 'CRM' })
      .select('id, nome, telefone').single();
    if (error) { toast.error('Erro ao criar cliente', { description: error.message }); }
    else { toast.success(`Cliente "${nome}" criado!`); onCreated(data as LeadName); setNome(''); setTelefone(''); setCpf(''); setEmail(''); onClose(); }
    setSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-primary" /> Novo Cliente</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Será criado e vinculado a este processo.</p>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          <div><Label className="text-xs text-muted-foreground">Nome completo *</Label><Input value={nome} onChange={e => setNome(e.target.value)} className="h-9 rounded-xl mt-1" placeholder="Nome do cliente" autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Telefone / WhatsApp</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} className="h-9 rounded-xl mt-1" placeholder="(00) 00000-0000" /></div>
            <div><Label className="text-xs text-muted-foreground">CPF</Label>
              <Input value={cpf} onChange={e => { let v = e.target.value.replace(/\D/g, '').slice(0, 11); if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4'); else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3'); else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2'); setCpf(v); }} className="h-9 rounded-xl mt-1" placeholder="000.000.000-00" maxLength={14} />
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">E-mail</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="h-9 rounded-xl mt-1" placeholder="email@exemplo.com" type="email" /></div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />} Criar e Vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label, color = 'text-primary', bg = 'bg-primary/10' }: { icon: React.ElementType; label: string; color?: string; bg?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`h-6 w-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
      <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">{label}</h3>
    </div>
  );
}
function FieldGroup({ children }: { children: React.ReactNode }) { return <div className="bg-muted/20 rounded-2xl p-4 space-y-3 border border-border/30">{children}</div>; }
function Row2({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function Row3({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-3 gap-3">{children}</div>; }
function Row4({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-4 gap-2">{children}</div>; }
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ─── ParteCard — badges truncados, sem overflow ────────────────────────────────

function ParteCard({ parte, index, onUpdate, onRemove }: {
  parte: ProcessoParte; index: number;
  onUpdate: (i: number, field: string, value: string) => void;
  onRemove: (i: number) => void;
}) {
  const tipoLower = (parte.tipo || '').toLowerCase();
  const isAutor = tipoLower.includes('autor');
  const isReu   = tipoLower.includes('réu') || tipoLower.includes('reu');
  const barColor = isAutor ? '#10b981' : isReu ? '#ef4444' : '#94a3b8';
  const badgeCls = isAutor
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
    : isReu
    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400'
    : 'bg-muted text-muted-foreground border-border';

  return (
    <Collapsible>
      <div className="rounded-xl border border-border/40 bg-card overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: barColor }}>
        <div className="p-2.5 pl-3">
          {/* Nome + ações na linha de cima */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <p className="text-xs font-semibold truncate flex-1 min-w-0">{parte.nome}</p>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-primary shrink-0">
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive shrink-0" onClick={() => onRemove(index)}>
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
          {/* Tipo truncado na linha de baixo — evita overflow */}
          <span className={`inline-block max-w-full truncate text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${badgeCls}`}>
            {parte.tipo}
          </span>
          {/* Documento e celular */}
          {(parte.documento || parte.celular) && (
            <div className="flex flex-wrap gap-x-2 mt-1">
              {parte.documento && <span className="text-[10px] text-muted-foreground truncate">Doc: {parte.documento}</span>}
              {parte.celular   && <span className="text-[10px] text-muted-foreground">📱 {parte.celular}</span>}
            </div>
          )}
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-2 border-t border-border/30 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-[10px] text-muted-foreground">Nome</Label><Input value={parte.nome || ''} onChange={e => onUpdate(index, 'nome', e.target.value)} className="h-7 text-xs rounded-lg mt-1" /></div>
              <div><Label className="text-[10px] text-muted-foreground">Tipo</Label>
                <select value={parte.tipo || ''} onChange={e => onUpdate(index, 'tipo', e.target.value)} className="flex h-7 w-full rounded-lg border border-input bg-background px-2 text-xs mt-1">
                  <option value="Autor">Autor</option>
                  <option value="Réu">Réu</option>
                  <option value="Terceiro Interessado">Terceiro</option>
                  <option value="Advogado">Advogado</option>
                  <option value="Exequente">Exequente</option>
                  <option value="Executado">Executado</option>
                  <option value="Requerente">Requerente</option>
                  <option value="Requerido">Requerido</option>
                  <option value="Juiz">Juiz</option>
                </select>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">CPF/CNPJ</Label><Input value={parte.documento || ''} onChange={e => onUpdate(index, 'documento', e.target.value)} className="h-7 text-xs rounded-lg mt-1" placeholder="Opcional" /></div>
              <div><Label className="text-[10px] text-muted-foreground">Celular</Label><Input value={parte.celular || ''} onChange={e => onUpdate(index, 'celular', e.target.value)} className="h-7 text-xs rounded-lg mt-1" placeholder="(00) 00000-0000" /></div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
      {/* Advogados */}
      {parte.advogados && parte.advogados.length > 0 && (
        <div className="ml-3 mt-0.5 mb-1 pl-2.5 border-l-2 border-border/30">
          {parte.advogados.map((adv: any, j: number) => (
            <div key={j} className="flex items-center gap-2 py-0.5 min-w-0">
              <p className="text-[10px] font-medium truncate flex-1 min-w-0">{adv.nome}</p>
              {adv.oab && (
                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                  <BadgeCheck className="h-2.5 w-2.5 text-primary" />
                  <span className="truncate max-w-[80px]">{adv.oab}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Collapsible>
  );
}

function AddParteForm({ onAdd }: { onAdd: (parte: ProcessoParte) => void }) {
  const [nome, setNome] = useState(''); const [tipo, setTipo] = useState('');
  const [doc, setDoc]   = useState(''); const [cel, setCel]   = useState('');
  const handleAdd = () => {
    if (!nome.trim() || !tipo) { toast.error('Preencha nome e tipo'); return; }
    onAdd({ nome: nome.trim(), tipo, polo: tipo === 'Autor' || tipo === 'Requerente' || tipo === 'Exequente' ? 'AT' : tipo === 'Réu' || tipo === 'Requerido' || tipo === 'Executado' ? 'PA' : 'TC', tipoPessoa: 'FISICA', documento: doc || undefined, celular: cel || undefined });
    setNome(''); setTipo(''); setDoc(''); setCel('');
    toast.success(`"${nome.trim()}" adicionado`);
  };
  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-3 space-y-2">
      <p className="text-[11px] font-bold text-foreground flex items-center gap-1"><Plus className="h-3 w-3 text-primary" /> Adicionar Parte</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} className="h-7 text-xs rounded-lg mt-1 bg-card" placeholder="Nome" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Tipo *</Label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="flex h-7 w-full rounded-lg border border-input bg-card px-2 text-xs mt-1">
            <option value="">Selecione</option>
            <option value="Autor">Autor</option>
            <option value="Réu">Réu</option>
            <option value="Requerente">Requerente</option>
            <option value="Requerido">Requerido</option>
            <option value="Exequente">Exequente</option>
            <option value="Executado">Executado</option>
            <option value="Terceiro Interessado">Terceiro</option>
            <option value="Advogado">Advogado</option>
          </select>
        </div>
        <div><Label className="text-[10px] text-muted-foreground">CPF/CNPJ</Label><Input value={doc} onChange={e => setDoc(e.target.value)} className="h-7 text-xs rounded-lg mt-1 bg-card" placeholder="Opcional" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Celular</Label><Input value={cel} onChange={e => setCel(e.target.value)} className="h-7 text-xs rounded-lg mt-1 bg-card" placeholder="(00) 00000-0000" /></div>
      </div>
      <Button type="button" size="sm" className="w-full h-7 rounded-xl text-xs gap-1" onClick={handleAdd}><Plus className="h-3 w-3" /> Adicionar</Button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ProcessoModalExpanded({ processo, isOpen, onClose, isNew = false, canDelete = false, leads: leadsInit }: ProcessoModalExpandedProps) {
  const { createProcesso, updateProcesso, deleteProcesso, fetchProcessos } = useProcessos();

  const [formData,          setFormData]          = useState<ProcessoFormData>(createEmptyForm());
  const [partes,            setPartes]            = useState<ProcessoParte[]>([]);
  const [movimentos,        setMovimentos]        = useState<ProcessoMovimento[]>([]);
  const [saving,            setSaving]            = useState(false);
  const [fetchingData,      setFetchingData]      = useState(false);
  const [sendingNotif,      setSendingNotif]      = useState(false);
  const [activeTab,         setActiveTab]         = useState('processo');
  const [selectedMovimento, setSelectedMovimento] = useState<MovimentoEnriquecido | null>(null);
  const [movModalOpen,      setMovModalOpen]      = useState(false);
  const [autoFetchDone,     setAutoFetchDone]     = useState(false);
  const [draftHydrated,     setDraftHydrated]     = useState(false);
  const [lastLoadedId,      setLastLoadedId]      = useState<string | null>(null);
  const [wasNew,            setWasNew]            = useState(isNew);
  const [leads,             setLeads]             = useState<LeadName[]>(leadsInit);
  const [assuntoPickerOpen, setAssuntoPickerOpen] = useState(false);
  const [novoClienteOpen,   setNovoClienteOpen]   = useState(false);

  useEffect(() => { setLeads(leadsInit); }, [leadsInit]);
  const movimentosEnriquecidos = useMemo(() => enrichMovements(movimentos), [movimentos]);
  const update = useCallback((field: keyof ProcessoFormData, value: unknown) => setFormData(prev => ({ ...prev, [field]: value })), []);

  const processoId = processo?.id ?? null;
  const draftKey = useMemo(() => { const k = isNew ? '__new__' : processoId; return k ? `${DRAFT_PREFIX}:${k}` : null; }, [isNew, processoId]);

  const readDraft = useCallback((): ProcessoModalDraft | null => {
    if (!draftKey || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ProcessoModalDraft;
      if (!parsed?.formData) return null;
      if (Date.now() - new Date(parsed.updatedAt || 0).getTime() > DRAFT_MAX_AGE) { window.localStorage.removeItem(draftKey); return null; }
      return parsed;
    } catch { return null; }
  }, [draftKey]);

  const clearDraft = useCallback(() => { if (draftKey && typeof window !== 'undefined') window.localStorage.removeItem(draftKey); }, [draftKey]);

  useEffect(() => {
    if (!isOpen || !draftKey || !draftHydrated) return;
    window.localStorage.setItem(draftKey, JSON.stringify({ formData, partes: isNew ? partes : [], movimentos: isNew ? movimentos : [], updatedAt: new Date().toISOString() }));
  }, [formData, partes, movimentos, draftKey, draftHydrated, isOpen, isNew]);

  useEffect(() => {
    const currentKey = isNew ? '__new__' : processoId;
    const previousKey = wasNew ? '__new__' : lastLoadedId;
    if (currentKey === previousKey) return;
    setDraftHydrated(false); setActiveTab('processo');
    if (processo) {
      const p = processo as any;
      setFormData({
        numero_processo: processo.numero_processo || '', numero_complementar: p.numero_complementar || '',
        titulo_acao: processo.titulo_acao || '', status: (processo.status as ProcessoStatus) || 'Em Andamento',
        advogado_responsavel: processo.advogado_responsavel || '', cliente_id: processo.cliente_id || '',
        cpf_cliente: processo.cpf_cliente || '', tribunal: processo.tribunal || '',
        vara_comarca: processo.vara_comarca || processo.orgao_julgador || '',
        assunto: processo.assunto || '',
        valor_causa: processo.valor_causa ? processo.valor_causa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        orgao_julgador: processo.orgao_julgador || processo.vara_comarca || '', grau: processo.grau || '',
        origem_cliente: p.origem_cliente || '', descricao: p.descricao || '', marcadores: p.marcadores || '',
        area: p.area || '', fase: p.fase || '', classe_cnj: processo.classe_cnj || processo.titulo_acao || '',
        assunto_cnj: p.assunto_cnj || '', segredo_justica: p.segredo_justica || false,
        data_distribuicao: p.data_distribuicao ? p.data_distribuicao.slice(0, 10) : '',
        data_citacao: p.data_citacao ? p.data_citacao.slice(0, 10) : '',
        data_recebimento: p.data_recebimento ? p.data_recebimento.slice(0, 10) : '',
        data_arquivamento: p.data_arquivamento ? p.data_arquivamento.slice(0, 10) : '',
        data_encerramento: p.data_encerramento ? p.data_encerramento.slice(0, 10) : '',
        valor_provisionado: p.valor_provisionado ? String(p.valor_provisionado) : '',
        probabilidade: p.probabilidade || '', monitorar_push: p.monitorar_push ?? true,
        tipo_orgao_julgador: p.tipo_orgao_julgador || '', sistema_judicial: p.sistema_judicial || '',
        complemento_enderecamento: p.complemento_enderecamento || '',
      });
      setPartes(processo.partes_json || []);
      setMovimentos(processo.movimentos_json || []);
    } else { setFormData(createEmptyForm()); setPartes([]); setMovimentos([]); }
    const draft = readDraft();
    if (draft?.formData) {
      setFormData(prev => {
        const merged = { ...prev, ...draft.formData, status: (draft.formData.status as ProcessoStatus) || prev.status };
        if (!isNew && processo) {
          if (!merged.numero_processo && prev.numero_processo) merged.numero_processo = prev.numero_processo;
          if (!merged.titulo_acao && prev.titulo_acao) merged.titulo_acao = prev.titulo_acao;
          if (!merged.cliente_id && prev.cliente_id) merged.cliente_id = prev.cliente_id;
        }
        return merged;
      });
      if (isNew) { setPartes(Array.isArray(draft.partes) ? draft.partes : []); setMovimentos(Array.isArray(draft.movimentos) ? draft.movimentos : []); }
    }
    setLastLoadedId(processoId); setWasNew(isNew); setDraftHydrated(true);
  }, [processo, processoId, isNew, lastLoadedId, wasNew, readDraft]);

  useEffect(() => { setAutoFetchDone(false); }, [processoId]);

  useEffect(() => {
    if (!isNew && isOpen && processo?.id && !autoFetchDone && draftHydrated) {
      setAutoFetchDone(true);
      (async () => {
        try {
          const { data: dbPartes } = await supabase.from('processo_partes').select('*').eq('processo_id', processo.id);
          if (dbPartes && dbPartes.length > 0) {
            setPartes(dbPartes.map((p: any) => ({ nome: p.nome, tipo: p.tipo, polo: p.polo || '', tipoPessoa: p.tipo_pessoa || '', documento: p.documento || '', celular: p.celular || '', telefone_adicional: p.telefone_adicional || '', advogados: Array.isArray(p.advogados) ? p.advogados : [] })));
          } else if (processo.partes_json?.length) {
            setPartes(processo.partes_json);
            await supabase.from('processo_partes').insert(processo.partes_json.map((p: any) => ({ processo_id: processo.id, nome: p.nome, tipo: p.tipo, polo: p.polo || null, tipo_pessoa: p.tipoPessoa || null, documento: p.documento || null, celular: p.celular || null, advogados: p.advogados || null })));
          }
          const { data: dbMov } = await supabase.from('processo_movimentacoes').select('*').eq('processo_id', processo.id).order('data_movimento', { ascending: false }).limit(100);
          if (dbMov?.length) {
            setMovimentos(dbMov.map((m: any) => ({ dataHora: m.data_movimento ? new Date(m.data_movimento).toLocaleDateString('pt-BR') : '', dataHoraRaw: m.data_movimento, nome: m.movimento_titulo || 'Movimentação', complemento: m.movimento_descricao || null, codigo: m.movimento_cnj_codigo ? Number(m.movimento_cnj_codigo) : null })));
          }
        } catch (err) { console.error('Erro ao carregar dados:', err); }
      })();
      const hasValidCnj = processo.numero_processo && CNJ_REGEX.test(processo.numero_processo.trim());
      const isMissingData = !processo.classe_cnj || !processo.orgao_julgador || !processo.assunto_cnj;
      const lastCheck = processo.ultima_consulta_api_at ? new Date(processo.ultima_consulta_api_at).getTime() : 0;
      const isStale = Date.now() - lastCheck > 3 * 24 * 60 * 60 * 1000;
      if (hasValidCnj && (isMissingData || isStale) && !fetchingData) handleRefreshStatus(true);
    }
  }, [processo?.id, isOpen, draftHydrated, autoFetchDone, isNew]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const num = (formData.numero_processo || '').trim();
      if (isNew && CNJ_REGEX.test(num)) fetchProcessoData(num);
    }, 600);
    return () => clearTimeout(timer);
  }, [formData.numero_processo, isNew]);

  const mapStatus = (s: string): ProcessoStatus => {
    const map: Record<string, ProcessoStatus> = { 'Em Andamento': 'Em Andamento', 'Arquivado': 'Arquivado', 'Suspenso': 'Suspenso', 'Transitado em Julgado': 'Arquivado', 'Com Sentença': 'Em Andamento', 'Em Grau Recursal': 'Em Andamento' };
    return map[s] || 'Em Andamento';
  };

  const fetchProcessoData = async (num: string) => {
    if (!CNJ_REGEX.test(num)) return;
    setFetchingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', { body: { numeroProcesso: num } });
      if (error) throw error;
      if (data?.encontrado && data?.processo) {
        const proc = data.processo; const fields = extractFromProc(proc);
        const autor = proc.partes?.find((p: any) => p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT');
        let clienteId = '';
        if (autor?.nome) { const norm = autor.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const match = leads.find(l => { const ln = (l.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return ln.includes(norm) || norm.includes(ln); }); if (match) clienteId = match.id; }
        const adv = autor?.advogados?.[0];
        setFormData(prev => ({ ...prev, titulo_acao: fields.classe || prev.titulo_acao, status: mapStatus(proc.status), cliente_id: clienteId || prev.cliente_id, advogado_responsavel: adv ? (adv.oab ? `${adv.nome} (${adv.oab})` : adv.nome) : prev.advogado_responsavel, tribunal: fields.tribunal || prev.tribunal, orgao_julgador: fields.orgaoJulgador || prev.orgao_julgador, vara_comarca: fields.orgaoJulgador || prev.vara_comarca, grau: fields.grau || prev.grau, assunto: fields.assunto || prev.assunto, assunto_cnj: fields.assuntoCnj || prev.assunto_cnj, classe_cnj: fields.classeCnj || prev.classe_cnj, valor_causa: fields.valorCausa?.toString() || prev.valor_causa, data_distribuicao: fields.dataDistrib ? fields.dataDistrib.slice(0, 10) : prev.data_distribuicao }));
        if (proc.partes?.length) setPartes(proc.partes);
        if (proc.movimentos?.length) setMovimentos(proc.movimentos.slice(0, 100));
        toast.success('Dados carregados!', { description: fields.classe || proc.tribunal });
      } else { toast.error('Processo não encontrado', { description: data?.mensagem }); }
    } catch { toast.error('Erro ao buscar no DataJud'); }
    finally { setFetchingData(false); }
  };

  const handleRefreshStatus = async (silent = false) => {
    const num = (formData.numero_processo || '').trim();
    if (!num || !CNJ_REGEX.test(num)) { if (!silent) toast.error('Número CNJ inválido'); return; }
    setFetchingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', { body: { numeroProcesso: num, force_refresh: true, persistir: true, processo_id: processo?.id || null } });
      if (error) throw error;
      if (data?.encontrado && data?.processo) {
        const proc = data.processo; const fields = extractFromProc(proc);
        const toDate = (v?: string | null): string => { if (!v) return ''; if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); const pt = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`; try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch { /**/ } return ''; };
        const newPartes = proc.partes || []; const newMovs = (proc.movimentos || []).slice(0, 100);
        setPartes(newPartes); setMovimentos(newMovs);
        setFormData(prev => ({ ...prev, titulo_acao: fields.classe || prev.titulo_acao, status: mapStatus(proc.status), tribunal: fields.tribunal || prev.tribunal, orgao_julgador: fields.orgaoJulgador || prev.orgao_julgador, vara_comarca: fields.orgaoJulgador || prev.vara_comarca, grau: fields.grau || prev.grau, assunto: fields.assunto || prev.assunto, assunto_cnj: fields.assuntoCnj || prev.assunto_cnj, classe_cnj: fields.classeCnj || prev.classe_cnj, valor_causa: fields.valorCausa?.toString() || prev.valor_causa, data_distribuicao: toDate(fields.dataDistrib) || prev.data_distribuicao }));
        if (processo?.id) {
          await supabase.from('processos').update({ titulo_acao: fields.classe || null, status: mapStatus(proc.status), tribunal: fields.tribunal || null, orgao_julgador: fields.orgaoJulgador || null, vara_comarca: fields.orgaoJulgador || null, assunto: fields.assunto || null, assunto_cnj: fields.assuntoCnj || null, classe_cnj: fields.classeCnj || null, valor_causa: fields.valorCausa || null, partes_json: newPartes.length > 0 ? newPartes : null, movimentos_json: newMovs.length > 0 ? newMovs : null, ultima_consulta_api_at: new Date().toISOString(), data_ultima_atualizacao: new Date().toISOString() }).eq('id', processo.id);
          fetchProcessos();
        }
        if (!silent) toast.success('Atualizado!', { description: `${newMovs.length} movimentações · ${newPartes.length} partes` });
      } else { if (!silent) toast.error('Não encontrado', { description: data?.mensagem }); }
    } catch (err: any) { if (!silent) toast.error('Erro ao consultar APIs', { description: err?.message }); }
    finally { setFetchingData(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const resolvedClienteId = formData.cliente_id === '__none__' ? null : formData.cliente_id || null;
      let nomeCliente: string | null = null;
      if (resolvedClienteId) { const l = leads.find(l => l.id === resolvedClienteId); if (l?.nome) nomeCliente = l.nome; }
      if (!nomeCliente && partes.length > 0) { const autor = partes.find(p => p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT'); if (autor?.nome) nomeCliente = autor.nome; }

      const data = {
        numero_processo:           formData.numero_processo        || null,
        cnj_normalizado:           normalizarCNJ(formData.numero_processo),
        numero_complementar:       formData.numero_complementar    || null,
        titulo_acao:               formData.titulo_acao            || null,
        status:                    formData.status,
        advogado_responsavel:      formData.advogado_responsavel   || null,
        cliente_id:                resolvedClienteId,
        nome_cliente:              nomeCliente,
        cpf_cliente:               formData.cpf_cliente ? formData.cpf_cliente.replace(/\D/g, '') : null,
        origem_cliente:            formData.origem_cliente         || null,
        tribunal:                  formData.tribunal               || null,
        vara_comarca:              formData.vara_comarca           || null,
        orgao_julgador:            formData.orgao_julgador         || null,
        tipo_orgao_julgador:       formData.tipo_orgao_julgador    || null,
        grau:                      formData.grau                   || null,
        sistema_judicial:          formData.sistema_judicial       || null,
        complemento_enderecamento: formData.complemento_enderecamento || null,
        classe_cnj:                formData.classe_cnj             || null,
        assunto:                   formData.assunto                || null,
        assunto_cnj:               formData.assunto_cnj            || null,
        valor_causa:               parseMoney(formData.valor_causa),
        valor_provisionado:        parseMoney(formData.valor_provisionado),
        probabilidade:             formData.probabilidade          || null,
        data_ajuizamento:          parseDate(formData.data_distribuicao),
        data_distribuicao:         parseDate(formData.data_distribuicao),
        data_citacao:              parseDate(formData.data_citacao),
        data_recebimento:          parseDate(formData.data_recebimento),
        data_arquivamento:         parseDate(formData.data_arquivamento),
        data_encerramento:         parseDate(formData.data_encerramento),
        descricao:                 formData.descricao              || null,
        marcadores:                formData.marcadores             || null,
        area:                      formData.area                   || null,
        fase:                      formData.fase                   || null,
        segredo_justica:           formData.segredo_justica,
        monitorar_push:            formData.monitorar_push,
        partes_json:               partes.length > 0    ? partes    : null,
        movimentos_json:           movimentos.length > 0 ? movimentos : null,
        updated_at:                new Date().toISOString(),
      };

      let savedId: string | null = null;
      if (isNew) {
        const result = await createProcesso(data);
        if (result?.error) return;
        savedId = (result?.data as any)?.id || null;
      } else if (processo) {
        const result = await updateProcesso(processo.id, data);
        if (result?.error) return;
        savedId = processo.id;
      }

      if (savedId) {
        await supabase.from('processo_partes').delete().eq('processo_id', savedId);
        if (partes.length > 0) {
          await supabase.from('processo_partes').insert(partes.map(p => ({ processo_id: savedId!, nome: p.nome, tipo: p.tipo, polo: p.polo || null, tipo_pessoa: p.tipoPessoa || null, documento: p.documento || null, celular: p.celular || null, telefone_adicional: (p as any).telefone_adicional || null, advogados: p.advogados || null })));
        }
      }
      clearDraft();
      onClose();
    } catch (err: any) {
      toast.error('Erro inesperado', { description: err?.message });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!processo) return;
    const result = await deleteProcesso(processo.id);
    if (!result?.error) { clearDraft(); onClose(); }
  };

  const handleSendNotif = async () => {
    if (!processo?.id) return;
    setSendingNotif(true);
    try {
      const { data, error } = await supabase.functions.invoke('processo-status-notify', { body: { processoId: processo.id } });
      if (error) throw error;
      if (data?.success) toast.success('Notificação enviada!', { description: `WhatsApp para ${data.telefone}` });
      else throw new Error(data?.error);
    } catch (err: any) { toast.error('Erro ao enviar notificação', { description: err.message }); }
    finally { setSendingNotif(false); }
  };

  const clienteSelecionado = leads.find(l => l.id === formData.cliente_id);
  const hasPartes  = partes.length > 0;
  const isValidCnj = CNJ_REGEX.test((formData.numero_processo || '').trim());
  const statusCfg  = STATUS_CONFIG[formData.status] || STATUS_CONFIG['Arquivado'];

  // Alturas calculadas com base nos elementos fixos do modal:
  // Header: ~73px | Tabs bar: ~53px | Footer: ~57px | Total chrome: ~183px
  const MODAL_H    = '94vh';
  const CONTENT_H  = 'calc(94vh - 183px)';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="w-[96vw] max-w-[1200px] rounded-2xl overflow-hidden flex flex-col p-0 gap-0"
          style={{ height: MODAL_H, maxHeight: MODAL_H }}
        >
          <DialogHeader className="sr-only"><DialogTitle>{isNew ? 'Novo Processo' : 'Detalhes do Processo'}</DialogTitle></DialogHeader>

          {/* ── Header ── */}
          <div className="relative overflow-hidden shrink-0">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
            <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                  <Scale className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-sm font-black text-foreground leading-none">{isNew ? 'Novo Processo' : 'Detalhes do Processo'}</h2>
                    {!isNew && formData.status && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />{formData.status}
                      </span>
                    )}
                  </div>
                  {formData.numero_processo && <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{formData.numero_processo}</p>}
                  {!isNew && processo?.ultima_consulta_api_at && (
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      Sync: {new Date(processo.ultima_consulta_api_at).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit' })}
                      {fetchingData && ' · Atualizando...'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {fetchingData && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {formData.tribunal && (
                  <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/40">
                    <Building2 className="h-3.5 w-3.5" />{formData.tribunal}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 pb-0 shrink-0 bg-card border-b border-border/40">
              <TabsList className="h-9 bg-muted/50 rounded-xl p-1 gap-1">
                <TabsTrigger value="processo" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm">
                  <Scale className="h-3.5 w-3.5" /> Processo
                </TabsTrigger>
                <TabsTrigger value="movimentos" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm">
                  <Calendar className="h-3.5 w-3.5" /> Movimentos
                  {movimentos.length > 0 && (
                    <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">{movimentos.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notificacoes" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm">
                  <MessageSquare className="h-3.5 w-3.5" /> Notificações
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── TAB PROCESSO ── */}
            <TabsContent value="processo" className="flex-1 min-h-0 mt-0 overflow-hidden">
              {/* Layout: form à esquerda | divider | partes à direita */}
              <div className="flex overflow-hidden" style={{ height: CONTENT_H }}>

                {/* Form — scroll interno */}
                <ScrollArea className="flex-1 min-w-0 h-full">
                  <div className="px-6 py-5 space-y-5">

                    <div>
                      <SectionTitle icon={Hash} label="Numeração" />
                      <FieldGroup>
                        <Row2>
                          <Field label="Número CNJ">
                            <div className="relative">
                              <Input value={formData.numero_processo} onChange={e => update('numero_processo', e.target.value)} className="rounded-xl bg-card font-mono text-sm pr-9 h-10" placeholder="0000000-00.0000.0.00.0000" />
                              {fetchingData  && <Loader2      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                              {!fetchingData && isValidCnj && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
                            </div>
                            {isNew && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Digite para carregar automaticamente</p>}
                          </Field>
                          <Field label="Número Complementar">
                            <Input value={formData.numero_complementar} onChange={e => update('numero_complementar', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Opcional" />
                          </Field>
                        </Row2>
                      </FieldGroup>
                    </div>

                    <div>
                      <SectionTitle icon={FileText} label="Detalhes" />
                      <FieldGroup>
                        <Row2>
                          <Field label="Situação">
                            <Select value={formData.status} onValueChange={v => update('status', v as ProcessoStatus)}>
                              <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue /></SelectTrigger>
                              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <Field label="Assunto">
                            <button type="button" onClick={() => setAssuntoPickerOpen(true)} className={`flex items-center justify-between w-full h-10 px-3 rounded-xl border text-sm transition-all ${formData.assunto ? 'bg-card border-border text-foreground' : 'bg-card border-border text-muted-foreground'} hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring`}>
                              <span className="truncate">{formData.assunto || 'Selecionar assunto...'}</span>
                              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                            </button>
                          </Field>
                        </Row2>
                        <Field label="Descrição / Anotações">
                          <Textarea value={formData.descricao} onChange={e => update('descricao', e.target.value)} className="rounded-xl bg-card min-h-[60px] text-sm resize-none" placeholder="Anotações internas..." />
                        </Field>
                        <Row2>
                          <Field label="Marcadores">
                            <Input value={formData.marcadores} onChange={e => update('marcadores', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Separados por vírgula" />
                          </Field>
                          <Field label="Pasta do Cliente">
                            <div className="space-y-1.5">
                              <Select value={formData.cliente_id || '__none__'} onValueChange={v => update('cliente_id', v === '__none__' ? '' : v)}>
                                <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nenhum</SelectItem>
                                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}{l.telefone ? ` (${l.telefone})` : ''}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <button type="button" onClick={() => setNovoClienteOpen(true)} className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-semibold transition-colors">
                                <UserPlus className="h-3 w-3" /> Criar novo cliente e vincular
                              </button>
                            </div>
                          </Field>
                        </Row2>
                      </FieldGroup>
                    </div>

                    <div>
                      <SectionTitle icon={Users} label="Responsável" bg="bg-secondary/15" color="text-foreground" />
                      <FieldGroup>
                        <Row2>
                          <Field label="Advogado Responsável">
                            <Input value={formData.advogado_responsavel} onChange={e => update('advogado_responsavel', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Nome do advogado" />
                          </Field>
                          <Field label="Origem do Cliente">
                            <Select value={formData.origem_cliente || '__none__'} onValueChange={v => update('origem_cliente', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Não informado</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Bentes e Ramos">Bentes e Ramos</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </Row2>
                        <Field label="CPF do Cliente" hint="Usado pela Isa para localizar processos">
                          <Input value={formData.cpf_cliente} onChange={e => { let v = e.target.value.replace(/\D/g, '').slice(0, 11); if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4'); else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3'); else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2'); update('cpf_cliente', v); }} className="rounded-xl bg-card h-10" placeholder="000.000.000-00" maxLength={14} />
                        </Field>
                      </FieldGroup>
                    </div>

                    <div>
                      <SectionTitle icon={Building2} label="Endereçamento" bg="bg-blue-500/10" color="text-blue-600 dark:text-blue-400" />
                      <FieldGroup>
                        <Row2>
                          <Field label="Justiça / Tribunal"><Input value={formData.tribunal} onChange={e => update('tribunal', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Ex: TJAM" /></Field>
                          <Field label="Instância">
                            <Select value={formData.grau || 'G1'} onValueChange={v => update('grau', v)}>
                              <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="G1">1º Grau</SelectItem><SelectItem value="G2">2º Grau</SelectItem>
                                <SelectItem value="SUP">Superior</SelectItem><SelectItem value="JE">Juizado Especial</SelectItem>
                                <SelectItem value="TR">Turma Recursal</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </Row2>
                        <Row2>
                          <Field label="Vara / Comarca"><Input value={formData.vara_comarca} onChange={e => update('vara_comarca', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Vara" /></Field>
                          <Field label="Órgão Julgador"><Input value={formData.orgao_julgador} onChange={e => update('orgao_julgador', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Ex: 2ª Vara Cível" /></Field>
                        </Row2>
                        <Row2>
                          <Field label="Sistema Judicial"><Input value={formData.sistema_judicial} onChange={e => update('sistema_judicial', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Ex: PJe, e-SAJ" /></Field>
                          <Field label="Complemento"><Input value={formData.complemento_enderecamento} onChange={e => update('complemento_enderecamento', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Complemento" /></Field>
                        </Row2>
                        <Row4>
                          <Field label="Distribuição"><Input type="date" value={formData.data_distribuicao} onChange={e => update('data_distribuicao', e.target.value)} className="rounded-xl bg-card h-9 text-xs" /></Field>
                          <Field label="Citação"><Input type="date" value={formData.data_citacao} onChange={e => update('data_citacao', e.target.value)} className="rounded-xl bg-card h-9 text-xs" /></Field>
                          <Field label="Arquivamento"><Input type="date" value={formData.data_arquivamento} onChange={e => update('data_arquivamento', e.target.value)} className="rounded-xl bg-card h-9 text-xs" /></Field>
                          <Field label="Encerramento"><Input type="date" value={formData.data_encerramento} onChange={e => update('data_encerramento', e.target.value)} className="rounded-xl bg-card h-9 text-xs" /></Field>
                        </Row4>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={formData.monitorar_push} onChange={e => update('monitorar_push', e.target.checked)} className="rounded border-border" />
                          <span className="text-xs font-medium flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-primary" /> Monitorar (Push)</span>
                        </label>
                      </FieldGroup>
                    </div>

                    <div>
                      <SectionTitle icon={FolderOpen} label="Autos" bg="bg-amber-500/10" color="text-amber-600 dark:text-amber-400" />
                      <FieldGroup>
                        <Row2>
                          <Field label="Área">
                            <Select value={formData.area || '__none__'} onValueChange={v => update('area', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent><SelectItem value="__none__">Selecione</SelectItem>{['Cível','Trabalhista','Criminal','Tributário','Previdenciário','Administrativo','Consumidor','Família'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <Field label="Fase">
                            <Select value={formData.fase || '__none__'} onValueChange={v => update('fase', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent><SelectItem value="__none__">Selecione</SelectItem>{['Conhecimento','Execução','Recursal','Cumprimento de Sentença','Liquidação'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                        </Row2>
                        <Row2>
                          <Field label="Classe CNJ"><Input value={formData.classe_cnj} onChange={e => update('classe_cnj', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Ex: Procedimento Comum Cível" /></Field>
                          <Field label="Assunto CNJ"><Input value={formData.assunto_cnj} onChange={e => update('assunto_cnj', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Código ou nome CNJ" /></Field>
                        </Row2>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={formData.segredo_justica} onChange={e => update('segredo_justica', e.target.checked)} className="rounded border-border" />
                          <span className="text-xs font-medium flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-muted-foreground" /> Segredo de Justiça</span>
                        </label>
                      </FieldGroup>
                    </div>

                    <div>
                      <SectionTitle icon={DollarSign} label="Pedidos" bg="bg-emerald-500/10" color="text-emerald-600 dark:text-emerald-400" />
                      <FieldGroup>
                        <Row3>
                          <Field label="Valor da Ação (R$)"><Input value={formData.valor_causa} onChange={e => update('valor_causa', e.target.value.replace(/[^0-9.,]/g, ''))} className="rounded-xl bg-card h-10" placeholder="0,00" inputMode="decimal" /></Field>
                          <Field label="Valor Provisionado (R$)"><Input value={formData.valor_provisionado} onChange={e => update('valor_provisionado', e.target.value.replace(/[^0-9.,]/g, ''))} className="rounded-xl bg-card h-10" placeholder="0,00" inputMode="decimal" /></Field>
                          <Field label="Probabilidade">
                            <Select value={formData.probabilidade || '__none__'} onValueChange={v => update('probabilidade', v === '__none__' ? '' : v)}>
                              <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent><SelectItem value="__none__">Selecione</SelectItem><SelectItem value="Provável">Provável</SelectItem><SelectItem value="Possível">Possível</SelectItem><SelectItem value="Remota">Remota</SelectItem></SelectContent>
                            </Select>
                          </Field>
                        </Row3>
                      </FieldGroup>
                    </div>

                  </div>
                </ScrollArea>

                {/* Divider */}
                <div className="w-px bg-border/40 shrink-0" />

                {/* Partes — largura responsiva, sem overflow */}
                <div className="w-[300px] xl:w-[340px] shrink-0 flex flex-col overflow-hidden h-full bg-muted/10">
                  <div className="px-4 pt-4 pb-3 border-b border-border/40 shrink-0 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">Partes</h3>
                      {hasPartes && (
                        <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center border border-primary/15">
                          {partes.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 h-full">
                    <div className="px-3 py-3 space-y-2">
                      {!hasPartes ? (
                        <div className="rounded-2xl border border-dashed border-border/50 bg-card py-10 text-center">
                          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                            <Users className="h-6 w-6 text-muted-foreground/20" />
                          </div>
                          <p className="text-xs font-semibold text-foreground">Nenhuma parte</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Use "Atualizar" ou adicione abaixo</p>
                        </div>
                      ) : partes.map((parte, i) => (
                        <ParteCard key={i} parte={parte} index={i}
                          onUpdate={(idx, field, val) => setPartes(prev => prev.map((p, j) => j === idx ? { ...p, [field]: val } : p))}
                          onRemove={idx => setPartes(prev => prev.filter((_, j) => j !== idx))}
                        />
                      ))}
                      <AddParteForm onAdd={parte => setPartes(prev => [...prev, parte])} />
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* ── TAB MOVIMENTOS ── */}
            <TabsContent value="movimentos" className="flex-1 min-h-0 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-5">
                  {movimentosEnriquecidos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 border-2 border-dashed border-border/40 rounded-2xl">
                      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center"><Calendar className="h-7 w-7 text-muted-foreground/20" /></div>
                      <p className="text-sm font-semibold text-foreground">Nenhuma movimentação</p>
                      <p className="text-xs text-muted-foreground">Clique em "Atualizar" para carregar do DataJud</p>
                      <Button variant="outline" size="sm" className="mt-1 gap-2 rounded-xl h-9" onClick={() => handleRefreshStatus(false)} disabled={fetchingData || !isValidCnj}>
                        {fetchingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Buscar Movimentações
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 pb-6">
                      <p className="text-xs text-muted-foreground mb-4 font-medium">{movimentosEnriquecidos.length} movimentação(ões) · clique para detalhes</p>
                      {movimentosEnriquecidos.map((mov, i) => (
                        <div key={i} className="group flex items-start gap-3 p-3.5 rounded-2xl border border-border/40 bg-card hover:bg-accent/30 hover:border-border cursor-pointer transition-all duration-150 hover:shadow-sm"
                          onClick={() => { setSelectedMovimento(mov); setMovModalOpen(true); }}>
                          <div className="shrink-0 mt-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoriaColor(mov.categoria)}`}>{mov.badge}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-snug">{mov.titulo_humano}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mov.descricao_humana}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 self-start">
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── TAB NOTIFICAÇÕES ── */}
            <TabsContent value="notificacoes" className="flex-1 min-h-0 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-5 pb-16">
                  {!isNew && processo ? (
                    <ProcessoNotificacoesTab
                      processo={processo} cliente={clienteSelecionado} sending={sendingNotif} onSendManual={handleSendNotif}
                      config={<ProcessoNotificacaoConfig processoId={processo.id} frequenciaDias={processo.frequencia_notificacao_dias || 7} notificacaoAtiva={processo.notificacao_ativa ?? true} ultimaNotificacao={processo.ultima_notificacao_at} onUpdate={fetchProcessos} />}
                      previewData={{ nomeCliente: clienteSelecionado?.nome, numeroProcesso: formData.numero_processo || processo.numero_processo, acao: formData.titulo_acao || processo.titulo_acao, status: (formData.status as unknown as string) || (processo.status as unknown as string), tribunal: formData.tribunal || processo.tribunal, ultimaAtualizacao: processo.data_ultima_atualizacao, movimentos: movimentos.slice(0, 3) }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 border-2 border-dashed border-border/40 rounded-2xl">
                      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center"><MessageSquare className="h-7 w-7 text-muted-foreground/20" /></div>
                      <p className="text-sm font-semibold text-foreground">Salve o processo primeiro</p>
                      <p className="text-xs text-muted-foreground">Notificações disponíveis após criar</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/60 bg-card shrink-0">
            <div>
              {!isNew && canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 h-9 gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 border-border/60" onClick={() => handleRefreshStatus(false)} disabled={fetchingData || !isValidCnj}>
                {fetchingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isNew ? 'Buscar DataJud' : 'Atualizar'}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl h-9" onClick={onClose}>Cancelar</Button>
              <Button size="sm" className="rounded-xl px-6 h-9 shadow-sm font-bold gap-1.5" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</> : isNew ? 'Criar Processo' : 'Salvar'}
              </Button>
            </div>
          </div>

          <MovimentoDetailModal movimento={selectedMovimento} isOpen={movModalOpen} onClose={() => { setMovModalOpen(false); setSelectedMovimento(null); }} />
        </DialogContent>
      </Dialog>

      <AssuntoPickerModal isOpen={assuntoPickerOpen} onClose={() => setAssuntoPickerOpen(false)} currentValue={formData.assunto} onSelect={v => update('assunto', v)} />
      <NovoClienteModal isOpen={novoClienteOpen} onClose={() => setNovoClienteOpen(false)} onCreated={lead => { setLeads(prev => [...prev, lead].sort((a, b) => a.nome.localeCompare(b.nome))); update('cliente_id', lead.id); }} />
    </>
  );
}
