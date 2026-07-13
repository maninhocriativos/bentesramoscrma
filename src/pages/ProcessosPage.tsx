import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense, memo } from 'react';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ProcessosTable } from '@/components/processos/ProcessosTable';
import { useProcessos } from '@/hooks/useProcessos';
import { usePerfil } from '@/hooks/usePerfil';
import { useLeadNames } from '@/hooks/useLeadNames';
import { Processo } from '@/types/processos';
import { ImportProcessosCsvModal } from '@/components/processos/ImportProcessosCsvModal';
import { SyncProcessosModal } from '@/components/processos/SyncProcessosModal';
import { MovimentosRecentes } from '@/components/processos/MovimentosRecentes';
import {
  Loader2, Search, Scale, Plus,
  CheckCircle2, PauseCircle, Archive, Trophy, XCircle,
  RefreshCw, SlidersHorizontal, Upload, Gavel, FileCheck, X,
  Download, Users, Layers, UserCheck, CheckSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ProcessoModalExpanded = lazy(() =>
  import('@/components/processos/ProcessoModalExpanded').then(m => ({ default: m.ProcessoModalExpanded }))
);
const ConsultaProcessoExterno = lazy(() =>
  import('@/components/processos/ConsultaProcessoExterno').then(m => ({ default: m.ConsultaProcessoExterno }))
);

// ── Mini Donut ────────────────────────────────────────────────────────────────
function MiniDonut({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="h-12 w-12 rounded-full bg-muted/30" />;
  const size = 48; const cx = 24; const cy = 24; const r = 16; const sw = 8;
  let cum = -90;
  const arcs = segments.map(seg => {
    const pct = seg.value / total; const angle = pct * 360;
    const start = cum; cum += angle;
    return { ...seg, pct, start, end: cum };
  });
  function xy(deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arc(s: number, e: number) {
    const a = xy(s); const b = xy(e); const lg = e - s > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${lg} 1 ${b.x} ${b.y}`;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((a, i) => a.pct > 0 && (
        <path key={i} d={arc(a.start, a.end - 0.3)} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="butt" />
      ))}
    </svg>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, numColor, barColor, iconBg, active, onClick }: {
  label: string; value: number; icon: React.ElementType;
  numColor: string; barColor: string; iconBg: string;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer
        hover:-translate-y-0.5 hover:shadow-lg
        ${active
          ? 'border-primary/30 shadow-md bg-card ring-2 ring-primary/20'
          : 'border-border/50 bg-card hover:border-border'
        }`}
    >
      {/* top accent bar via inline style for reliable color */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl transition-opacity duration-200"
        style={{ background: barColor, opacity: active ? 1 : 0.4 }} />
      {/* decorative blob */}
      <div className="absolute -bottom-4 -right-4 w-14 h-14 rounded-full opacity-[0.06] group-hover:opacity-[0.12] transition-opacity"
        style={{ background: barColor }} />
      <div className="relative h-8 w-8 rounded-xl flex items-center justify-center mt-1" style={{ background: iconBg }}>
        <Icon className="h-4 w-4" style={{ color: numColor }} />
      </div>
      <span className="relative text-2xl font-black leading-none tabular-nums" style={{ color: numColor }}>
        {value.toLocaleString('pt-BR')}
      </span>
      <span className="relative text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center leading-tight px-1">
        {label}
      </span>
    </button>
  );
}

// ── Summary Panel ─────────────────────────────────────────────────────────────
function SummaryPanel({ kpis, statusFilter, setStatusFilter }: {
  kpis: Record<string, number>;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
}) {
  const rows = [
    { key: 'Em Andamento', label: 'Em Andamento', color: '#3b82f6' },
    { key: 'Suspenso',     label: 'Suspensos',    color: '#f59e0b' },
    { key: 'Ganho',        label: 'Ganhos',       color: '#10b981' },
    { key: 'Perdido',      label: 'Perdidos',     color: '#ef4444' },
    { key: 'Arquivado',    label: 'Arquivados',   color: '#94a3b8' },
  ];
  const extra = [
    { key: 'recursal', label: 'Recursal', color: '#7c3aed' },
    { key: 'execucao', label: 'Execução',  color: '#ea580c' },
  ];
  const total = kpis.total || 1;
  const donutSegs = rows.map(r => ({ value: kpis[r.key] || 0, color: r.color }));

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-5 shadow-sm">
      <div className="shrink-0">
        <MiniDonut segments={donutSegs} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {rows.map(row => {
          const val = kpis[row.key] || 0;
          const pct = (val / total) * 100;
          const isActive = statusFilter === row.key;
          return (
            <button
              key={row.key}
              onClick={() => setStatusFilter(isActive ? 'todos' : row.key)}
              className="w-full flex items-center gap-2 group hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-1.5 w-[106px] shrink-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: row.color }} />
                <span className={`text-[10px] font-semibold truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {row.label}
                </span>
              </div>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: row.color }} />
              </div>
              <span className="text-[10px] font-black w-6 text-right shrink-0" style={{ color: isActive ? row.color : undefined }}>
                {val}
              </span>
            </button>
          );
        })}
      </div>
      <div className="shrink-0 hidden lg:flex flex-col gap-2.5">
        {extra.map(e => {
          const val = kpis[e.key] || 0;
          return (
            <button
              key={e.key}
              onClick={() => setStatusFilter(statusFilter === e.key ? 'todos' : e.key)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.color }} />
              <span className="text-[10px] text-muted-foreground">{e.label}</span>
              <span className="text-[10px] font-black ml-1" style={{ color: e.color }}>{val}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
type ViewTab = 'internos' | 'consulta';

function ProcessosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { processos, loading, assignCoResponsavel } = useProcessos();
  const { leadNames } = useLeadNames();
  const { canDelete, canAccessProcessos, loading: perfilLoading, isAdmin, isGerente } = usePerfil();

  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [advogadoFilter, setAdvogadoFilter] = useState('todos');
  const [faseFilter, setFaseFilter] = useState('todos');
  const [activeView, setActiveView] = useState<ViewTab>('internos');
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Seleção em lote
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string | null; sobrenome: string | null }[]>([]);

  useEffect(() => {
    if (isAdmin || isGerente) {
      supabase.from('perfis').select('id,nome,sobrenome').eq('aprovado', true).order('nome')
        .then(({ data }) => setUsuarios(data || []));
    }
  }, [isAdmin, isGerente]);

  const advogados = useMemo(() => {
    const set = new Set<string>();
    processos.forEach(p => { if (p.advogado_responsavel) set.add(p.advogado_responsavel.replace(/\s*\(OAB.*\)/i, '').trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [processos]);

  const fases = useMemo(() => {
    const set = new Set<string>();
    processos.forEach(p => { if (p.fase) set.add(p.fase.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [processos]);

  const handleProcessoClick = useCallback((p: Processo) => {
    setSelectedProcesso(p); setIsNew(false); setIsModalOpen(true);
  }, []);
  const handleNewProcesso = useCallback(() => {
    setSelectedProcesso(null); setIsNew(true); setIsModalOpen(true);
  }, []);

  // Vínculo pendente: intimação de origem quando o cadastro veio da página de
  // Intimações ("+ Cadastrar processo"), pra persistir intimacoes.processo_id
  // depois que o processo for salvo.
  const linkIntimacaoIdRef = useRef<string | null>(null);

  // Abre o modal já preenchido quando chega navegando da página de Intimações
  // (state.novoProcesso) — o próprio ProcessoModalExpanded busca o resto via
  // consulta-processos (mesmo autofetch que já existe pra CNJ digitado à mão).
  useEffect(() => {
    const state = location.state as { novoProcesso?: Partial<Processo>; linkIntimacaoId?: string } | null;
    if (state?.novoProcesso) {
      linkIntimacaoIdRef.current = state.linkIntimacaoId || null;
      setSelectedProcesso(state.novoProcesso as Processo);
      setIsNew(true);
      setIsModalOpen(true);
      // Limpa o state da navegação pra não reabrir num refresh/voltar.
      navigate(location.pathname, { replace: true, state: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseModal = useCallback(() => {
    const intimacaoId = linkIntimacaoIdRef.current;
    const cnj = selectedProcesso?.numero_processo;
    if (intimacaoId && cnj) {
      const cnjNorm = cnj.replace(/\D/g, '');
      supabase.from('processos').select('id').eq('cnj_normalizado', cnjNorm).maybeSingle()
        .then(({ data }) => {
          if (data?.id) supabase.from('intimacoes').update({ processo_id: data.id }).eq('id', intimacaoId).then();
        });
    }
    linkIntimacaoIdRef.current = null;
    setIsModalOpen(false); setSelectedProcesso(null); setIsNew(false);
  }, [selectedProcesso]);

  const handleMovimentoProcessoSelect = useCallback((processoId: string) => {
    const p = processos.find(x => x.id === processoId);
    if (p) { setSelectedProcesso(p); setIsNew(false); setIsModalOpen(true); }
  }, [processos]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  }, []);

  const handleAssign = useCallback(async () => {
    if (!assignUserId) return;
    setAssigning(true);
    await assignCoResponsavel(Array.from(selectedIds), assignUserId);
    setAssigning(false);
    setAssignDialog(false);
    setAssignUserId('');
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [assignUserId, selectedIds, assignCoResponsavel]);

  const handleExitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!perfilLoading && !canAccessProcessos) navigate('/dashboard');
  }, [perfilLoading, canAccessProcessos, navigate]);

  const kpis = useMemo(() => ({
    total:           processos.length,
    'Em Andamento':  processos.filter(p => p.status === 'Em Andamento').length,
    'Suspenso':      processos.filter(p => p.status === 'Suspenso').length,
    'Arquivado':     processos.filter(p => p.status === 'Arquivado').length,
    'Ganho':         processos.filter(p => p.status === 'Ganho').length,
    'Perdido':       processos.filter(p => p.status === 'Perdido').length,
    recursal:        processos.filter(p => p.fase?.toLowerCase() === 'recursal').length,
    execucao:        processos.filter(p => ['execução', 'execucao'].includes(p.fase?.toLowerCase() || '')).length,
  }), [processos]);

  const filteredProcessos = useMemo(() => processos.filter(p => {
    const s = searchTerm.toLowerCase();
    const matchSearch = !s || [
      p.numero_processo, p.titulo_acao, p.advogado_responsavel,
      p.assunto, p.orgao_julgador, p.nome_cliente, p.cpf_cliente, p.classe_cnj,
    ].some(v => v?.toLowerCase().includes(s));
    let matchStatus = true;
    if (statusFilter === 'recursal') matchStatus = p.fase?.toLowerCase() === 'recursal';
    else if (statusFilter === 'execucao') matchStatus = ['execução', 'execucao'].includes(p.fase?.toLowerCase() || '');
    else if (statusFilter !== 'todos') matchStatus = p.status === statusFilter;
    const matchAdvogado = advogadoFilter === 'todos' || p.advogado_responsavel?.replace(/\s*\(OAB.*\)/i, '').trim() === advogadoFilter;
    const matchFase = faseFilter === 'todos' || p.fase?.trim() === faseFilter;
    return matchSearch && matchStatus && matchAdvogado && matchFase;
  }), [processos, searchTerm, statusFilter, advogadoFilter, faseFilter]);

  const handleExportCSV = useCallback(() => {
    const cols = ['numero_processo','nome_cliente','advogado_responsavel','tribunal','grau','fase','status','data_distribuicao','valor_causa','assunto','classe_cnj'];
    const headers = ['Número','Cliente','Advogado','Tribunal','Grau','Fase','Status','Distribuição','Valor','Assunto','Classe CNJ'];
    const escape = (v: unknown) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = [headers.join(','), ...filteredProcessos.map((p: Processo) =>
      cols.map(c => escape((p as unknown as Record<string, unknown>)[c])).join(',')
    )];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `processos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [filteredProcessos]);

  if (perfilLoading) return <AppLayout><PageSkeleton cards={5} rows={8} /></AppLayout>;
  if (!canAccessProcessos) return null;

  const showSpinner = loading && processos.length === 0;

  // KPI config with reliable inline colors
  const kpiItems = [
    { key: 'todos',        label: 'Total',      icon: Scale,        num: 'hsl(var(--foreground))',  bar: 'hsl(var(--primary))',  bg: 'rgba(var(--primary-rgb),0.08)' },
    { key: 'Em Andamento', label: 'Andamento',  icon: CheckCircle2, num: '#2563eb', bar: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
    { key: 'Suspenso',     label: 'Suspensos',  icon: PauseCircle,  num: '#d97706', bar: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
    { key: 'Arquivado',    label: 'Arquivados', icon: Archive,      num: '#64748b', bar: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
    { key: 'Ganho',        label: 'Ganhos',     icon: Trophy,       num: '#059669', bar: '#10b981', bg: 'rgba(16,185,129,0.10)' },
    { key: 'Perdido',      label: 'Perdidos',   icon: XCircle,      num: '#dc2626', bar: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
    { key: 'recursal',     label: 'Recursal',   icon: Gavel,        num: '#7c3aed', bar: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' },
    { key: 'execucao',     label: 'Execução',   icon: FileCheck,    num: '#c2410c', bar: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  ];

  const kpiValue = (key: string) => key === 'todos' ? kpis.total : (kpis as any)[key] || 0;

  return (
    <AppLayout>
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-card/95 backdrop-blur-md border-b border-border/60">
        <div className="flex h-[72px] items-center justify-between px-4 md:px-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg md:text-xl font-bold text-foreground leading-none">Processos</h1>
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                  {processos.length}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden md:block mt-0.5">
                Gestão de processos jurídicos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(isAdmin || isGerente) && (
              <Button
                variant={selectionMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectionMode ? handleExitSelection() : setSelectionMode(true)}
                className="rounded-xl h-9 gap-1.5 text-xs border-border/60"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{selectionMode ? 'Cancelar' : 'Selecionar'}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncModal(true)}
              className="rounded-xl h-9 gap-1.5 text-xs border-border/60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-xl h-9 gap-1.5 px-4 shadow-sm shadow-primary/20">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline font-bold">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-border/60 w-48">
                <DropdownMenuItem onClick={handleNewProcesso} className="rounded-lg gap-2 font-medium">
                  <Plus className="h-4 w-4" /> Novo Processo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportCsv(true)} className="rounded-lg gap-2 font-medium">
                  <Upload className="h-4 w-4" /> Importar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="rounded-lg gap-2 font-medium">
                  <Download className="h-4 w-4" /> Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-8 space-y-5">

        {/* KPI CARDS + SUMMARY */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2.5">
            {kpiItems.map(k => (
              <KpiCard
                key={k.key}
                label={k.label}
                value={kpiValue(k.key)}
                icon={k.icon}
                numColor={k.num}
                barColor={k.bar}
                iconBg={k.bg}
                active={statusFilter === k.key}
                onClick={() => setStatusFilter(statusFilter === k.key ? 'todos' : k.key)}
              />
            ))}
          </div>
          <div className="hidden xl:block">
            <SummaryPanel kpis={kpis} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
          </div>
        </div>

        {/* MOVIMENTOS RECENTES */}
        {activeView === 'internos' && (
          <MovimentosRecentes onProcessoSelect={handleMovimentoProcessoSelect} />
        )}

        {/* CONTROLS BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Tab toggle */}
          <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/40 shrink-0">
            <button
              onClick={() => setActiveView('internos')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeView === 'internos'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Escritório
            </button>
            <button
              onClick={() => setActiveView('consulta')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeView === 'consulta'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Consultar CNJ
            </button>
          </div>

          {activeView === 'internos' && (
            <div className="flex flex-col flex-1 gap-2 w-full">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Número, cliente, advogado, assunto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 pr-9 h-10 rounded-xl bg-card border-border/60 shadow-sm focus:shadow-md transition-shadow"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Status select */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[152px] h-10 rounded-xl bg-card border-border/60 shrink-0 shadow-sm">
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                    <SelectItem value="Suspenso">Suspenso</SelectItem>
                    <SelectItem value="Arquivado">Arquivado</SelectItem>
                    <SelectItem value="Ganho">Ganho</SelectItem>
                    <SelectItem value="Perdido">Perdido</SelectItem>
                    <SelectItem value="recursal">Recursal</SelectItem>
                    <SelectItem value="execucao">Execução</SelectItem>
                  </SelectContent>
                </Select>

                {/* Advogado select */}
                {advogados.length > 0 && (
                  <Select value={advogadoFilter} onValueChange={setAdvogadoFilter}>
                    <SelectTrigger className="w-[160px] h-10 rounded-xl bg-card border-border/60 shrink-0 shadow-sm">
                      <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Advogado" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl max-h-60">
                      <SelectItem value="todos">Todos advogados</SelectItem>
                      {advogados.map(adv => (
                        <SelectItem key={adv} value={adv}>{adv}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Fase select */}
                {fases.length > 0 && (
                  <Select value={faseFilter} onValueChange={setFaseFilter}>
                    <SelectTrigger className="w-[148px] h-10 rounded-xl bg-card border-border/60 shrink-0 shadow-sm">
                      <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="Fase" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      <SelectItem value="todos">Todas as fases</SelectItem>
                      {fases.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(searchTerm || statusFilter !== 'todos' || advogadoFilter !== 'todos' || faseFilter !== 'todos') && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setSearchTerm(''); setStatusFilter('todos'); setAdvogadoFilter('todos'); setFaseFilter('todos'); }}
                    className="h-10 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Limpar tudo
                  </Button>
                )}
              </div>

              {/* Active filter chips */}
              {(statusFilter !== 'todos' || advogadoFilter !== 'todos' || faseFilter !== 'todos' || searchTerm) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">
                    {filteredProcessos.length} resultado{filteredProcessos.length !== 1 ? 's' : ''}
                  </span>
                  {searchTerm && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 border border-border/50 text-[11px] font-medium text-foreground">
                      "{searchTerm.length > 20 ? searchTerm.slice(0, 20) + '…' : searchTerm}"
                      <button onClick={() => setSearchTerm('')} className="hover:text-destructive transition-colors ml-0.5"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                  {statusFilter !== 'todos' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary">
                      {statusFilter}
                      <button onClick={() => setStatusFilter('todos')} className="hover:text-destructive transition-colors ml-0.5"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                  {advogadoFilter !== 'todos' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40">
                      <Users className="h-2.5 w-2.5 shrink-0" />
                      {advogadoFilter.split(' ')[0]}
                      <button onClick={() => setAdvogadoFilter('todos')} className="hover:text-destructive transition-colors ml-0.5"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                  {faseFilter !== 'todos' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-medium text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/40">
                      <Layers className="h-2.5 w-2.5 shrink-0" />
                      {faseFilter}
                      <button onClick={() => setFaseFilter('todos')} className="hover:text-destructive transition-colors ml-0.5"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONTENT */}
        {activeView === 'internos' ? (
          showSpinner ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center relative">
                <Scale className="h-8 w-8 text-primary/20" />
                <Loader2 className="absolute h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Carregando processos...</p>
            </div>
          ) : (
            <ProcessosTable
              processos={filteredProcessos}
              onProcessoClick={handleProcessoClick}
              leads={leadNames}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
            />
          )
        ) : (
          <Suspense fallback={
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          }>
            <ConsultaProcessoExterno />
          </Suspense>
        )}
      </div>

      {isModalOpen && (
        <Suspense fallback={null}>
          <ProcessoModalExpanded
            processo={selectedProcesso}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            isNew={isNew}
            canDelete={canDelete}
            leads={leadNames}
          />
        </Suspense>
      )}

      <ImportProcessosCsvModal isOpen={showImportCsv} onClose={() => setShowImportCsv(false)} />
      <SyncProcessosModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} totalProcessos={processos.length} />

      {/* Floating action bar for batch selection */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border shadow-2xl shadow-black/20">
          <span className="text-sm font-bold text-foreground">
            {selectedIds.size} processo{selectedIds.size !== 1 ? 's' : ''} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            className="rounded-xl h-9 gap-2 text-xs"
            onClick={() => setAssignDialog(true)}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Atribuir co-responsável
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl h-9 text-xs text-muted-foreground"
            onClick={handleExitSelection}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Assignment dialog */}
      <Dialog open={assignDialog} onOpenChange={o => { if (!o) { setAssignDialog(false); setAssignUserId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir co-responsável</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o colaborador que será co-responsável pelos {selectedIds.size} processo{selectedIds.size !== 1 ? 's' : ''} selecionados. Ele será notificado automaticamente.
            </p>
            <Select value={assignUserId || '__none__'} onValueChange={v => setAssignUserId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecione...</SelectItem>
                {usuarios.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}{u.sobrenome ? ` ${u.sobrenome.split(' ')[0]}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(false); setAssignUserId(''); }} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={!assignUserId || assigning} className="rounded-xl gap-2">
              {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default memo(ProcessosPage);
