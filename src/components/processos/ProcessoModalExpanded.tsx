import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Trash2, Loader2, Users, BadgeCheck, RefreshCw, MessageSquare,
  Building2, Scale, Calendar, DollarSign, Plus, X,
  FileText, Bell, Hash, FolderOpen, Shield, Pencil, ChevronRight,
  CheckCircle2, Search, Tag, UserPlus, AlertTriangle,
  CheckCircle, PauseCircle, Archive, Trophy, XCircle, Activity,
  Link2, Link2Off, GitBranch, ListTodo, Send, Play, RotateCcw, Star,
} from 'lucide-react';
import { useTarefas } from '@/hooks/useTarefas';
import { Tarefa } from '@/types/tarefas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  nome_cliente: string; cpf_cliente: string; tribunal: string; vara_comarca: string;
  assunto: string; valor_causa: string; orgao_julgador: string; grau: string;
  origem_cliente: string; descricao: string; marcadores: string; area: string;
  fase: string; classe_cnj: string; assunto_cnj: string; segredo_justica: boolean;
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
  nome_cliente: '', cpf_cliente: '', tribunal: '', vara_comarca: '',
  assunto: '', valor_causa: '', orgao_julgador: '', grau: '', origem_cliente: '',
  descricao: '', marcadores: '', area: '', fase: '', classe_cnj: '',
  assunto_cnj: '', segredo_justica: false, data_distribuicao: '',
  data_citacao: '', data_recebimento: '', data_arquivamento: '',
  data_encerramento: '', valor_provisionado: '', probabilidade: '',
  monitorar_push: true, tipo_orgao_julgador: '', sistema_judicial: '',
  complemento_enderecamento: '',
});

