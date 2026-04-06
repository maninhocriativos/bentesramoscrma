import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trash2, Loader2, Users, BadgeCheck, RefreshCw, MessageSquare,
  Building2, Scale, Calendar, DollarSign, Gavel, Plus, X, Tag,
  FileText, Bell, Hash, FolderOpen, Shield, Pencil, ChevronRight,
  MapPin, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProcessoModalExpandedProps {
  processo: Processo | null;
  isOpen: boolean;
  onClose: () => void;
  isNew?: boolean;
  canDelete?: boolean;
  leads: LeadName[];
}

type ProcessoFormData = {
  numero_processo: string;
  numero_complementar: string;
  titulo_acao: string;
  status: ProcessoStatus;
  advogado_responsavel: string;
  cliente_id: string;
  cpf_cliente: string;
  tribunal: string;
  vara_comarca: string;
  assunto: string;
  valor_causa: string;
  orgao_julgador: string;
  grau: string;
  origem_cliente: string;
  descricao: string;
  marcadores: string;
  area: string;
  fase: string;
  classe_cnj: string;
  assunto_cnj: string;
  segredo_justica: boolean;
  data_distribuicao: string;
  data_citacao: string;
  data_recebimento: string;
  data_arquivamento: string;
  data_encerramento: string;
  valor_provisionado: string;
  probabilidade: string;
  monitorar_push: boolean;
  tipo_orgao_julgador: string;
  sistema_judicial: string;
  complemento_enderecamento: string;
};

