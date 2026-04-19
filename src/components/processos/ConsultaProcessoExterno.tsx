import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Loader2, Scale, Calendar, Users, FileText,
  AlertCircle, User, Building, Gavel, Clock, DollarSign,
  Shield, Briefcase, ChevronRight, Save, CheckCircle2,
  BadgeCheck, RefreshCw, Database, Cloud, AlertTriangle,
  X, Copy, ExternalLink, Hash, MapPin, BookOpen, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MovimentoDetailModal } from './MovimentoDetailModal';
import { usePerfil } from '@/hooks/usePerfil';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Assunto { nome: string; codigo?: string; }
interface Advogado { nome: string; oab?: string; }
interface Parte {
  nome: string; tipo: string; polo: string;
  tipoPessoa: string; documento?: string; advogados?: Advogado[];
}
interface Movimento {
  dataHora: string; dataHoraRaw?: string;
  nome: string; complemento?: string; codigo?: number;
}
interface ProcessoExterno {
  numeroProcesso: string; classe: string; classeCodigo?: string;
  assuntos: Assunto[]; tribunal: string; dataAjuizamento: string;
  grau: string; nivelSigilo: string; formato: string;
  sistemaProcessual: string; orgaoJulgador: string; status: string;
  ultimaAtualizacao: string; valorCausa: number | null;
  prioridade: string[]; movimentos: Movimento[]; partes: Parte[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCurrency = (v: number | null) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : null;

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const getStatusConfig = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('arquiv') || s.includes('transitado'))
    return { cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
  if (s.includes('suspen'))
    return { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300', dot: 'bg-amber-500' };
  if (s.includes('sentença') || s.includes('concluso'))
    return { cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300', dot: 'bg-blue-500' };
  if (s.includes('recursal'))
    return { cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300', dot: 'bg-purple-500' };
  return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300', dot: 'bg-emerald-500' };
};

const getParteConfig = (tipo: string) => {
  const t = tipo.toLowerCase();
  if (t.includes('autor'))
    return { bar: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400' };
  if (t.includes('réu') || t.includes('reu'))
    return { bar: '#ef4444', badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400' };
  return { bar: '#94a3b8', badge: 'bg-muted text-muted-foreground border-border' };
};

async function copyText(text: string, label = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch { toast.error('Não foi possível copiar'); }
}

// ── InfoCard ──────────────────────────────────────────────────────────────────

function InfoCard({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string | null | undefined; accent?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`p-3.5 rounded-xl border ${accent ? 'bg-primary/[0.03] border-primary/15' : 'bg-muted/20 border-border/40'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">{value}</p>
    </div>
  );
}

// ── ProcessoCard (lista CPF) ──────────────────────────────────────────────────

function ProcessoListCard({ proc, onSelect }: { proc: ProcessoExterno; onSelect: () => void }) {
  const statusCfg = getStatusConfig(proc.status);
  return (
    <div
      onClick={onSelect}
      className="group flex items-start gap-4 p-4 rounded-2xl border border-border/50 bg-card hover:bg-accent/30 hover:border-border hover:shadow-md cursor-pointer transition-all duration-150"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Scale className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-foreground leading-snug">{proc.numeroProcesso}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{proc.classe}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-border/50 bg-muted/60 text-muted-foreground">{proc.tribunal}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusCfg.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
            {proc.status}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
    </div>
  );
}

// ── ProcessoDetails ───────────────────────────────────────────────────────────

function ProcessoDetails({
  proc, saving, onImportar, onForceRefresh, loading, fonteUsada, cacheHit,
}: {
  proc: ProcessoExterno; saving: boolean; loading: boolean;
  fonteUsada: string | null; cacheHit: boolean;
  onImportar: (p: ProcessoExterno) => void;
  onForceRefresh: () => void;
}) {
  const [selectedMov, setSelectedMov] = useState<Movimento | null>(null);
  const [movModal, setMovModal]       = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'partes' | 'movimentos'>('info');
  const statusCfg = getStatusConfig(proc.status);

  const sectionBtn = (key: typeof activeSection, label: string, count?: number) => (
    <button
      onClick={() => setActiveSection(key)}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 inline-flex items-center gap-1.5
        ${activeSection === key
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${activeSection === key ? 'bg-white/25' : 'bg-muted text-muted-foreground'}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50">
        {/* top bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/30" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${statusCfg.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                  {proc.status}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-border/50 bg-muted/60 text-muted-foreground">{proc.tribunal}</span>
                {proc.nivelSigilo === 'Segredo de Justiça' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30">
                    <Shield className="h-2.5 w-2.5" /> Segredo de Justiça
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-base font-black font-mono text-foreground">{proc.numeroProcesso}</p>
                <button onClick={() => copyText(proc.numeroProcesso, 'Número copiado!')} className="h-6 w-6 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors">
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{proc.classe}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Fonte badge */}
              {fonteUsada && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-border/50 bg-muted/40 text-muted-foreground">
                  {cacheHit ? <Database className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                  {fonteUsada === 'both' ? 'Escavador + DataJud' : fonteUsada}
                </span>
              )}
              <Button size="sm" variant="outline" onClick={onForceRefresh} disabled={loading} className="h-8 text-xs gap-1.5 rounded-xl border-border/60">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar
              </Button>
              <Button size="sm" onClick={() => onImportar(proc)} disabled={saving} className="h-8 text-xs gap-1.5 rounded-xl shadow-sm shadow-primary/20">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Importar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex gap-1.5 bg-muted/40 rounded-xl p-1 border border-border/40 w-fit">
        {sectionBtn('info', 'Informações')}
        {sectionBtn('partes', 'Partes', proc.partes.length)}
        {sectionBtn('movimentos', 'Movimentações', proc.movimentos.length)}
      </div>

      {/* INFO */}
      {activeSection === 'info' && (
        <div className="space-y-3">
          {/* Grid de info */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCard icon={Gavel}    label="Classe Processual" value={proc.classe} />
            <InfoCard icon={Calendar} label="Ajuizado em"       value={proc.dataAjuizamento} />
            <InfoCard icon={Clock}    label="Última Atualização" value={proc.ultimaAtualizacao} />
            <InfoCard icon={Building} label="Órgão Julgador"    value={proc.orgaoJulgador} />
            <InfoCard icon={Scale}    label="Grau / Formato"    value={`${proc.grau} · ${proc.formato}`} />
            {proc.valorCausa && <InfoCard icon={DollarSign} label="Valor da Causa" value={formatCurrency(proc.valorCausa)} accent />}
            <InfoCard icon={Shield}   label="Sigilo"            value={proc.nivelSigilo} />
            <InfoCard icon={BookOpen} label="Sistema"           value={proc.sistemaProcessual} />
            {proc.classeCodigo && <InfoCard icon={Hash} label="Código CNJ" value={proc.classeCodigo} />}
          </div>

          {/* Prioridades */}
          {proc.prioridade?.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800/40">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">Prioridades</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {proc.prioridade.map((p, i) => (
                  <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200/60 dark:bg-amber-900/30 dark:text-amber-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assuntos */}
          {proc.assuntos.length > 0 && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
              <div className="flex items-center gap-2 mb-2.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Assuntos ({proc.assuntos.length})</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {proc.assuntos.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-card border border-border/50 text-foreground">
                    {typeof a === 'string' ? a : a.nome}
                    {typeof a !== 'string' && a.codigo && (
                      <span className="text-muted-foreground opacity-60">({a.codigo})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PARTES */}
      {activeSection === 'partes' && (
        <div className="space-y-2">
          {proc.partes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-border/40 rounded-2xl">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhuma parte encontrada</p>
            </div>
          ) : proc.partes.slice(0, 10).map((parte, i) => {
            const cfg = getParteConfig(parte.tipo);
            return (
              <div key={i} className="rounded-xl border border-border/40 bg-card overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: cfg.bar }}>
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground leading-snug">{parte.nome}</p>
                      {parte.documento && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Doc: {parte.documento}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.badge}`}>{parte.tipo}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-muted/60 text-muted-foreground border border-border/40">{parte.tipoPessoa}</span>
                    </div>
                  </div>
                  {parte.advogados && parte.advogados.length > 0 && (
                    <div className="pl-3 border-l-2 border-primary/20 space-y-1.5 mt-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="h-2.5 w-2.5" /> Advogado(s)
                      </p>
                      {parte.advogados.map((adv, j) => (
                        <div key={j} className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground truncate">{adv.nome}</p>
                          {adv.oab && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                              <BadgeCheck className="h-3 w-3 text-primary" /> {adv.oab}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {proc.partes.length > 10 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              +{proc.partes.length - 10} partes não exibidas
            </p>
          )}
        </div>
      )}

      {/* MOVIMENTOS */}
      {activeSection === 'movimentos' && (
        <div className="space-y-2">
          {proc.movimentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-border/40 rounded-2xl">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhuma movimentação</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground font-medium">{proc.movimentos.length} movimentação(ões) · clique para detalhes</p>
              {proc.movimentos.map((mov, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedMov(mov); setMovModal(true); }}
                  className="group w-full flex items-start gap-3 p-3.5 rounded-2xl border border-border/40 bg-card hover:bg-accent/30 hover:border-border hover:shadow-sm cursor-pointer transition-all duration-150 text-left"
                >
                  <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{mov.nome}</p>
                    {mov.complemento && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mov.complemento}</p>
                    )}
                    {mov.codigo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40 mt-1">
                        CNJ: {mov.codigo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-start">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{mov.dataHora}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <MovimentoDetailModal
        movimento={selectedMov}
        isOpen={movModal}
        onClose={() => { setMovModal(false); setSelectedMov(null); }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ConsultaProcessoExterno() {
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [cpf,            setCpf]            = useState('');
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [processo,       setProcesso]       = useState<ProcessoExterno | null>(null);
  const [processos,      setProcessos]      = useState<ProcessoExterno[]>([]);
  const [selectedCpfProc, setSelectedCpfProc] = useState<ProcessoExterno | null>(null);
  const [erro,           setErro]           = useState<string | null>(null);
  const [searchType,     setSearchType]     = useState<'numero' | 'cpf'>('numero');
  const [fonteUsada,     setFonteUsada]     = useState<string | null>(null);
  const [cacheHit,       setCacheHit]       = useState(false);
  const [warnings,       setWarnings]       = useState<string[]>([]);
  const { fullName } = usePerfil();

  const resetState = () => {
    setErro(null); setProcesso(null); setProcessos([]);
    setSelectedCpfProc(null); setFonteUsada(null); setCacheHit(false); setWarnings([]);
  };

  const handleBuscar = async () => {
    const query = searchType === 'numero' ? numeroProcesso.trim() : cpf.replace(/\D/g, '');
    if (!query) { toast.error(searchType === 'numero' ? 'Digite o número do processo' : 'Digite o CPF'); return; }
    if (searchType === 'cpf' && query.length !== 11) { toast.error('CPF deve conter 11 dígitos'); return; }

    setLoading(true); resetState();
    try {
      const body = searchType === 'numero'
        ? { numeroProcesso: query }
        : { cpf: query, action: 'buscar_por_cpf' };
      const { data, error } = await supabase.functions.invoke('consulta-processos', { body });
      if (error) throw error;
      setFonteUsada(data.fonte || null);
      setCacheHit(data.cacheHit || false);
      setWarnings(data.warnings || []);
      if (!data.encontrado && !data.success) { setErro(data.error || data.mensagem || 'Processo não encontrado'); return; }
      if (data.multiplos && data.processos) {
        setProcessos(data.processos);
        toast.success(`${data.processos.length} processo(s) encontrado(s)!`);
      } else if (data.processo) {
        setProcesso(data.processo);
        toast.success(`Encontrado via ${data.fonte || 'API'}!`);
      }
    } catch (err) {
      setErro('Erro ao consultar processo. Tente novamente.');
    } finally { setLoading(false); }
  };

  const handleForceRefresh = async () => {
    const query = searchType === 'numero' ? numeroProcesso.trim() : cpf.replace(/\D/g, '');
    if (!query) return;
    setLoading(true); setWarnings([]);
    try {
      const { data, error } = await supabase.functions.invoke('consulta-processos', {
        body: { numeroProcesso: query, force_refresh: true },
      });
      if (error) throw error;
      setFonteUsada(data.fonte || null); setCacheHit(false); setWarnings(data.warnings || []);
      if (data.processo) { setProcesso(data.processo); toast.success('Dados atualizados!'); }
    } catch { toast.error('Erro ao atualizar dados'); }
    finally { setLoading(false); }
  };

  const handleImportar = async (proc: ProcessoExterno) => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('consulta-processos', {
        body: { numeroProcesso: proc.numeroProcesso, persistir: true, advogadoResponsavel: fullName },
      });
      if (error) throw error;
      toast.success('Processo importado com sucesso!');
    } catch { toast.error('Erro ao importar processo'); }
    finally { setSaving(false); }
  };

  const activeProc = selectedCpfProc || processo;
  const isValidCnj = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(numeroProcesso.trim());

  return (
    <div className="space-y-5">
      {/* Search card */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {/* top accent */}
        <div className="h-[3px] bg-gradient-to-r from-primary to-primary/30" />
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground leading-none">Consulta de Processos</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">CNJ · Escavador · DataJud</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1.5 bg-muted/40 rounded-xl p-1 border border-border/40 w-fit">
            {(['numero', 'cpf'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setSearchType(type); resetState(); }}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                  ${searchType === type ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {type === 'numero' ? <><FileText className="h-3.5 w-3.5" /> Por Número CNJ</> : <><User className="h-3.5 w-3.5" /> Por CPF</>}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={searchType === 'numero' ? '0000000-00.0000.0.00.0000' : '000.000.000-00'}
                value={searchType === 'numero' ? numeroProcesso : cpf}
                onChange={e => searchType === 'numero'
                  ? setNumeroProcesso(e.target.value)
                  : setCpf(formatCPF(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                className="pl-10 pr-10 h-11 rounded-xl border-border/60 bg-card font-mono text-sm shadow-sm"
              />
              {(searchType === 'numero' ? numeroProcesso : cpf) && (
                <button
                  onClick={() => { searchType === 'numero' ? setNumeroProcesso('') : setCpf(''); resetState(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button
              onClick={handleBuscar}
              disabled={loading}
              className="h-11 px-5 rounded-xl gap-2 shadow-sm shadow-primary/20 font-bold shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Consultar
            </Button>
          </div>

          {searchType === 'cpf' && (
            <p className="text-[11px] text-muted-foreground">
              Busca em TRT11, TJAM, TRF1-3, TJMG, TJRJ, TJSP, TJRS e TJPR
            </p>
          )}

          {/* Fonte + warnings */}
          {(fonteUsada || warnings.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/40">
              {fonteUsada && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-border/40 bg-card text-muted-foreground">
                  {cacheHit ? <Database className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                  {fonteUsada === 'both' ? 'Escavador + DataJud' : fonteUsada}
                </span>
              )}
              {cacheHit && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40">
                  <CheckCircle2 className="h-3 w-3" /> Cache
                </span>
              )}
              {warnings.map((w, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border border-amber-200/60 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800/40">
                  <AlertTriangle className="h-3 w-3" /> {w}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-border/40 bg-card">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center relative">
            <Scale className="h-7 w-7 text-primary/20" />
            <Loader2 className="absolute h-6 w-6 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Consultando APIs jurídicas...</p>
            <p className="text-xs text-muted-foreground mt-1">Escavador → DataJud → Cache</p>
          </div>
        </div>
      )}

      {/* Erro */}
      {!loading && erro && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertCircle className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-destructive">Processo não encontrado</p>
            <p className="text-xs text-destructive/70 mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {/* Lista CPF */}
      {!loading && processos.length > 0 && !selectedCpfProc && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">
            {processos.length} processo(s) encontrado(s) para o CPF
          </p>
          <div className="space-y-2">
            {processos.map((proc, i) => (
              <ProcessoListCard key={i} proc={proc} onSelect={() => setSelectedCpfProc(proc)} />
            ))}
          </div>
        </div>
      )}

      {/* Voltar lista CPF */}
      {!loading && selectedCpfProc && processos.length > 0 && (
        <button
          onClick={() => setSelectedCpfProc(null)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Voltar para lista ({processos.length})
        </button>
      )}

      {/* Processo detail */}
      {!loading && activeProc && (
        <ProcessoDetails
          proc={activeProc}
          saving={saving}
          loading={loading}
          fonteUsada={fonteUsada}
          cacheHit={cacheHit}
          onImportar={handleImportar}
          onForceRefresh={handleForceRefresh}
        />
      )}

      {/* Empty state */}
      {!loading && !erro && !processo && processos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border-2 border-dashed border-border/40">
          <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
            <Scale className="h-8 w-8 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Consulte um processo</p>
            <p className="text-xs text-muted-foreground mt-1">
              Digite o número CNJ ou CPF do cliente acima
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