const STATUS_CONFIG: Record<string, { cls: string; dot: string; barColor: string; icon: React.ElementType }> = {
  'Em Andamento': { cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40', dot: 'bg-blue-500', barColor: '#3b82f6', icon: CheckCircle },
  'Ganho':        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300', dot: 'bg-emerald-500', barColor: '#10b981', icon: Trophy },
  'Perdido':      { cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300', dot: 'bg-red-500', barColor: '#ef4444', icon: XCircle },
  'Suspenso':     { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300', dot: 'bg-amber-500', barColor: '#f59e0b', icon: PauseCircle },
  'Arquivado':    { cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground', barColor: '#94a3b8', icon: Archive },
};

const parseMoney = (v: string): number | null => {
  if (!v || v.trim() === '') return null;
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

const fmtMoney = (v: number | string | null | undefined): string => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return isNaN(n) || n === 0 ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  classe:        proc.classe        || proc.titulo_acao    || proc.classeNome   || proc.classe_cnj || '',
  tribunal:      proc.tribunal      || proc.sigla_tribunal || '',
  orgaoJulgador: proc.orgaoJulgador || proc.orgao_julgador || proc.orgao || '',
  varaComarca:   proc.vara_comarca  || proc.comarca        || proc.varaComarca || '',
  grau:          proc.grau          || proc.grauFormatado  || '',
  assunto:       proc.assuntos?.[0]?.nome || proc.assunto || '',
  assuntoCnj:    proc.assuntos?.[0]?.codigo?.toString() || proc.assunto_cnj || '',
  classeCnj:     proc.classe        || proc.classe_cnj     || proc.classeCodigo || '',
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
  const [editing, setEditing] = useState(false);
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
    <div>
      <div className="rounded-xl border border-border/40 bg-card" style={{ borderLeftWidth: 3, borderLeftColor: barColor }}>
        <div className="p-2.5 pl-3">
          {/* Nome + ações na linha de cima */}
          <div className="flex items-center justify-between gap-1 mb-1">
            <p className="text-xs font-semibold truncate flex-1 min-w-0">{parte.nome}</p>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`h-5 w-5 shrink-0 ${editing ? 'text-primary' : 'text-muted-foreground/50 hover:text-primary'}`}
                onClick={() => setEditing(v => !v)}
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-destructive shrink-0" onClick={() => onRemove(index)}>
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
        {editing && (
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
        )}
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
    </div>
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

// ─── TarefaRowModal ────────────────────────────────────────────────────────────

const PRIO_ROW: Record<string, { bar: string; badge: string; label: string }> = {
  Urgente: { bar: '#dc2626', badge: 'bg-red-50 text-red-700 border-red-200',      label: 'Urgente' },
  Alta:    { bar: '#c9a96e', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Alta' },
  Media:   { bar: '#3d2b1f', badge: 'bg-stone-100 text-stone-600 border-stone-200', label: 'Média' },
  Baixa:   { bar: '#94a3b8', badge: 'bg-slate-50 text-slate-500 border-slate-200', label: 'Baixa' },
};
const STATUS_ROW: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  'Pendente':     { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Pendente' },
  'Em Andamento': { icon: Play,          cls: 'bg-blue-50 text-blue-700 border-blue-200',   label: 'Em Andamento' },
  'Concluída':    { icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Concluída' },
  'Cancelada':    { icon: XCircle,       cls: 'bg-muted text-muted-foreground border-border', label: 'Cancelada' },
};
const STATUS_NEXT: Record<string, Tarefa['status']> = {
  'Pendente': 'Em Andamento', 'Em Andamento': 'Concluída', 'Concluída': 'Pendente', 'Cancelada': 'Pendente',
};

function TarefaRowModal({ tarefa, membros, onStatusChange }: {
  tarefa: Tarefa;
  membros: { id: string; nome: string | null; sobrenome: string | null; email: string | null }[];
  onStatusChange: (id: string, status: Tarefa['status']) => void;
}) {
  const prio = PRIO_ROW[tarefa.prioridade] || PRIO_ROW.Baixa;
  const stCfg = STATUS_ROW[tarefa.status] || STATUS_ROW['Pendente'];
  const StatusIcon = stCfg.icon;
  const membro = membros.find(m => m.id === tarefa.responsavel_id);
  const membroNome = membro ? ([membro.nome, membro.sobrenome].filter(Boolean).join(' ') || membro.email || 'Usuário') : null;
  const isAtrasada = tarefa.prazo_fatal && tarefa.status !== 'Concluída' && tarefa.status !== 'Cancelada'
    && new Date(tarefa.prazo_fatal) < new Date();
  const isConcluida = tarefa.status === 'Concluída';

  return (
    <div
      className={`rounded-xl border transition-all ${isConcluida ? 'bg-emerald-50/40 border-emerald-200/50' : 'bg-card border-border/40 hover:border-border/70'}`}
      style={{ borderLeftWidth: 3, borderLeftColor: isConcluida ? '#16a34a' : prio.bar }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Título + meta */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-tight ${isConcluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {tarefa.titulo}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Status badge clicável para avançar */}
              <button
                type="button"
                onClick={() => onStatusChange(tarefa.id, STATUS_NEXT[tarefa.status])}
                title={`Avançar para: ${STATUS_NEXT[tarefa.status]}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all hover:opacity-80 ${stCfg.cls}`}
              >
                <StatusIcon className="h-2.5 w-2.5 shrink-0" />
                {stCfg.label}
              </button>
              {/* Prioridade */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${prio.badge}`}>
                {prio.label}
              </span>
              {/* Responsável */}
              {membroNome && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />{membroNome}
                </span>
              )}
              {/* Prazo */}
              {tarefa.prazo_fatal && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isAtrasada ? 'text-red-600' : 'text-muted-foreground'}`}>
                  <Calendar className="h-2.5 w-2.5" />
                  {new Date(tarefa.prazo_fatal).toLocaleDateString('pt-BR')}
                  {isAtrasada && <AlertTriangle className="h-2.5 w-2.5" />}
                </span>
              )}
            </div>
            {/* Aprovação */}
            {tarefa.aprovacao_status && (
              <div className="mt-1.5 flex items-center gap-1">
                {tarefa.aprovacao_status === 'aguardando_aprovacao' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Send className="h-2.5 w-2.5" /> Aguardando aprovação
                  </span>
                )}
                {tarefa.aprovacao_status === 'aprovada' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Aprovada
                    {tarefa.aprovacao_nota && (
                      <span className="flex items-center gap-0.5 ml-1">
                        {[1,2,3,4,5].map(s => <Star key={s} className="h-2 w-2" style={{ color: s <= tarefa.aprovacao_nota! ? '#c9a96e' : '#e5e7eb', fill: s <= tarefa.aprovacao_nota! ? '#c9a96e' : 'transparent' }} />)}
                      </span>
                    )}
                  </span>
                )}
                {tarefa.aprovacao_status === 'devolvida' && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    <RotateCcw className="h-2.5 w-2.5" /> Devolvida
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ProcessoModalExpanded({ processo, isOpen, onClose, isNew = false, canDelete = false, leads: leadsInit }: ProcessoModalExpandedProps) {
  const { createProcesso, updateProcesso, deleteProcesso, fetchProcessos } = useProcessos({ withRealtime: false });

  const [formData,          setFormData]          = useState<ProcessoFormData>(createEmptyForm());
  const [partes,            setPartes]            = useState<ProcessoParte[]>([]);
  const [movimentos,        setMovimentos]        = useState<ProcessoMovimento[]>([]);
  const [saving,            setSaving]            = useState(false);
  const [saveError,         setSaveError]         = useState<string | null>(null);
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
  const [assuntoPickerOpen, setAssuntoPickerOpen]   = useState(false);
  const [novoClienteOpen,   setNovoClienteOpen]     = useState(false);
  const [partesModificadas, setPartesModificadas]   = useState(false);
  const [processoPai,       setProcessoPai]         = useState<Pick<Processo, 'id' | 'numero_processo' | 'titulo_acao' | 'status' | 'fase'> | null>(null);
  const [processoFilhos,    setProcessoFilhos]      = useState<Array<Pick<Processo, 'id' | 'numero_processo' | 'titulo_acao' | 'status' | 'fase'>>>([]);
  const [vinculoBusca,      setVinculoBusca]        = useState('');
  const [vinculoResultados, setVinculoResultados]   = useState<Array<Pick<Processo, 'id' | 'numero_processo' | 'titulo_acao' | 'status'>>>([]);
  const [vinculoBuscando,   setVinculoBuscando]     = useState(false);
  const syncedThisSession = useRef<Set<string>>(new Set());
  const [novoFilhoNumero,   setNovoFilhoNumero]   = useState('');
  const [novoFilhoTitulo,   setNovoFilhoTitulo]   = useState('');
  const [criandoFilho,      setCriandoFilho]       = useState(false);
  const [showNovoFilhoForm, setShowNovoFilhoForm]  = useState(false);
  const [verificandoTodos,  setVerificandoTodos]   = useState(false);
  const [verificacaoStatus, setVerificacaoStatus]  = useState<Record<string, 'ok' | 'erro'>>({});
  const autoSavePartesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Tarefas do processo ──────────────────────────────────────────────────────
  const [showNovaTarefaForm,   setShowNovaTarefaForm]   = useState(false);
  const [novaTarefaTitulo,     setNovaTarefaTitulo]     = useState('');
  const [novaTarefaDescricao,  setNovaTarefaDescricao]  = useState('');
  const [novaTarefaResponsavel,setNovaTarefaResponsavel]= useState('none');
  const [novaTarefaPrioridade, setNovaTarefaPrioridade] = useState<Tarefa['prioridade']>('Media');
  const [novaTarefaPrazoFatal, setNovaTarefaPrazoFatal] = useState('');
  const [novaTarefaHorario,    setNovaTarefaHorario]    = useState('');
  const [criandoTarefa,        setCriandoTarefa]        = useState(false);
  const [processoTarefas,      setProcessoTarefas]      = useState<Tarefa[]>([]);
  const [tarefasLoading,       setTarefasLoading]       = useState(false);
  const [membros,              setMembros]              = useState<{ id: string; nome: string | null; sobrenome: string | null; email: string | null }[]>([]);

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
        nome_cliente: p.nome_cliente || '',
        cpf_cliente: processo.cpf_cliente || '', tribunal: processo.tribunal || '',
        vara_comarca: processo.vara_comarca || '',
        assunto: processo.assunto || '',
        valor_causa: fmtMoney(processo.valor_causa),
        orgao_julgador: processo.orgao_julgador || '', grau: processo.grau || '',
        origem_cliente: p.origem_cliente || '', descricao: p.descricao || '', marcadores: p.marcadores || '',
        area: p.area || '', fase: p.fase || '', classe_cnj: processo.classe_cnj || processo.titulo_acao || '',
        assunto_cnj: p.assunto_cnj || '', segredo_justica: p.segredo_justica || false,
        data_distribuicao: p.data_distribuicao ? p.data_distribuicao.slice(0, 10) : '',
        data_citacao: p.data_citacao ? p.data_citacao.slice(0, 10) : '',
        data_recebimento: p.data_recebimento ? p.data_recebimento.slice(0, 10) : '',
        data_arquivamento: p.data_arquivamento ? p.data_arquivamento.slice(0, 10) : '',
        data_encerramento: p.data_encerramento ? p.data_encerramento.slice(0, 10) : '',
        valor_provisionado: fmtMoney(p.valor_provisionado),
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
    setPartesModificadas(false); setProcessoPai(null); setProcessoFilhos([]); setVinculoBusca(''); setVinculoResultados([]);
    setLastLoadedId(processoId); setWasNew(isNew); setDraftHydrated(true);
  }, [processo, processoId, isNew, lastLoadedId, wasNew, readDraft]);

  useEffect(() => { setAutoFetchDone(false); }, [processoId]);

  useEffect(() => {
    if (!processo?.id || isNew) { setProcessoPai(null); setProcessoFilhos([]); return; }
    if ((processo as any).processo_pai_id) {
      supabase.from('processos').select('id,numero_processo,titulo_acao,status,fase').eq('id', (processo as any).processo_pai_id).single()
        .then(({ data }) => setProcessoPai((data as any) || null));
    } else { setProcessoPai(null); }
    supabase.from('processos').select('id,numero_processo,titulo_acao,status,fase').eq('processo_pai_id', processo.id)
      .then(({ data }) => setProcessoFilhos((data || []) as any));
  }, [processo?.id, (processo as any)?.processo_pai_id, isNew]);

  useEffect(() => {
    const term = vinculoBusca.trim();
    if (term.length < 3 || !processo?.id) { setVinculoResultados([]); return; }
    const t = setTimeout(async () => {
      setVinculoBuscando(true);
      const like = `%${term}%`;
      const { data } = await supabase.from('processos')
        .select('id,numero_processo,titulo_acao,status')
        .or(`numero_processo.ilike.${like},titulo_acao.ilike.${like}`)
        .neq('id', processo.id)
        .limit(8);
      setVinculoResultados((data || []) as any);
      setVinculoBuscando(false);
    }, 400);
    return () => clearTimeout(t);
  }, [vinculoBusca, processo?.id]);

  useEffect(() => {
    if (!isNew && isOpen && processo?.id && !autoFetchDone && draftHydrated) {
      setAutoFetchDone(true);
      (async () => {
        try {
          const { data: dbPartes } = await supabase.from('processo_partes').select('*').eq('processo_id', processo.id);
          if (dbPartes && dbPartes.length > 0) {
            setPartes(dbPartes.map((p: any) => ({ nome: p.nome, tipo: p.tipo, polo: p.polo || '', tipoPessoa: p.tipo_pessoa || '', documento: p.documento || '', celular: p.celular || '', telefone_adicional: p.telefone_adicional || '', advogados: Array.isArray(p.advogados) ? p.advogados : [] })));
            setPartesModificadas(false);
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
      const neverSynced = !processo.ultima_consulta_api_at;
      const lastCheck = processo.ultima_consulta_api_at ? new Date(processo.ultima_consulta_api_at).getTime() : 0;
      const isStale = Date.now() - lastCheck > 3 * 24 * 60 * 60 * 1000;
      const alreadySynced = syncedThisSession.current.has(processo.id);
      if (hasValidCnj && (neverSynced || isStale) && !fetchingData && !alreadySynced) {
        syncedThisSession.current.add(processo.id);
        handleRefreshStatus(true);
      }
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
        const leadNome = clienteId ? leads.find(l => l.id === clienteId)?.nome : (autor?.nome || '');
        setFormData(prev => ({ ...prev,
          titulo_acao:          fields.classe          || prev.titulo_acao,
          status:               mapStatus(proc.status),
          cliente_id:           clienteId              || prev.cliente_id,
          nome_cliente:         leadNome               || autor?.nome || prev.nome_cliente,
          advogado_responsavel: adv ? (adv.oab ? `${adv.nome} (${adv.oab})` : adv.nome) : prev.advogado_responsavel,
          tribunal:             fields.tribunal        || prev.tribunal,
          orgao_julgador:       fields.orgaoJulgador   || prev.orgao_julgador,
          vara_comarca:         fields.varaComarca     || prev.vara_comarca,
          grau:                 fields.grau            || prev.grau,
          assunto:              fields.assunto         || prev.assunto,
          assunto_cnj:          fields.assuntoCnj      || prev.assunto_cnj,
          classe_cnj:           fields.classeCnj       || prev.classe_cnj,
          valor_causa:          fields.valorCausa != null ? fmtMoney(fields.valorCausa) : prev.valor_causa,
          data_distribuicao:    fields.dataDistrib ? fields.dataDistrib.slice(0, 10) : prev.data_distribuicao,
        }));
        if (proc.partes?.length) setPartes(prev => {
          const apiNames = new Set(proc.partes.map((p: any) => (p.nome || '').toLowerCase().trim()));
          const manual = prev.filter(p => !apiNames.has((p.nome || '').toLowerCase().trim()));
          return [...proc.partes, ...manual];
        });
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
        setPartes((prev: ProcessoParte[]) => {
          if (!newPartes.length) return prev;
          const apiNames = new Set(newPartes.map((p: any) => (p.nome || '').toLowerCase().trim()));
          const manual = prev.filter((p: ProcessoParte) => !apiNames.has((p.nome || '').toLowerCase().trim()));
          return [...newPartes, ...manual];
        });
        setMovimentos(newMovs);
        setFormData(prev => ({ ...prev,
          titulo_acao:       fields.classe          || prev.titulo_acao,
          status:            mapStatus(proc.status),
          tribunal:          fields.tribunal        || prev.tribunal,
          orgao_julgador:    fields.orgaoJulgador   || prev.orgao_julgador,
          vara_comarca:      fields.varaComarca     || prev.vara_comarca,
          grau:              fields.grau            || prev.grau,
          assunto:           fields.assunto         || prev.assunto,
          assunto_cnj:       fields.assuntoCnj      || prev.assunto_cnj,
          classe_cnj:        fields.classeCnj       || prev.classe_cnj,
          valor_causa:       fields.valorCausa != null ? fmtMoney(fields.valorCausa) : prev.valor_causa,
          data_distribuicao: toDate(fields.dataDistrib) || prev.data_distribuicao,
        }));
        if (processo?.id) {
          await supabase.from('processos').update({
            titulo_acao: fields.classe || null, status: mapStatus(proc.status),
            tribunal: fields.tribunal || null, orgao_julgador: fields.orgaoJulgador || null,
            vara_comarca: fields.varaComarca || null, assunto: fields.assunto || null,
            assunto_cnj: fields.assuntoCnj || null, classe_cnj: fields.classeCnj || null,
            valor_causa: fields.valorCausa || null,
            partes_json: newPartes.length > 0 ? newPartes : null, movimentos_json: newMovs.length > 0 ? newMovs : null,
            ultima_consulta_api_at: new Date().toISOString(), data_ultima_atualizacao: new Date().toISOString(),
          }).eq('id', processo.id);
          fetchProcessos();
        }
        if (!silent) toast.success('Atualizado!', { description: `${newMovs.length} movimentações · ${newPartes.length} partes` });
      } else { if (!silent) toast.error('Não encontrado', { description: data?.mensagem }); }
    } catch (err: any) { if (!silent) toast.error('Erro ao consultar APIs', { description: err?.message }); }
    finally { setFetchingData(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const resolvedClienteId = formData.cliente_id === '__none__' ? null : formData.cliente_id || null;
      // Priority: manual field > CRM lead > polo ativo
      let nomeCliente: string | null = formData.nome_cliente?.trim() || null;
      if (!nomeCliente && resolvedClienteId) { const l = leads.find(l => l.id === resolvedClienteId); if (l?.nome) nomeCliente = l.nome; }
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
        if (result?.error) {
          const msg = (result.error as any).message || 'Erro ao criar processo';
          setSaveError(msg);
          toast.error(msg);
          return;
        }
        savedId = (result?.data as any)?.id || null;
      } else if (processo) {
        const result = await updateProcesso(processo.id, data);
        if (result?.error) {
          const msg = (result.error as any).message || 'Erro ao atualizar processo';
          setSaveError(msg);
          toast.error(msg);
          return;
        }
        savedId = processo.id;
      }

      if (savedId) {
        await supabase.from('processo_partes').delete().eq('processo_id', savedId);
        if (partes.length > 0) {
          const { error: partesErr } = await supabase.from('processo_partes').insert(partes.map(p => ({ processo_id: savedId!, nome: p.nome, tipo: p.tipo, polo: p.polo || null, tipo_pessoa: p.tipoPessoa || null, documento: p.documento || null, celular: p.celular || null, telefone_adicional: (p as any).telefone_adicional || null, advogados: p.advogados || null })));
          if (partesErr) console.error('[ProcessoModal] Erro ao salvar partes:', partesErr.message);
        }
      }
      clearDraft();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Erro inesperado';
      setSaveError(msg);
      toast.error('Erro inesperado', { description: msg });
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

  const handleSavePartes = async () => {
    if (!processo?.id) return;
    const id = processo.id;
    await supabase.from('processo_partes').delete().eq('processo_id', id);
    if (partes.length > 0) {
      const { error } = await supabase.from('processo_partes').insert(partes.map(p => ({
        processo_id: id, nome: p.nome, tipo: p.tipo, polo: p.polo || null,
        tipo_pessoa: p.tipoPessoa || null, documento: p.documento || null,
        celular: p.celular || null, telefone_adicional: (p as any).telefone_adicional || null,
        advogados: p.advogados || null,
      })));
      if (error) { toast.error('Erro ao salvar partes', { description: error.message }); return; }
    }
    setPartesModificadas(false);
    toast.success('Partes salvas!');
  };

  // Auto-save partes 1.5 s after any change (only for existing processes)
  useEffect(() => {
    if (!partesModificadas || isNew || !processo?.id) return;
    if (autoSavePartesTimerRef.current) clearTimeout(autoSavePartesTimerRef.current);
    autoSavePartesTimerRef.current = setTimeout(() => { handleSavePartes(); }, 1500);
    return () => { if (autoSavePartesTimerRef.current) clearTimeout(autoSavePartesTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partes, partesModificadas, isNew, processo?.id]);

  const handleVincularComoPai = async (paiId: string) => {
    if (!processo?.id) return;
    const { error } = await supabase.from('processos').update({ processo_pai_id: paiId }).eq('id', processo.id);
    if (error) { toast.error('Erro ao vincular', { description: error.message }); return; }
    const found = vinculoResultados.find(r => r.id === paiId) as any;
    if (found) setProcessoPai({ id: found.id, numero_processo: found.numero_processo, titulo_acao: found.titulo_acao, status: found.status, fase: null });
    setVinculoBusca(''); setVinculoResultados([]);
    toast.success('Processo principal vinculado!');
  };

  const handleDesvincularPai = async () => {
    if (!processo?.id) return;
    const { error } = await supabase.from('processos').update({ processo_pai_id: null }).eq('id', processo.id);
    if (error) { toast.error('Erro ao desvincular', { description: error.message }); return; }
    setProcessoPai(null);
    toast.success('Desvinculado!');
  };

  const handleVincularComoFilho = async (filhoId: string) => {
    if (!processo?.id) return;
    const { error } = await supabase.from('processos').update({ processo_pai_id: processo.id }).eq('id', filhoId);
    if (error) { toast.error('Erro ao vincular', { description: error.message }); return; }
    const found = vinculoResultados.find(r => r.id === filhoId) as any;
    if (found) setProcessoFilhos(prev => [...prev, { id: found.id, numero_processo: found.numero_processo, titulo_acao: found.titulo_acao, status: found.status, fase: null }]);
    setVinculoBusca(''); setVinculoResultados([]);
    toast.success('Processo filho vinculado!');
  };

  const handleDesvincularFilho = async (filhoId: string) => {
    const { error } = await supabase.from('processos').update({ processo_pai_id: null }).eq('id', filhoId);
    if (error) { toast.error('Erro ao desvincular', { description: error.message }); return; }
    setProcessoFilhos(prev => prev.filter(f => f.id !== filhoId));
    toast.success('Desvinculado!');
  };

  const handleCriarProcessoFilho = async () => {
    if (!processo?.id || !novoFilhoTitulo.trim()) return;
    setCriandoFilho(true);
    try {
      const numCnj = novoFilhoNumero.trim() || null;
      const { data, error } = await supabase.from('processos').insert({
        titulo_acao: novoFilhoTitulo.trim(),
        processo_pai_id: processo.id,
        status: 'Em Andamento',
        numero_processo: numCnj,
        cnj_normalizado: normalizarCNJ(numCnj),
      }).select('id,numero_processo,titulo_acao,status,fase').single();
      if (error) { toast.error('Erro ao criar subprocesso', { description: error.message }); return; }
      setProcessoFilhos(prev => [...prev, data as any]);
      setNovoFilhoNumero('');
      setNovoFilhoTitulo('');
      setShowNovoFilhoForm(false);
      toast.success('Subprocesso criado!', { description: data.titulo_acao });
      if (numCnj && CNJ_REGEX.test(numCnj)) {
        supabase.functions.invoke('consulta-processos', {
          body: { numeroProcesso: numCnj, force_refresh: true, persistir: true, processo_id: data.id },
        }).catch(() => {});
      }
    } finally { setCriandoFilho(false); }
  };

  const handleVerificarTodos = async () => {
    const todos = [
      ...(processo ? [processo] : []),
      ...processoFilhos,
    ].filter(p => p.numero_processo && CNJ_REGEX.test(p.numero_processo.trim()));
    if (!todos.length) { toast.error('Nenhum número CNJ válido para verificar'); return; }
    setVerificandoTodos(true);
    setVerificacaoStatus({});
    const results: Record<string, 'ok' | 'erro'> = {};
    for (const p of todos) {
      try {
        const { data } = await supabase.functions.invoke('consulta-processos', {
          body: { numeroProcesso: p.numero_processo!.trim() },
        });
        results[p.id] = data?.encontrado ? 'ok' : 'erro';
      } catch { results[p.id] = 'erro'; }
      setVerificacaoStatus({ ...results });
    }
    setVerificandoTodos(false);
    const ok  = Object.values(results).filter(v => v === 'ok').length;
    const err = Object.values(results).filter(v => v === 'erro').length;
    toast.success(`Verificação: ${ok} encontrado${ok !== 1 ? 's' : ''}${err ? `, ${err} não encontrado${err !== 1 ? 's' : ''}` : ''}`);
  };

  // ── Tarefas do processo ──────────────────────────────────────────────────────
  const fetchProcessoTarefas = useCallback(async () => {
    if (!processo?.id || isNew) return;
    setTarefasLoading(true);
    const { data } = await supabase.from('tarefas').select('*').eq('processo_id', processo.id).order('created_at', { ascending: false });
    setProcessoTarefas((data as Tarefa[]) || []);
    setTarefasLoading(false);
  }, [processo?.id, isNew]);

  useEffect(() => {
    if (activeTab === 'tarefas') {
      fetchProcessoTarefas();
      if (membros.length === 0) {
        supabase.from('perfis').select('id, nome, sobrenome, email').eq('aprovado', true)
          .then(({ data }) => { if (data) setMembros(data as any); });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, processo?.id]);

  const handleCriarTarefa = async () => {
    if (!novaTarefaTitulo.trim() || !processo?.id) return;
    setCriandoTarefa(true);
    const { error } = await supabase.from('tarefas').insert({
      titulo:           novaTarefaTitulo.trim(),
      descricao:        novaTarefaDescricao.trim() || null,
      processo_id:      processo.id,
      cliente_id:       formData.cliente_id && formData.cliente_id !== '__none__' ? formData.cliente_id : null,
      responsavel_id:   novaTarefaResponsavel !== 'none' ? novaTarefaResponsavel : null,
      prioridade:       novaTarefaPrioridade,
      status:           'Pendente',
      prazo_fatal:      novaTarefaPrazoFatal || null,
      data_limite:      novaTarefaPrazoFatal || null,
      horario:          novaTarefaHorario || null,
      prazo_seguranca:  null, data_conclusao: null,
      started_at: null, entrega_texto: null, entrega_anexo_url: null,
      entregue_em: null, aprovacao_status: null, aprovacao_nota: null,
      aprovacao_feedback: null, aprovado_por: null, aprovado_em: null,
    });
    if (error) { toast.error('Erro ao criar tarefa', { description: error.message }); }
    else {
      toast.success('Tarefa criada!');
      setNovaTarefaTitulo(''); setNovaTarefaDescricao('');
      setNovaTarefaResponsavel('none'); setNovaTarefaPrioridade('Media');
      setNovaTarefaPrazoFatal(''); setNovaTarefaHorario(''); setShowNovaTarefaForm(false);
    }
    setCriandoTarefa(false);
    fetchProcessoTarefas();
  };

  const handleUpdateTarefaStatus = async (id: string, status: Tarefa['status']) => {
    await supabase.from('tarefas').update({ status, ...(status === 'Concluída' ? { data_conclusao: new Date().toISOString().slice(0, 10) } : {}) }).eq('id', id);
    fetchProcessoTarefas();
  };

  const clienteSelecionado = leads.find(l => l.id === formData.cliente_id);
  const hasPartes  = partes.length > 0;
  const isValidCnj = CNJ_REGEX.test((formData.numero_processo || '').trim());
  const statusCfg  = STATUS_CONFIG[formData.status] || STATUS_CONFIG['Arquivado'];
  const barColor   = statusCfg.barColor;
  const StatusIcon = statusCfg.icon;
  const clienteName = clienteSelecionado?.nome
    || partes.find(p => p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT')?.nome;

  const infoStripVisible = !isNew && !!(
    clienteName || formData.advogado_responsavel || formData.data_distribuicao ||
    formData.valor_causa || formData.fase || movimentos.length > 0
  );


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="w-[96vw] max-w-[1200px] rounded-2xl overflow-hidden flex flex-col p-0 gap-0"
          style={{ height: '94vh', maxHeight: '94vh' }}
        >
          <DialogHeader className="sr-only"><DialogTitle>{isNew ? 'Novo Processo' : 'Detalhes do Processo'}</DialogTitle></DialogHeader>

          {/* ── Header ── */}
          <div className="relative overflow-hidden shrink-0">
            {/* Status-colored top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 transition-all duration-500"
              style={{ background: `linear-gradient(90deg, ${barColor}, ${barColor}88, ${barColor}33)` }} />
            <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border/60">
              <div className="flex items-center gap-3 min-w-0">
                {/* Icon with status color */}
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-all duration-500"
                  style={{ background: `linear-gradient(135deg, ${barColor}, ${barColor}bb)`, boxShadow: `0 4px 12px ${barColor}40` }}>
                  <Scale className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-sm font-black text-foreground leading-none truncate max-w-[340px]">
                      {isNew ? 'Novo Processo' : (formData.titulo_acao || formData.classe_cnj || 'Detalhes do Processo')}
                    </h2>
                    {!isNew && formData.status && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.cls}`}>
                        <StatusIcon className="h-3 w-3 shrink-0" />{formData.status}
                      </span>
                    )}
                  </div>
                  {formData.numero_processo && (
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Hash className="h-2.5 w-2.5 shrink-0" />{formData.numero_processo}
                    </p>
                  )}
                  {!isNew && clienteName && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1 truncate max-w-[360px]">
                      <Users className="h-2.5 w-2.5 shrink-0" />{clienteName}
                    </p>
                  )}
                  {!isNew && processo?.ultima_consulta_api_at && (
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                      Sync: {new Date(processo.ultima_consulta_api_at).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit' })}
                      {fetchingData && ' · Atualizando...'}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {fetchingData && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {formData.valor_causa && !isNew && (
                  <span className="hidden lg:flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    {(() => { const n = parseFloat(formData.valor_causa.replace(/\./g,'').replace(',','.')); return isNaN(n) ? formData.valor_causa : n.toLocaleString('pt-BR',{maximumFractionDigits:0}); })()}
                  </span>
                )}
                {formData.tribunal && (
                  <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/40">
                    <Building2 className="h-3.5 w-3.5" />{formData.tribunal}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Info Strip ── */}
          {infoStripVisible && (
            <div className="px-6 py-2.5 bg-muted/20 border-b border-border/30 shrink-0 flex items-center gap-4 flex-wrap">
              {formData.advogado_responsavel && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <BadgeCheck className="h-3 w-3 text-blue-500 shrink-0" />
                  {formData.advogado_responsavel.replace(/\s*\(OAB.*\)/i, '')}
                </span>
              )}
              {formData.data_distribuicao && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {new Date(formData.data_distribuicao + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
              {formData.fase && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/40">
                  {formData.fase}
                </span>
              )}
              {formData.area && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40">
                  {formData.area}
                </span>
              )}
              {movimentos.length > 0 && (
                <button
                  onClick={() => setActiveTab('movimentos')}
                  className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  <Activity className="h-3 w-3 shrink-0" />
                  {movimentos.length} movimentaç{movimentos.length === 1 ? 'ão' : 'ões'} →
                </button>
              )}
            </div>
          )}

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 pb-3 shrink-0 bg-card border-b border-border/40">
              <TabsList className="h-9 bg-muted/40 rounded-xl p-1 gap-0.5 border border-border/30">
                <TabsTrigger value="processo" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm data-[state=active]:bg-card font-semibold">
                  <Scale className="h-3.5 w-3.5" /> Processo
                </TabsTrigger>
                <TabsTrigger value="movimentos" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm data-[state=active]:bg-card font-semibold">
                  <Activity className="h-3.5 w-3.5" /> Movimentos
                  {movimentos.length > 0 && (
                    <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center border border-primary/15">
                      {movimentos.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notificacoes" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm data-[state=active]:bg-card font-semibold">
                  <MessageSquare className="h-3.5 w-3.5" /> Notificações
                </TabsTrigger>
                {!isNew && (
                  <TabsTrigger value="tarefas" className="rounded-lg text-xs h-7 px-4 gap-1.5 data-[state=active]:shadow-sm data-[state=active]:bg-card font-semibold">
                    <ListTodo className="h-3.5 w-3.5" /> Tarefas
                    {processoTarefas.length > 0 && (
                      <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center border border-primary/15">
                        {processoTarefas.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ── TAB PROCESSO ── */}
            <TabsContent value="processo" className="flex-1 min-h-0 mt-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              {/* Layout: form à esquerda | divider | partes à direita */}
              <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* Form — scroll interno */}
                <ScrollArea className="flex-1 min-w-0 h-full">
                  <div className="px-6 py-5 space-y-5">

                    <div>
                      <SectionTitle icon={Hash} label="Numeração" />
                      <FieldGroup>
                        <Row2>
                          <Field label="Número CNJ (Principal)">
                            <div className="relative">
                              <Input value={formData.numero_processo} onChange={e => update('numero_processo', e.target.value)} className="rounded-xl bg-card font-mono text-sm pr-9 h-10" placeholder="0000000-00.0000.0.00.0000" />
                              {fetchingData && isNew && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                              {!fetchingData && isValidCnj && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
                            </div>
                            {isNew && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Digite para carregar automaticamente</p>}
                          </Field>
                          <Field label="Número Complementar">
                            <Input value={formData.numero_complementar} onChange={e => update('numero_complementar', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Opcional" />
                          </Field>
                        </Row2>

                        {/* ── Subprocessos inline na Numeração ── */}
                        {!isNew && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <GitBranch className="h-3 w-3 text-violet-500" />
                                Subprocessos {processoFilhos.length > 0 && `(${processoFilhos.length})`}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {(isValidCnj || processoFilhos.some(f => f.numero_processo && CNJ_REGEX.test(f.numero_processo.trim()))) && (
                                  <Button type="button" variant="outline" size="sm"
                                    className="h-6 text-[10px] px-2 rounded-lg gap-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400"
                                    onClick={handleVerificarTodos} disabled={verificandoTodos}>
                                    {verificandoTodos ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <BadgeCheck className="h-2.5 w-2.5" />}
                                    Verificar Todos
                                  </Button>
                                )}
                                <Button type="button" variant="ghost" size="sm"
                                  className="h-6 text-[10px] px-1.5 rounded-md gap-0.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400"
                                  onClick={() => setShowNovoFilhoForm(v => !v)}>
                                  <Plus className="h-3 w-3" /> Novo
                                </Button>
                              </div>
                            </div>

                            {showNovoFilhoForm && (
                              <div className="mb-2 p-2.5 rounded-xl border border-violet-200/60 bg-violet-50/20 dark:border-violet-800/30 dark:bg-violet-950/10 space-y-2">
                                <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-400">Criar subprocesso vinculado</p>
                                <Input
                                  value={novoFilhoTitulo}
                                  onChange={e => setNovoFilhoTitulo(e.target.value)}
                                  className="h-8 text-xs rounded-lg bg-card"
                                  placeholder="Título / classe *"
                                />
                                <Input
                                  value={novoFilhoNumero}
                                  onChange={e => setNovoFilhoNumero(e.target.value)}
                                  className="h-8 text-xs rounded-lg bg-card font-mono"
                                  placeholder="Número CNJ (opcional)"
                                />
                                <div className="flex gap-1.5">
                                  <Button type="button" size="sm"
                                    className="flex-1 h-7 text-[11px] rounded-lg gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                                    onClick={handleCriarProcessoFilho}
                                    disabled={criandoFilho || !novoFilhoTitulo.trim()}>
                                    {criandoFilho ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                    Criar
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm"
                                    className="h-7 text-[11px] rounded-lg px-2"
                                    onClick={() => { setShowNovoFilhoForm(false); setNovoFilhoNumero(''); setNovoFilhoTitulo(''); }}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {processoFilhos.length > 0 ? (
                              <div className="space-y-1.5">
                                {processoFilhos.map(filho => (
                                  <div key={filho.id} className="flex items-center gap-2 p-2 rounded-xl border border-border/40 bg-muted/20">
                                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-mono truncate text-muted-foreground">{filho.numero_processo || '—'}</p>
                                      <p className="text-[11px] font-semibold truncate text-foreground">{filho.titulo_acao || '-'}</p>
                                    </div>
                                    {filho.status && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted border border-border/50 text-muted-foreground shrink-0">{filho.status}</span>}
                                    {verificacaoStatus[filho.id] === 'ok' && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                    {verificacaoStatus[filho.id] === 'erro' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/40 hover:text-destructive shrink-0" onClick={() => handleDesvincularFilho(filho.id)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : !showNovoFilhoForm && (
                              <p className="text-[10px] text-muted-foreground/40 italic">Nenhum subprocesso — clique em "+ Novo" para adicionar</p>
                            )}
                          </div>
                        )}
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
                        {/* Nome do Cliente — campo principal */}
                        <Field label="Nome do Cliente">
                          <div className="flex gap-2">
                            <Input
                              value={formData.nome_cliente}
                              onChange={e => update('nome_cliente', e.target.value)}
                              className="rounded-xl bg-card h-10 flex-1"
                              placeholder="Nome do cliente (manual ou via CRM)"
                            />
                            {clienteSelecionado?.nome && formData.nome_cliente !== clienteSelecionado.nome && (
                              <Button type="button" variant="outline" size="sm"
                                className="h-10 px-3 rounded-xl text-xs shrink-0 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                                onClick={() => update('nome_cliente', clienteSelecionado.nome)}>
                                ← CRM
                              </Button>
                            )}
                          </div>
                          {clienteSelecionado?.nome && (
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Users className="h-2.5 w-2.5 text-primary shrink-0" />
                              CRM vinculado: <span className="font-semibold text-foreground/70">{clienteSelecionado.nome}</span>
                            </p>
                          )}
                        </Field>

                        <Row2>
                          <Field label="Vincular ao CRM">
                            <div className="space-y-1.5">
                              <Select
                                value={formData.cliente_id || '__none__'}
                                onValueChange={v => {
                                  const id = v === '__none__' ? '' : v;
                                  const lead = id ? leads.find(l => l.id === id) : null;
                                  setFormData(prev => ({ ...prev, cliente_id: id, nome_cliente: lead?.nome || prev.nome_cliente }));
                                }}
                              >
                                <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Não vincular</SelectItem>
                                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}{l.telefone ? ` · ${l.telefone}` : ''}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <button type="button" onClick={() => setNovoClienteOpen(true)} className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-semibold transition-colors">
                                <UserPlus className="h-3 w-3" /> Criar novo e vincular
                              </button>
                            </div>
                          </Field>
                          <Field label="Marcadores">
                            <Input value={formData.marcadores} onChange={e => update('marcadores', e.target.value)} className="rounded-xl bg-card h-10" placeholder="Separados por vírgula" />
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
                        <Field label="Vara / Comarca">
                          <Input
                            value={formData.vara_comarca}
                            onChange={e => update('vara_comarca', e.target.value)}
                            className="rounded-xl bg-card h-10"
                            placeholder="Ex: Comarca de Manaus"
                            title={formData.vara_comarca}
                          />
                        </Field>
                        <Field label="Órgão Julgador">
                          <Input
                            value={formData.orgao_julgador}
                            onChange={e => update('orgao_julgador', e.target.value)}
                            className="rounded-xl bg-card h-10"
                            placeholder="Ex: 2ª Vara Cível"
                            title={formData.orgao_julgador}
                          />
                        </Field>
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
                            {(() => {
                              const areaOpts = ['Cível','Trabalhista','Criminal','Tributário','Previdenciário','Administrativo','Consumidor','Família'];
                              const currentArea = formData.area || '';
                              const hasExtra = currentArea && !areaOpts.includes(currentArea);
                              return (
                                <Select value={currentArea || '__none__'} onValueChange={v => update('area', v === '__none__' ? '' : v)}>
                                  <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Selecione</SelectItem>
                                    {hasExtra && <SelectItem value={currentArea}>{currentArea}</SelectItem>}
                                    {areaOpts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </Field>
                          <Field label="Fase">
                            {(() => {
                              const faseOpts = ['Conhecimento','Execução','Recursal','Cumprimento de Sentença','Liquidação'];
                              const currentFase = formData.fase || '';
                              const hasExtra = currentFase && !faseOpts.includes(currentFase);
                              return (
                                <Select value={currentFase || '__none__'} onValueChange={v => update('fase', v === '__none__' ? '' : v)}>
                                  <SelectTrigger className="rounded-xl bg-card h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Selecione</SelectItem>
                                    {hasExtra && <SelectItem value={currentFase}>{currentFase}</SelectItem>}
                                    {faseOpts.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
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

                    <div>
                      <SectionTitle icon={GitBranch} label="Vínculos Processuais" bg="bg-violet-500/10" color="text-violet-600 dark:text-violet-400" />
                      <FieldGroup>
                        {processoPai ? (
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <FolderOpen className="h-3 w-3 text-violet-500" /> Processo Principal
                            </p>
                            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-violet-200/60 bg-violet-50/30 dark:border-violet-800/30 dark:bg-violet-950/10">
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono truncate text-muted-foreground">{processoPai.numero_processo}</p>
                                <p className="text-[11px] font-semibold truncate text-foreground">{processoPai.titulo_acao || '-'}</p>
                              </div>
                              {verificacaoStatus[processoPai.id] === 'ok' && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                              {verificacaoStatus[processoPai.id] === 'erro' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive shrink-0" onClick={handleDesvincularPai}>
                                <Link2Off className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : !isNew && (
                          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
                            <FolderOpen className="h-3 w-3" /> Sem processo principal vinculado
                          </p>
                        )}
                        {!isNew && (
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Vincular Processo Existente</p>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                              <Input value={vinculoBusca} onChange={e => setVinculoBusca(e.target.value)} className="pl-9 h-9 rounded-xl text-xs bg-card" placeholder="Buscar por número ou título..." />
                              {vinculoBuscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            </div>
                            {vinculoResultados.length > 0 && (
                              <div className="mt-1.5 rounded-xl border border-border/50 bg-card overflow-hidden">
                                {vinculoResultados.map(r => (
                                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors border-b border-border/20 last:border-0">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-mono truncate text-muted-foreground">{r.numero_processo}</p>
                                      <p className="text-[11px] truncate text-foreground">{r.titulo_acao || '-'}</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      {!processoPai && (
                                        <Button type="button" variant="outline" size="sm"
                                          className="h-6 text-[10px] px-2 rounded-lg gap-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400"
                                          onClick={() => handleVincularComoPai(r.id)}>
                                          <FolderOpen className="h-2.5 w-2.5" /> Pai
                                        </Button>
                                      )}
                                      <Button type="button" variant="outline" size="sm"
                                        className="h-6 text-[10px] px-2 rounded-lg gap-1"
                                        onClick={() => handleVincularComoFilho(r.id)}>
                                        <Link2 className="h-2.5 w-2.5" /> Filho
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </FieldGroup>
                    </div>

                  </div>
                </ScrollArea>

                {/* Divider */}
                <div className="w-px bg-border/40 shrink-0" />

                {/* Partes — largura responsiva, sem overflow */}
                <div className="w-[300px] xl:w-[340px] shrink-0 flex flex-col overflow-hidden h-full bg-muted/5">
                  <div className="px-4 pt-3.5 pb-3 border-b border-border/40 shrink-0 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest leading-none">Partes</h3>
                        <p className="text-[10px] text-muted-foreground/50 leading-none mt-0.5">polo ativo e passivo</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        {hasPartes && (
                          <span className={`h-5 min-w-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center border ${partesModificadas ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-primary/10 text-primary border-primary/15'}`}>
                            {partes.length}
                          </span>
                        )}
                        {partesModificadas && !isNew && (
                          <Button type="button" size="sm" variant="outline"
                            className="h-6 text-[10px] px-2 rounded-lg gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                            onClick={handleSavePartes}>
                            <CheckCircle2 className="h-3 w-3" /> Salvar
                          </Button>
                        )}
                      </div>
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
                          onUpdate={(idx, field, val) => { setPartes(prev => prev.map((p, j) => j === idx ? { ...p, [field]: val } : p)); setPartesModificadas(true); }}
                          onRemove={idx => { setPartes(prev => prev.filter((_, j) => j !== idx)); setPartesModificadas(true); }}
                        />
                      ))}
                      <AddParteForm onAdd={parte => { setPartes(prev => [...prev, parte]); setPartesModificadas(true); }} />
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
                    <div className="space-y-1.5 pb-6">
                      {/* Summary bar */}
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Activity className="h-3.5 w-3.5 text-primary" />
                          </span>
                          <div>
                            <p className="text-xs font-bold text-foreground leading-none">{movimentosEnriquecidos.length} movimentaç{movimentosEnriquecidos.length === 1 ? 'ão' : 'ões'}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">clique para ver detalhes</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl h-8 gap-1.5 text-xs border-border/60" onClick={() => handleRefreshStatus(false)} disabled={fetchingData || !isValidCnj}>
                          {fetchingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Atualizar
                        </Button>
                      </div>
                      {movimentosEnriquecidos.map((mov, i) => (
                        <div key={i} className="group flex items-start gap-3 p-3.5 rounded-2xl border border-border/30 bg-card hover:bg-accent/20 hover:border-border cursor-pointer transition-all duration-150 hover:shadow-sm"
                          onClick={() => { setSelectedMovimento(mov); setMovModalOpen(true); }}>
                          <div className="shrink-0 mt-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoriaColor(mov.categoria)}`}>{mov.badge}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-snug">{mov.titulo_humano}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mov.descricao_humana}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 self-start">
                            <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-md border border-border/30">{mov.dataHora}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── TAB TAREFAS ── */}
            <TabsContent value="tarefas" className="flex-1 min-h-0 mt-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-6 py-5 pb-16 space-y-4">

                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ListTodo className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Tarefas do Processo</p>
                        <p className="text-[10px] text-muted-foreground">Aparecem também na página de Tarefas</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 rounded-xl text-xs gap-1.5"
                      onClick={() => setShowNovaTarefaForm(v => !v)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nova Tarefa
                    </Button>
                  </div>

                  {/* Formulário de nova tarefa */}
                  {showNovaTarefaForm && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
                      <p className="text-[11px] font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <Plus className="h-3 w-3 text-primary" /> Nova Tarefa
                      </p>
                      {/* Título */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Título *</label>
                        <Input
                          value={novaTarefaTitulo}
                          onChange={e => setNovaTarefaTitulo(e.target.value)}
                          placeholder="O que precisa ser feito?"
                          className="h-9 rounded-xl bg-card text-sm"
                          autoFocus
                        />
                      </div>
                      {/* Descrição */}
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Descrição</label>
                        <Textarea
                          value={novaTarefaDescricao}
                          onChange={e => setNovaTarefaDescricao(e.target.value)}
                          placeholder="Detalhes opcionais..."
                          rows={2}
                          className="rounded-xl bg-card text-sm resize-none"
                        />
                      </div>
                      {/* Responsável + Prioridade */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Responsável</label>
                          <select
                            value={novaTarefaResponsavel}
                            onChange={e => setNovaTarefaResponsavel(e.target.value)}
                            className="flex h-9 w-full rounded-xl border border-input bg-card px-3 text-sm"
                          >
                            <option value="none">Sem responsável</option>
                            {membros.map(m => (
                              <option key={m.id} value={m.id}>
                                {[m.nome, m.sobrenome].filter(Boolean).join(' ') || m.email || 'Usuário'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Prioridade</label>
                          <select
                            value={novaTarefaPrioridade}
                            onChange={e => setNovaTarefaPrioridade(e.target.value as Tarefa['prioridade'])}
                            className="flex h-9 w-full rounded-xl border border-input bg-card px-3 text-sm"
                          >
                            <option value="Baixa">Baixa</option>
                            <option value="Media">Média</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">🔴 Urgente</option>
                          </select>
                        </div>
                      </div>
                      {/* Prazo + Horário */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Prazo Fatal</label>
                          <Input
                            type="date"
                            value={novaTarefaPrazoFatal}
                            onChange={e => setNovaTarefaPrazoFatal(e.target.value)}
                            className="h-9 rounded-xl bg-card text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Horário</label>
                          <Input
                            type="time"
                            value={novaTarefaHorario}
                            onChange={e => setNovaTarefaHorario(e.target.value)}
                            className="h-9 rounded-xl bg-card text-sm"
                          />
                        </div>
                      </div>
                      {/* Botões */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleCriarTarefa}
                          disabled={criandoTarefa || !novaTarefaTitulo.trim()}
                          className="flex-1 rounded-xl h-9 gap-1.5"
                        >
                          {criandoTarefa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          {criandoTarefa ? 'Criando...' : 'Criar Tarefa'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setShowNovaTarefaForm(false); setNovaTarefaTitulo(''); }}
                          className="rounded-xl h-9 px-4"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de tarefas */}
                  {tarefasLoading ? (
                    <div className="flex items-center justify-center py-10 gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Carregando tarefas...</span>
                    </div>
                  ) : processoTarefas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-border/40 rounded-2xl">
                      <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                        <ListTodo className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Nenhuma tarefa ainda</p>
                      <p className="text-xs text-muted-foreground">Clique em "Nova Tarefa" para adicionar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {processoTarefas.map(tarefa => (
                        <TarefaRowModal
                          key={tarefa.id}
                          tarefa={tarefa}
                          membros={membros}
                          onStatusChange={handleUpdateTarefaStatus}
                        />
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
          {saveError && (
            <div className="px-6 py-2 bg-destructive/10 border-t border-destructive/20 shrink-0 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-xs text-destructive font-medium">{saveError}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/50 bg-card/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-2">
              {!isNew && canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 h-9 gap-1.5 px-3">
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Excluir</span>
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
              {activeTab === 'processo' && (
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 border-border/60 text-xs" onClick={() => handleRefreshStatus(false)} disabled={fetchingData || !isValidCnj}>
                  {fetchingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {isNew ? 'Buscar DataJud' : 'Atualizar CNJ'}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-xl h-9 text-muted-foreground hover:text-foreground" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="rounded-xl px-6 h-9 shadow-sm font-bold gap-1.5 transition-all"
                style={{ background: barColor, boxShadow: `0 2px 8px ${barColor}50` }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                  : isNew ? <><Plus className="h-3.5 w-3.5" /> Criar Processo</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Salvar</>
                }
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