interface ProcessoModalDraft {
  formData: ProcessoFormData;
  partes: ProcessoParte[];
  movimentos: ProcessoMovimento[];
  updatedAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUSES: ProcessoStatus[] = ['Em Andamento', 'Suspenso', 'Arquivado', 'Ganho', 'Perdido'];
const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
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

const STATUS_STYLE: Record<string, string> = {
  'Em Andamento': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  'Ganho':        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400',
  'Perdido':      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400',
  'Suspenso':     'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
  'Arquivado':    'bg-muted text-muted-foreground border-border',
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, label, color = 'text-primary', bg = 'bg-primary/10' }: {
  icon: React.ElementType; label: string; color?: string; bg?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`h-6 w-6 rounded-md ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-4 border border-border/30">
      {children}
    </div>
  );
}

function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-1 md:grid-cols-2', 3: 'grid-cols-1 md:grid-cols-3', 4: 'grid-cols-2 md:grid-cols-4' }[cols];
  return <div className={`grid ${grid} gap-3`}>{children}</div>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Parte Card ─────────────────────────────────────────────────────────────────

function ParteCard({ parte, index, onUpdate, onRemove }: {
  parte: ProcessoParte;
  index: number;
  onUpdate: (i: number, field: string, value: string) => void;
  onRemove: (i: number) => void;
}) {
  const tipoLower = (parte.tipo || '').toLowerCase();
  const isAutor = tipoLower.includes('autor');
  const isReu   = tipoLower.includes('réu') || tipoLower.includes('reu');
  const borderCls = isAutor ? 'border-l-emerald-500' : isReu ? 'border-l-red-500' : 'border-l-muted-foreground/30';
  const badgeCls  = isAutor
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
    : isReu
      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400'
      : 'bg-muted text-muted-foreground border-border';

  return (
    <Collapsible>
      <div className={`rounded-xl border border-border/50 bg-card border-l-[3px] ${borderCls}`}>
        <div className="flex items-center justify-between gap-2 p-3 pl-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{parte.nome}</p>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {parte.documento && <span className="text-[11px] text-muted-foreground">Doc: {parte.documento}</span>}
              {parte.celular    && <span className="text-[11px] text-muted-foreground">📱 {parte.celular}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${badgeCls}`}>{parte.tipo}</Badge>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-primary">
                <Pencil className="h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/50 hover:text-destructive" onClick={() => onRemove(index)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t border-border/30 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Nome</Label>
                <Input value={parte.nome || ''} onChange={e => onUpdate(index, 'nome', e.target.value)} className="h-8 text-xs rounded-lg bg-muted/30" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                <select value={parte.tipo || ''} onChange={e => onUpdate(index, 'tipo', e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-muted/30 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="Autor">Autor</option>
                  <option value="Réu">Réu</option>
                  <option value="Terceiro Interessado">Terceiro Interessado</option>
                  <option value="Advogado">Advogado</option>
                  <option value="Testemunha">Testemunha</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">CPF/CNPJ</Label>
                <Input value={parte.documento || ''} onChange={e => onUpdate(index, 'documento', e.target.value)} className="h-8 text-xs rounded-lg bg-muted/30" placeholder="Opcional" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Celular</Label>
                <Input value={parte.celular || ''} onChange={e => onUpdate(index, 'celular', e.target.value)} className="h-8 text-xs rounded-lg bg-muted/30" placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
      {parte.advogados && parte.advogados.length > 0 && (
        <div className="ml-4 mt-0.5 mb-1 pl-3 border-l-2 border-border/30 space-y-0.5">
          {parte.advogados.map((adv, j) => (
            <div key={j} className="flex items-center justify-between gap-2 py-0.5">
              <p className="text-[11px] font-medium truncate flex-1">{adv.nome}</p>
              {adv.oab && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                  <BadgeCheck className="h-3 w-3 text-primary" />{adv.oab}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Collapsible>
  );
}

// ─── Add Parte Form ─────────────────────────────────────────────────────────────

function AddParteForm({ onAdd }: { onAdd: (parte: ProcessoParte) => void }) {
  const [nome, setNome]     = useState('');
  const [tipo, setTipo]     = useState('');
  const [doc, setDoc]       = useState('');
  const [cel, setCel]       = useState('');

  const handleAdd = () => {
    if (!nome.trim() || !tipo) { toast.error('Preencha nome e tipo'); return; }
    onAdd({
      nome: nome.trim(), tipo,
      polo: tipo === 'Autor' ? 'AT' : tipo === 'Réu' ? 'PA' : 'TC',
      tipoPessoa: 'FISICA',
      documento: doc || undefined,
      celular: cel || undefined,
    });
    setNome(''); setTipo(''); setDoc(''); setCel('');
    toast.success(`"${nome.trim()}" adicionado — salve para persistir`);
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-3 space-y-2.5">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5 text-primary" /> Adicionar Parte
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Nome *</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-xs rounded-lg bg-card" placeholder="Nome da parte" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Tipo *</Label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Selecione</option>
            <option value="Autor">Autor</option>
            <option value="Réu">Réu</option>
            <option value="Terceiro Interessado">Terceiro Interessado</option>
            <option value="Advogado">Advogado</option>
            <option value="Testemunha">Testemunha</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">CPF/CNPJ</Label>
          <Input value={doc} onChange={e => setDoc(e.target.value)} className="h-8 text-xs rounded-lg bg-card" placeholder="Opcional" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Celular</Label>
          <Input value={cel} onChange={e => setCel(e.target.value)} className="h-8 text-xs rounded-lg bg-card" placeholder="(00) 00000-0000" />
        </div>
      </div>
      <Button type="button" size="sm" className="w-full h-8 rounded-xl text-xs" onClick={handleAdd}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ProcessoModalExpanded({
  processo, isOpen, onClose, isNew = false, canDelete = false, leads,
}: ProcessoModalExpandedProps) {
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

  const movimentosEnriquecidos = useMemo(() => enrichMovements(movimentos), [movimentos]);

  const update = useCallback((field: keyof ProcessoFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const processoId    = processo?.id ?? null;
  const draftKey      = useMemo(() => {
    const k = isNew ? '__new__' : processoId;
    return k ? `${DRAFT_PREFIX}:${k}` : null;
  }, [isNew, processoId]);

  const readDraft = useCallback((): ProcessoModalDraft | null => {
    if (!draftKey || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ProcessoModalDraft;
      if (!parsed?.formData) return null;
      const age = Date.now() - new Date(parsed.updatedAt || 0).getTime();
      if (age > DRAFT_MAX_AGE) { window.localStorage.removeItem(draftKey); return null; }
      return parsed;
    } catch { return null; }
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    if (draftKey && typeof window !== 'undefined') window.localStorage.removeItem(draftKey);
  }, [draftKey]);

  // Save draft on changes
  useEffect(() => {
    if (!isOpen || !draftKey || !draftHydrated) return;
    window.localStorage.setItem(draftKey, JSON.stringify({
      formData, partes: isNew ? partes : [], movimentos: isNew ? movimentos : [],
      updatedAt: new Date().toISOString(),
    }));
  }, [formData, partes, movimentos, draftKey, draftHydrated, isOpen, isNew]);

  // Hydrate from processo or draft
  useEffect(() => {
    const currentKey  = isNew ? '__new__' : processoId;
    const previousKey = wasNew ? '__new__' : lastLoadedId;
    if (currentKey === previousKey) return;

    setDraftHydrated(false);
    setActiveTab('processo');

    if (processo) {
      const p = processo as any;
      setFormData({
        numero_processo:          processo.numero_processo || '',
        numero_complementar:      p.numero_complementar || '',
        titulo_acao:              processo.titulo_acao || '',
        status:                   (processo.status as ProcessoStatus) || 'Em Andamento',
        advogado_responsavel:     processo.advogado_responsavel || '',
        cliente_id:               processo.cliente_id || '',
        cpf_cliente:              processo.cpf_cliente || '',
        tribunal:                 processo.tribunal || '',
        vara_comarca:             processo.vara_comarca || '',
        assunto:                  processo.assunto || '',
        valor_causa:              processo.valor_causa ? processo.valor_causa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        orgao_julgador:           processo.orgao_julgador || '',
        grau:                     processo.grau || '',
        origem_cliente:           p.origem_cliente || '',
        descricao:                p.descricao || '',
        marcadores:               p.marcadores || '',
        area:                     p.area || '',
        fase:                     p.fase || '',
        classe_cnj:               processo.classe_cnj || '',
        assunto_cnj:              p.assunto_cnj || '',
        segredo_justica:          p.segredo_justica || false,
        data_distribuicao:        p.data_distribuicao || '',
        data_citacao:             p.data_citacao || '',
        data_recebimento:         p.data_recebimento || '',
        data_arquivamento:        p.data_arquivamento || '',
        data_encerramento:        p.data_encerramento || '',
        valor_provisionado:       p.valor_provisionado ? String(p.valor_provisionado) : '',
        probabilidade:            p.probabilidade || '',
        monitorar_push:           p.monitorar_push ?? true,
        tipo_orgao_julgador:      p.tipo_orgao_julgador || '',
        sistema_judicial:         p.sistema_judicial || '',
        complemento_enderecamento: p.complemento_enderecamento || '',
      });
      setPartes(processo.partes_json || []);
      setMovimentos(processo.movimentos_json || []);
    } else {
      setFormData(createEmptyForm());
      setPartes([]);
      setMovimentos([]);
    }

    const draft = readDraft();
    if (draft?.formData) {
      setFormData(prev => {
        const merged = { ...prev, ...draft.formData, status: (draft.formData.status as ProcessoStatus) || prev.status };
        if (!isNew && processo) {
          if (!merged.numero_processo && prev.numero_processo) merged.numero_processo = prev.numero_processo;
          if (!merged.titulo_acao    && prev.titulo_acao)    merged.titulo_acao    = prev.titulo_acao;
          if (!merged.cliente_id     && prev.cliente_id)     merged.cliente_id     = prev.cliente_id;
        }
        return merged;
      });
      if (isNew) {
        setPartes(Array.isArray(draft.partes) ? draft.partes : []);
        setMovimentos(Array.isArray(draft.movimentos) ? draft.movimentos : []);
      }
    }

    setLastLoadedId(processoId);
    setWasNew(isNew);
    setDraftHydrated(true);
  }, [processo, processoId, isNew, lastLoadedId, wasNew, readDraft]);

  // Fetch partes + movimentos from DB
  useEffect(() => { setAutoFetchDone(false); }, [processoId]);

  useEffect(() => {
    if (!isNew && isOpen && processo?.id && !autoFetchDone) {
      setAutoFetchDone(true);
      (async () => {
        try {
          const { data: dbPartes } = await supabase.from('processo_partes').select('*').eq('processo_id', processo.id);
          if (dbPartes && dbPartes.length > 0) {
            setPartes(dbPartes.map((p: any) => ({
              nome: p.nome, tipo: p.tipo, polo: p.polo || '',
              tipoPessoa: p.tipo_pessoa || '', documento: p.documento || '',
              celular: p.celular || '', telefone_adicional: p.telefone_adicional || '',
              advogados: Array.isArray(p.advogados) ? p.advogados : [],
            })));
          } else if (processo.partes_json?.length) {
            setPartes(processo.partes_json);
            const rows = processo.partes_json.map(p => ({
              processo_id: processo.id, nome: p.nome, tipo: p.tipo,
              polo: p.polo || null, tipo_pessoa: p.tipoPessoa || null,
              documento: p.documento || null, celular: p.celular || null,
              telefone_adicional: p.telefone_adicional || null, advogados: p.advogados || null,
            }));
            await supabase.from('processo_partes').insert(rows);
          }

          const { data: dbMov } = await supabase
            .from('processo_movimentacoes').select('*').eq('processo_id', processo.id)
            .order('data_movimento', { ascending: false }).limit(50);
          if (dbMov?.length) {
            setMovimentos(dbMov.map((m: any) => ({
              dataHora: m.data_movimento ? new Date(m.data_movimento).toLocaleDateString('pt-BR') : '',
              dataHoraRaw: m.data_movimento, nome: m.movimento_titulo || 'Movimentação',
              complemento: m.movimento_descricao || null,
              codigo: m.movimento_cnj_codigo ? Number(m.movimento_cnj_codigo) : null,
            })));
          }
        } catch (err) { console.error('Erro ao carregar dados:', err); }
      })();

      // Auto-refresh if stale/missing
      const hasValidCnj    = processo.numero_processo && CNJ_REGEX.test(processo.numero_processo.trim());
      const isMissingData  = !processo.classe_cnj || !processo.orgao_julgador || !processo.assunto_cnj;
      const lastCheck      = processo.ultima_consulta_api_at ? new Date(processo.ultima_consulta_api_at).getTime() : 0;
      const isStale        = Date.now() - lastCheck > 3 * 24 * 60 * 60 * 1000;
      if (hasValidCnj && (isMissingData || isStale) && !fetchingData) {
        handleRefreshStatus(true);
      }
    }
  }, [processo?.id, isOpen, draftHydrated, autoFetchDone, isNew]);

  // Auto-fetch on new processo when CNJ typed
  useEffect(() => {
    const timer = setTimeout(() => {
      const num = (formData.numero_processo || '').trim();
      if (isNew && CNJ_REGEX.test(num)) fetchProcessoData(num, formData.tribunal);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.numero_processo, formData.tribunal, isNew]);

  const mapStatus = (s: string): ProcessoStatus => {
    const map: Record<string, ProcessoStatus> = {
      'Em Andamento': 'Em Andamento', 'Arquivado': 'Arquivado', 'Suspenso': 'Suspenso',
      'Transitado em Julgado': 'Arquivado', 'Com Sentença': 'Em Andamento', 'Em Grau Recursal': 'Em Andamento',
    };
    return map[s] || 'Em Andamento';
  };

  const fetchProcessoData = async (num: string, tribunalOverride?: string) => {
    if (!CNJ_REGEX.test(num)) return;
    setFetchingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: { numeroProcesso: num, tribunal: tribunalOverride || undefined },
      });
      if (error) throw error;
      if (data?.encontrado && data?.processo) {
        const proc = data.processo;
        const autor = proc.partes?.find((p: any) => p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT' || p.polo?.toUpperCase() === 'PA');
        let clienteId = '';
        if (autor?.nome) {
          const nomeNorm = autor.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const match    = leads.find(l => {
            const ln = (l.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return ln.includes(nomeNorm) || nomeNorm.includes(ln);
          });
          if (match) clienteId = match.id;
        }
        const adv = autor?.advogados?.[0];
        setFormData(prev => ({
          ...prev,
          titulo_acao:      proc.classe          || prev.titulo_acao,
          status:           mapStatus(proc.status),
          cliente_id:       clienteId            || prev.cliente_id,
          advogado_responsavel: adv ? (adv.oab ? `${adv.nome} (${adv.oab})` : adv.nome) : prev.advogado_responsavel,
          tribunal:         proc.tribunal        || prev.tribunal,
          orgao_julgador:   proc.orgaoJulgador   || prev.orgao_julgador,
          grau:             proc.grau            || prev.grau,
          assunto:          proc.assuntos?.[0]?.nome || prev.assunto,
          valor_causa:      proc.valorCausa?.toString() || prev.valor_causa,
          classe_cnj:       proc.classeCodigo    || prev.classe_cnj,
          vara_comarca:     proc.orgaoJulgador   || prev.vara_comarca,
          data_distribuicao: proc.dataAjuizamento || prev.data_distribuicao,
        }));
        if (proc.partes?.length)    setPartes(proc.partes);
        if (proc.movimentos?.length) setMovimentos(proc.movimentos.slice(0, 50));
        toast.success('Dados carregados!', { description: proc.classe });
      } else {
        toast.error('Processo não encontrado', { description: data?.mensagem });
      }
    } catch { toast.error('Erro ao buscar no DataJud'); }
    finally { setFetchingData(false); }
  };

  const handleRefreshStatus = async (silent = false) => {
    const num = (formData.numero_processo || '').trim();
    if (!num || !CNJ_REGEX.test(num)) {
      if (!silent) toast.error('Número CNJ inválido');
      return;
    }
    setFetchingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: { numeroProcesso: num, tribunal: formData.tribunal || undefined, force_refresh: true, persistir: !!processo?.id },
      });
      if (error) throw error;
      if (data?.encontrado && data?.processo) {
        const proc       = data.processo;
        const newPartes  = proc.partes || [];
        const newMovs    = (proc.movimentos || []).slice(0, 50);

        const toDate = (v: string | null | undefined): string => {
          if (!v) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
          if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
          const pt = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`;
          try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } catch { /**/ }
          return '';
        };

        setPartes(newPartes);
        setMovimentos(newMovs);
        setFormData(prev => ({
          ...prev,
          titulo_acao:      proc.classe          || prev.titulo_acao,
          status:           mapStatus(proc.status),
          tribunal:         proc.tribunal        || prev.tribunal,
          orgao_julgador:   proc.orgaoJulgador   || prev.orgao_julgador,
          grau:             proc.grau            || prev.grau,
          assunto:          proc.assuntos?.[0]?.nome || prev.assunto,
          valor_causa:      proc.valorCausa?.toString() || prev.valor_causa,
          classe_cnj:       proc.classe          || prev.classe_cnj,
          vara_comarca:     proc.orgaoJulgador   || prev.vara_comarca,
          data_distribuicao: toDate(proc.dataAjuizamento) || prev.data_distribuicao,
        }));

        if (processo?.id) {
          await supabase.from('processos').update({
            titulo_acao: proc.classe, status: mapStatus(proc.status),
            tribunal: proc.tribunal, orgao_julgador: proc.orgaoJulgador,
            assunto: proc.assuntos?.[0]?.nome, valor_causa: proc.valorCausa || null,
            partes_json: newPartes, movimentos_json: newMovs,
            ultima_consulta_api_at: new Date().toISOString(),
            data_ultima_atualizacao: new Date().toISOString(),
          }).eq('id', processo.id);
          fetchProcessos();
        }
        if (!silent) toast.success('Atualizado!', { description: `${newMovs.length} movs · ${newPartes.length} partes` });
      } else {
        if (!silent) toast.error('Não encontrado', { description: data?.mensagem });
      }
    } catch { if (!silent) toast.error('Erro ao consultar APIs'); }
    finally { setFetchingData(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const resolvedClienteId = formData.cliente_id === '__none__' ? null : formData.cliente_id || null;
      let nomeCliente: string | null = null;
      if (resolvedClienteId) {
        const l = leads.find(l => l.id === resolvedClienteId);
        if (l?.nome) nomeCliente = l.nome;
      }
      if (!nomeCliente && partes.length > 0) {
        const autor = partes.find(p => p.tipo === 'Autor' || p.polo?.toUpperCase() === 'AT');
        if (autor?.nome) nomeCliente = autor.nome;
      }

      const data = {
        numero_processo:           formData.numero_processo       || null,
        numero_complementar:       formData.numero_complementar   || null,
        titulo_acao:               formData.titulo_acao           || null,
        status:                    formData.status,
        advogado_responsavel:      formData.advogado_responsavel  || null,
        cliente_id:                resolvedClienteId,
        nome_cliente:              nomeCliente,
        cpf_cliente:               formData.cpf_cliente ? formData.cpf_cliente.replace(/\D/g, '') : null,
        tribunal:                  formData.tribunal              || null,
        vara_comarca:              formData.vara_comarca          || null,
        assunto:                   formData.assunto               || null,
        valor_causa:               formData.valor_causa ? parseFloat(formData.valor_causa.replace(/\./g, '').replace(',', '.')) : null,
        orgao_julgador:            formData.orgao_julgador        || null,
        grau:                      formData.grau                  || null,
        origem_cliente:            formData.origem_cliente        || null,
        descricao:                 formData.descricao             || null,
        marcadores:                formData.marcadores            || null,
        area:                      formData.area                  || null,
        fase:                      formData.fase                  || null,
        classe_cnj:                formData.classe_cnj            || null,
        assunto_cnj:               formData.assunto_cnj           || null,
        segredo_justica:           formData.segredo_justica,
        data_distribuicao:         formData.data_distribuicao     || null,
        data_ajuizamento:          formData.data_distribuicao     || null,
        data_citacao:              formData.data_citacao          || null,
        data_recebimento:          formData.data_recebimento      || null,
        data_arquivamento:         formData.data_arquivamento     || null,
        data_encerramento:         formData.data_encerramento     || null,
        valor_provisionado:        formData.valor_provisionado ? parseFloat(formData.valor_provisionado.replace(/\./g, '').replace(',', '.')) : null,
        probabilidade:             formData.probabilidade         || null,
        monitorar_push:            formData.monitorar_push,
        tipo_orgao_julgador:       formData.tipo_orgao_julgador   || null,
        sistema_judicial:          formData.sistema_judicial      || null,
        complemento_enderecamento: formData.complemento_enderecamento || null,
        partes_json:               partes.length > 0 ? partes : null,
        movimentos_json:           movimentos.length > 0 ? movimentos : null,
      };

      let savedId: string | null = null;
      if (isNew) {
        const result = await createProcesso(data);
        if (result?.error) { toast.error('Erro ao criar processo'); return; }
        savedId = (result?.data as any)?.id || null;
      } else if (processo) {
        const result = await updateProcesso(processo.id, data);
        if (result?.error) { toast.error('Erro ao salvar'); return; }
        savedId = processo.id;
      }

      if (savedId) {
        await supabase.from('processo_partes').delete().eq('processo_id', savedId);
        if (partes.length > 0) {
          await supabase.from('processo_partes').insert(partes.map(p => ({
            processo_id: savedId!, nome: p.nome, tipo: p.tipo,
            polo: p.polo || null, tipo_pessoa: p.tipoPessoa || null,
            documento: p.documento || null, celular: p.celular || null,
            telefone_adicional: p.telefone_adicional || null, advogados: p.advogados || null,
          })));
        }
      }

      clearDraft();
      onClose();
    } catch { toast.error('Erro inesperado ao salvar'); }
    finally { setSaving(false); }
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
  const hasPartes          = partes.length > 0;
  const isValidCnj         = CNJ_REGEX.test((formData.numero_processo || '').trim());

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl rounded-2xl max-h-[94vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{isNew ? 'Novo Processo' : 'Detalhes do Processo'}</DialogTitle>
        </DialogHeader>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                {isNew ? 'Novo Processo' : 'Detalhes do Processo'}
              </h2>
              {formData.numero_processo && (
                <p className="text-xs font-mono text-muted-foreground">{formData.numero_processo}</p>
              )}
              {!isNew && processo?.ultima_consulta_api_at && (
                <p className="text-[10px] text-muted-foreground/60">
                  Última sync: {new Date(processo.ultima_consulta_api_at).toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit' })}
                  {fetchingData && ' · Atualizando...'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fetchingData && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {!isNew && formData.status && (
              <Badge variant="outline" className={`text-xs font-medium ${STATUS_STYLE[formData.status] || STATUS_STYLE['Arquivado']}`}>
                {formData.status}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid grid-cols-3 mx-6 mt-3 mb-0 shrink-0 rounded-xl bg-muted/50 p-1 h-9">
            <TabsTrigger value="processo" className="rounded-lg text-xs">
              <Scale className="h-3.5 w-3.5 mr-1.5" />Processo
            </TabsTrigger>
            <TabsTrigger value="movimentos" className="rounded-lg text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Movimentos {movimentos.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">{movimentos.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="rounded-lg text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Notificações
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Processo (2 colunas) ── */}
          <TabsContent value="processo" className="flex-1 min-h-0 mt-0 px-6 pb-0">
            <div className="flex gap-5 h-full min-h-0 py-4">

              {/* Coluna esquerda — Dados (scroll) */}
              <ScrollArea className="flex-1 min-w-0 pr-3">
                <div className="space-y-5 pb-4">

                  {/* Numeração */}
                  <div>
                    <SectionTitle icon={Hash} label="Numeração" />
                    <FieldGroup>
                      <Row cols={2}>
                        <Field label="Número CNJ">
                          <div className="relative">
                            <Input
                              value={formData.numero_processo}
                              onChange={e => update('numero_processo', e.target.value)}
                              className="rounded-xl bg-card font-mono text-sm pr-9"
                              placeholder="0000000-00.0000.0.00.0000"
                            />
                            {fetchingData && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />}
                            {!fetchingData && isValidCnj && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />}
                          </div>
                          {isNew && <p className="text-[10px] text-muted-foreground mt-1">Digite o número para carregar dados automaticamente</p>}
                        </Field>
                        <Field label="Número Complementar">
                          <Input value={formData.numero_complementar} onChange={e => update('numero_complementar', e.target.value)} className="rounded-xl bg-card text-sm" placeholder="Opcional" />
                        </Field>
                      </Row>
                    </FieldGroup>
                  </div>

                  {/* Detalhes */}
                  <div>
                    <SectionTitle icon={FileText} label="Detalhes do Processo" />
                    <FieldGroup>
                      <Row cols={2}>
                        <Field label="Situação">
                          <Select value={formData.status} onValueChange={v => update('status', v as ProcessoStatus)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Assunto">
                          <Input value={formData.assunto} onChange={e => update('assunto', e.target.value)} className="rounded-xl bg-card" placeholder="Ex: Danos Morais" />
                        </Field>
                      </Row>
                      <Field label="Descrição / Anotações">
                        <Textarea value={formData.descricao} onChange={e => update('descricao', e.target.value)} className="rounded-xl bg-card min-h-[72px] text-sm resize-none" placeholder="Anotações internas..." />
                      </Field>
                      <Row cols={2}>
                        <Field label="Marcadores">
                          <Input value={formData.marcadores} onChange={e => update('marcadores', e.target.value)} className="rounded-xl bg-card" placeholder="Separados por vírgula" />
                        </Field>
                        <Field label="Pasta do Cliente">
                          <Select value={formData.cliente_id || '__none__'} onValueChange={v => update('cliente_id', v === '__none__' ? '' : v)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}{l.telefone ? ` (${l.telefone})` : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </Row>
                    </FieldGroup>
                  </div>

                  {/* Responsável */}
                  <div>
                    <SectionTitle icon={Users} label="Responsável & Organização" bg="bg-accent/20" color="text-foreground" />
                    <FieldGroup>
                      <Row cols={2}>
                        <Field label="Advogado Responsável">
                          <Input value={formData.advogado_responsavel} onChange={e => update('advogado_responsavel', e.target.value)} className="rounded-xl bg-card" placeholder="Nome do advogado" />
                        </Field>
                        <Field label="Origem do Cliente">
                          <Select value={formData.origem_cliente || '__none__'} onValueChange={v => update('origem_cliente', v === '__none__' ? '' : v)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Não informado</SelectItem>
                              <SelectItem value="Marketing">Marketing</SelectItem>
                              <SelectItem value="Bentes e Ramos">Bentes e Ramos</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </Row>
                      <Field label="CPF do Cliente" hint="Usado pela Isa para localizar processos">
                        <Input
                          value={formData.cpf_cliente}
                          onChange={e => {
                            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
                            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
                            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
                            update('cpf_cliente', v);
                          }}
                          className="rounded-xl bg-card" placeholder="000.000.000-00" maxLength={14}
                        />
                      </Field>
                    </FieldGroup>
                  </div>

                  {/* Endereçamento */}
                  <div>
                    <SectionTitle icon={Building2} label="Endereçamento" bg="bg-blue-500/10" color="text-blue-600 dark:text-blue-400" />
                    <FieldGroup>
                      <Row cols={2}>
                        <Field label="Justiça / Tribunal">
                          <Input value={formData.tribunal} onChange={e => update('tribunal', e.target.value)} className="rounded-xl bg-card" placeholder="Ex: TJAM" />
                        </Field>
                        <Field label="Instância">
                          <Select value={formData.grau || 'G1'} onValueChange={v => update('grau', v)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="G1">1º Grau</SelectItem>
                              <SelectItem value="G2">2º Grau</SelectItem>
                              <SelectItem value="SUP">Superior</SelectItem>
                              <SelectItem value="JE">Juizado Especial</SelectItem>
                              <SelectItem value="TR">Turma Recursal</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </Row>
                      <Row cols={2}>
                        <Field label="Vara / Comarca">
                          <Input value={formData.vara_comarca} onChange={e => update('vara_comarca', e.target.value)} className="rounded-xl bg-card" placeholder="Vara" />
                        </Field>
                        <Field label="Órgão Julgador">
                          <Input value={formData.orgao_julgador} onChange={e => update('orgao_julgador', e.target.value)} className="rounded-xl bg-card" placeholder="Ex: 2ª Vara Cível" />
                        </Field>
                      </Row>
                      <Row cols={2}>
                        <Field label="Sistema Judicial">
                          <Input value={formData.sistema_judicial} onChange={e => update('sistema_judicial', e.target.value)} className="rounded-xl bg-card" placeholder="Ex: PJe, e-SAJ" />
                        </Field>
                        <Field label="Complemento">
                          <Input value={formData.complemento_enderecamento} onChange={e => update('complemento_enderecamento', e.target.value)} className="rounded-xl bg-card" placeholder="Complemento" />
                        </Field>
                      </Row>
                      <Row cols={4}>
                        <Field label="Distribuição"><Input type="date" value={formData.data_distribuicao} onChange={e => update('data_distribuicao', e.target.value)} className="rounded-xl bg-card text-xs" /></Field>
                        <Field label="Citação"><Input type="date" value={formData.data_citacao} onChange={e => update('data_citacao', e.target.value)} className="rounded-xl bg-card text-xs" /></Field>
                        <Field label="Arquivamento"><Input type="date" value={formData.data_arquivamento} onChange={e => update('data_arquivamento', e.target.value)} className="rounded-xl bg-card text-xs" /></Field>
                        <Field label="Encerramento"><Input type="date" value={formData.data_encerramento} onChange={e => update('data_encerramento', e.target.value)} className="rounded-xl bg-card text-xs" /></Field>
                      </Row>
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input type="checkbox" checked={formData.monitorar_push} onChange={e => update('monitorar_push', e.target.checked)} className="rounded border-border" />
                        <span className="text-xs flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-primary" />Monitorar processo (Push)</span>
                      </label>
                    </FieldGroup>
                  </div>

                  {/* Autos */}
                  <div>
                    <SectionTitle icon={FolderOpen} label="Autos" bg="bg-amber-500/10" color="text-amber-600 dark:text-amber-400" />
                    <FieldGroup>
                      <Row cols={2}>
                        <Field label="Área">
                          <Select value={formData.area || '__none__'} onValueChange={v => update('area', v === '__none__' ? '' : v)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Selecione</SelectItem>
                              {['Cível','Trabalhista','Criminal','Tributário','Previdenciário','Administrativo','Consumidor','Família'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Fase">
                          <Select value={formData.fase || '__none__'} onValueChange={v => update('fase', v === '__none__' ? '' : v)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Selecione</SelectItem>
                              {['Conhecimento','Execução','Recursal','Cumprimento de Sentença','Liquidação'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </Row>
                      <Row cols={2}>
                        <Field label="Classe CNJ">
                          <Input value={formData.classe_cnj} onChange={e => update('classe_cnj', e.target.value)} className="rounded-xl bg-card" placeholder="Ex: Procedimento Comum" />
                        </Field>
                        <Field label="Assunto CNJ">
                          <Input value={formData.assunto_cnj} onChange={e => update('assunto_cnj', e.target.value)} className="rounded-xl bg-card" placeholder="Assunto CNJ" />
                        </Field>
                      </Row>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.segredo_justica} onChange={e => update('segredo_justica', e.target.checked)} className="rounded border-border" />
                        <span className="text-xs flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-muted-foreground" />Segredo de Justiça</span>
                      </label>
                    </FieldGroup>
                  </div>

                  {/* Pedidos */}
                  <div>
                    <SectionTitle icon={DollarSign} label="Pedidos" bg="bg-emerald-500/10" color="text-emerald-600 dark:text-emerald-400" />
                    <FieldGroup>
                      <Row cols={3}>
                        <Field label="Valor da Ação (R$)">
                          <Input value={formData.valor_causa} onChange={e => update('valor_causa', e.target.value.replace(/[^0-9.,]/g, ''))} className="rounded-xl bg-card" placeholder="0,00" inputMode="decimal" />
                        </Field>
                        <Field label="Valor Provisionado (R$)">
                          <Input value={formData.valor_provisionado} onChange={e => update('valor_provisionado', e.target.value.replace(/[^0-9.,]/g, ''))} className="rounded-xl bg-card" placeholder="0,00" inputMode="decimal" />
                        </Field>
                        <Field label="Probabilidade">
                          <Select value={formData.probabilidade || '__none__'} onValueChange={v => update('probabilidade', v === '__none__' ? '' : v)}>
                            <SelectTrigger className="rounded-xl bg-card"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Selecione</SelectItem>
                              <SelectItem value="Provável">Provável</SelectItem>
                              <SelectItem value="Possível">Possível</SelectItem>
                              <SelectItem value="Remota">Remota</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </Row>
                    </FieldGroup>
                  </div>

                </div>
              </ScrollArea>

              {/* Divisor vertical */}
              <div className="w-px bg-border/50 shrink-0 self-stretch" />

              {/* Coluna direita — Partes (fixa, com scroll próprio) */}
              <div className="w-[320px] shrink-0 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <Users className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Partes</h3>
                    {hasPartes && <Badge variant="outline" className="text-xs h-5 px-1.5">{partes.length}</Badge>}
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0 pr-1">
                  <div className="space-y-2 pb-3">
                    {!hasPartes ? (
                      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-8 text-center">
                        <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">Nenhuma parte</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">Use "Atualizar" ou adicione abaixo</p>
                      </div>
                    ) : (
                      partes.map((parte, i) => (
                        <ParteCard
                          key={i} parte={parte} index={i}
                          onUpdate={(idx, field, val) => setPartes(prev => prev.map((p, j) => j === idx ? { ...p, [field]: val } : p))}
                          onRemove={idx => setPartes(prev => prev.filter((_, j) => j !== idx))}
                        />
                      ))
                    )}

                    <AddParteForm onAdd={parte => setPartes(prev => [...prev, parte])} />
                  </div>
                </ScrollArea>
              </div>

            </div>
          </TabsContent>

          {/* ── TAB: Movimentos ── */}
          <TabsContent value="movimentos" className="flex-1 min-h-0 mt-0 px-6 pb-0">
            <ScrollArea className="h-full py-4 pr-2">
              {movimentosEnriquecidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Nenhuma movimentação</p>
                  <p className="text-xs mt-1 opacity-70">Clique em "Atualizar" para carregar do DataJud</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-xl" onClick={() => handleRefreshStatus(false)} disabled={fetchingData || !isValidCnj}>
                    {fetchingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Buscar Movimentações
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  <p className="text-xs text-muted-foreground mb-3">{movimentosEnriquecidos.length} movimentação(ões) · Clique para detalhes</p>
                  {movimentosEnriquecidos.map((mov, i) => (
                    <Card key={i} className="cursor-pointer hover:bg-accent/40 transition-colors group border-border/50" onClick={() => { setSelectedMovimento(mov); setMovModalOpen(true); }}>
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold">{mov.titulo_humano}</p>
                              <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${getCategoriaColor(mov.categoria)}`}>{mov.badge}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mov.descricao_humana}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ── TAB: Notificações ── */}
          <TabsContent value="notificacoes" className="flex-1 min-h-0 mt-0 px-6 pb-0">
            <ScrollArea className="h-full py-4 pr-2">
              {!isNew && processo ? (
                <ProcessoNotificacoesTab
                  processo={processo}
                  cliente={clienteSelecionado}
                  sending={sendingNotif}
                  onSendManual={handleSendNotif}
                  config={
                    <ProcessoNotificacaoConfig
                      processoId={processo.id}
                      frequenciaDias={processo.frequencia_notificacao_dias || 7}
                      notificacaoAtiva={processo.notificacao_ativa ?? true}
                      ultimaNotificacao={processo.ultima_notificacao_at}
                      onUpdate={fetchProcessos}
                    />
                  }
                  previewData={{
                    nomeCliente:      clienteSelecionado?.nome,
                    numeroProcesso:   formData.numero_processo || processo.numero_processo,
                    acao:             formData.titulo_acao     || processo.titulo_acao,
                    status:           (formData.status as unknown as string) || (processo.status as unknown as string),
                    tribunal:         formData.tribunal        || processo.tribunal,
                    ultimaAtualizacao: processo.data_ultima_atualizacao,
                    movimentos:       movimentos.slice(0, 3),
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Salve o processo primeiro</p>
                  <p className="text-xs mt-1 opacity-70">Notificações disponíveis após criar o processo</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

        </Tabs>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20 shrink-0">
          <div>
            {!isNew && canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
              onClick={() => handleRefreshStatus(false)}
              disabled={fetchingData || !isValidCnj}
            >
              {fetchingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isNew ? 'Buscar DataJud' : 'Atualizar'}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button size="sm" className="rounded-xl px-6 shadow-sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando...</> : isNew ? 'Criar Processo' : 'Salvar'}
            </Button>
          </div>
        </div>

        <MovimentoDetailModal movimento={selectedMovimento} isOpen={movModalOpen} onClose={() => { setMovModalOpen(false); setSelectedMovimento(null); }} />
      </DialogContent>
    </Dialog>
  );
}
