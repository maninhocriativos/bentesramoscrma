import { useState, useEffect, lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { usePerfil } from '@/hooks/usePerfil';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Processo } from '@/types/processos';

const ProcessoSidePanel = lazy(() =>
  import('@/components/processos/ProcessoSidePanel').then(m => ({ default: m.ProcessoSidePanel }))
);
import {
  Loader2, Gavel, Search, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, Eye, FileText, CalendarDays,
  Scale, BookOpen, ChevronRight, ChevronDown,
  MessageSquare, ClipboardList, Copy, ExternalLink,
  Inbox, EyeOff, Timer, X, Sparkles, TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, isValid, addDays, addBusinessDays, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateIntimacaoReport, generateBatchIntimacaoReport } from '@/lib/intimacaoReportGenerator';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentoUploadModal } from '@/components/documentos/DocumentoUploadModal';
import { useNavigate } from 'react-router-dom';

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  email: string | null;
  oab_numero?: string | null;
  oab_uf?: string | null;
}

interface AcaoSugerida { titulo: string; descricao: string; prazo_dias: number | null; prioridade: string; }
interface AnaliseIA { resumo: string; recomendacao: string; acoes: AcaoSugerida[]; }

interface Intimacao {
  id: string;
  processo_cnj: string;
  processo_titulo: string;
  tribunal: string;
  tipo_intimacao: string;
  conteudo: string;
  data_intimacao: string | null;
  data_disponibilizacao: string | null;
  data_publicacao: string | null;
  oab_numero: string;
  oab_uf: string;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
  fonte?: string;
  raw_json?: Record<string, unknown>;
  advogado_id?: string | null;
  processo_id?: string | null;
  analise_ia?: AnaliseIA | null;
  analisado_em?: string | null;
}

async function copyTextToClipboard(text: string, label = 'Número do processo') {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast.success(`${label} copiado!`);
  } catch { toast.error(`Não foi possível copiar ${label.toLowerCase()}`); }
}

function getTypeConfig(tipo: string) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('intimação') || t.includes('intimacao') || t.includes('citação') || t.includes('citacao'))
    return { bar: '#f59e0b', avatarFrom: '#fbbf24', avatarTo: '#f97316', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', cardUnread: 'bg-amber-50/80 dark:bg-amber-950/15', dot: 'bg-amber-500' };
  if (t.includes('sentença') || t.includes('sentenca'))
    return { bar: '#10b981', avatarFrom: '#34d399', avatarTo: '#0d9488', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', cardUnread: 'bg-emerald-50/80 dark:bg-emerald-950/15', dot: 'bg-emerald-500' };
  if (t.includes('decisão') || t.includes('decisao'))
    return { bar: '#8b5cf6', avatarFrom: '#a78bfa', avatarTo: '#7c3aed', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200', cardUnread: 'bg-purple-50/80 dark:bg-purple-950/15', dot: 'bg-purple-500' };
  if (t.includes('despacho'))
    return { bar: '#0ea5e9', avatarFrom: '#38bdf8', avatarTo: '#2563eb', badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200', cardUnread: 'bg-sky-50/80 dark:bg-sky-950/15', dot: 'bg-sky-500' };
  return { bar: '#3b82f6', avatarFrom: '#60a5fa', avatarTo: '#4f46e5', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200', cardUnread: 'bg-blue-50/80 dark:bg-blue-950/15', dot: 'bg-blue-500' };
}

export default function IntimacoesPage() {
  const { perfil } = usePerfil();
  const { settings: officeSettings } = useOfficeSettings();
  const { user } = useAuth();
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLida, setFilterLida] = useState<'all' | 'unread' | 'read' | 'urgent' | 'today'>('all');
  const [selectedIntimacao, setSelectedIntimacao] = useState<Intimacao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    const s = localStorage.getItem('intimacoes-last-sync');
    return s ? new Date(s) : null;
  });
  const [tick, setTick] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [viewingProcesso, setViewingProcesso] = useState<Processo | null>(null);

  const handleVisualizarProcesso = async (processoId: string) => {
    const { data } = await supabase.from('processos').select('*').eq('id', processoId).maybeSingle();
    if (data) setViewingProcesso(data as Processo);
    else toast.error('Processo não encontrado');
  };

  const oabNumero = officeSettings?.oab_number || (perfil as any)?.oab_numero || '';
  const oabUf = officeSettings?.oab_state || (perfil as any)?.oab_uf || 'AM';

  useEffect(() => { if (user) fetchIntimacoes(); }, [user]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 60000); return () => clearInterval(t); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterLida]);
  useEffect(() => {
    supabase.from('perfis').select('id, nome, sobrenome, email, oab_numero, oab_uf').eq('aprovado', true)
      .then(({ data }) => { if (data) setMembers(data as TeamMember[]); });
  }, []);

  const getMemberName = (member: TeamMember) =>
    [member.nome, member.sobrenome].filter(Boolean).join(' ') || member.email || 'Usuário';

  const resolverResponsavel = (intimacao: Intimacao): TeamMember | null =>
    members.find(m => intimacao.advogado_id && m.id === intimacao.advogado_id)
    || members.find(m => m.oab_numero && m.oab_numero === intimacao.oab_numero && (m.oab_uf || 'AM') === intimacao.oab_uf)
    || null;

  const fetchIntimacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('intimacoes')
      .select('*')
      .order('data_publicacao', { ascending: false, nullsFirst: false })
      .order('data_disponibilizacao', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) console.error(error); else setIntimacoes((data as any[]) || []);
    setLoading(false);
  };

  const handleSync = async () => {
    if (!oabNumero) { toast.error('Configure seu número da OAB no perfil'); return; }
    setSyncing(true);
    try {
      // Só atribui advogado_id quando a busca roda de fato sob a OAB pessoal de
      // quem clicou — senão (fallback para a OAB genérica do escritório) fica
      // null, como nos jobs do cron. Evita marcar quem clicou (ex: estagiário,
      // secretaria) como "dono" de uma intimação buscada pela OAB de outra pessoa.
      const usandoOabPropria = !!(perfil as any)?.oab_numero && (perfil as any).oab_numero === oabNumero;
      const { data, error } = await supabase.functions.invoke('intimacoes-oab', { body: { oab_numero: oabNumero, oab_uf: oabUf, advogado_id: usandoOabPropria ? user?.id : null } });
      if (error) throw error;
      const syncedAt = new Date();
      setLastSyncAt(syncedAt);
      localStorage.setItem('intimacoes-last-sync', syncedAt.toISOString());
      if (data?.success) {
        const saved: number = data.saved ?? 0;
        const updated: number = data.updated ?? 0;
        const foundToday: number = data.found_today ?? 0;
        const totalFound: number = data.total ?? 0;
        const latestDate: string = data.latest_date ?? '';
        const byStrategy: Record<string, number> = data.by_strategy ?? {};
        const strategyStr = Object.entries(byStrategy).map(([k, v]) => `${k}:${v}`).join(' · ');
        const latestInfo = latestDate ? ` · mais recente: ${latestDate}` : '';
        if (saved > 0) {
          toast.success(`${saved} nova(s) intimação(ões)`, {
            description: `Total: ${totalFound} | Hoje: ${foundToday}${latestInfo}${updated > 0 ? ` | ${updated} atualizada(s)` : ''}`,
          });
        } else {
          toast.success('Sincronização concluída', {
            description: foundToday > 0
              ? `${foundToday} publicações de hoje já no banco · Total: ${totalFound}${latestInfo}`
              : `Nenhuma de hoje nas APIs · Total: ${totalFound}${latestInfo}${strategyStr ? ` · ${strategyStr}` : ''}`,
          });
        }
        await fetchIntimacoes();
      } else {
        toast.error(data?.error || 'Erro ao sincronizar');
      }
    } catch (err: any) { toast.error('Erro ao sincronizar', { description: err.message }); }
    finally { setSyncing(false); }
  };

  const handleMarkRead = async (id: string) => {
    await supabase.from('intimacoes').update({ lida: true, lida_em: new Date().toISOString() }).eq('id', id);
    setIntimacoes(prev => prev.map(i => i.id === id ? { ...i, lida: true, lida_em: new Date().toISOString() } : i));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { const d = parseISO(dateStr); return isValid(d) ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : dateStr; } catch { return dateStr; }
  };

  const formatDateLong = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try { const d = parseISO(dateStr); return isValid(d) ? format(d, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }) : dateStr; } catch { return dateStr; }
  };

  const calcularPrazos = (intimacao: Intimacao) => {
    const baseDate = intimacao.data_publicacao || intimacao.data_intimacao || intimacao.data_disponibilizacao;
    if (!baseDate) return { dataBase: null, dataConclusao: null, dataFatal: null };
    const base = parseISO(baseDate);
    if (!isValid(base)) return { dataBase: base, dataConclusao: null, dataFatal: null };
    const tipo = (intimacao.tipo_intimacao || '').toLowerCase();
    let pu = 15, pf = 20;
    if (tipo.includes('embargos')) { pu = 5; pf = 10; }
    else if (tipo.includes('manifestação') || tipo.includes('manifestacao')) { pu = 5; pf = 10; }
    else if (tipo.includes('ciência') || tipo.includes('ciencia')) { pu = 5; pf = 15; }
    else if (tipo.includes('sessão') || tipo.includes('sessao') || tipo.includes('julgamento')) { pu = 0; pf = 0; }
    else if (tipo.includes('pagamento')) { pu = 15; pf = 15; }
    let start = addDays(base, 1);
    while (isWeekend(start)) start = addDays(start, 1);
    return { dataBase: base, dataConclusao: pu > 0 ? addBusinessDays(start, pu) : null, dataFatal: pf > 0 ? addBusinessDays(start, pf) : null };
  };

  const getUrgencyInfo = (intimacao: Intimacao) => {
    const { dataFatal } = calcularPrazos(intimacao);
    if (!dataFatal) return { level: 'none' as const, label: '' };
    const diff = Math.ceil((dataFatal.getTime() - Date.now()) / 86400000);
    if (diff < 0) return { level: 'overdue' as const, label: `Vencido há ${Math.abs(diff)}d` };
    if (diff <= 7) return { level: 'urgent' as const, label: diff === 0 ? 'Vence hoje!' : `Faltam ${diff}d` };
    if (diff <= 15) return { level: 'warning' as const, label: `Faltam ${diff}d` };
    return { level: 'safe' as const, label: `Faltam ${diff}d` };
  };

  const handleGenerateReport = (intimacao: Intimacao, e?: React.MouseEvent) => {
    e?.stopPropagation(); generateIntimacaoReport(intimacao); toast.success('Relatório gerado');
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(i => i.id)));

  const handleToggleRead = async (id: string, lida: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (lida) { await supabase.from('intimacoes').update({ lida: false, lida_em: null }).eq('id', id); setIntimacoes(p => p.map(i => i.id === id ? { ...i, lida: false, lida_em: null } : i)); }
    else await handleMarkRead(id);
  };

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  // Conta por data_disponibilizacao (quando publicado no Diário Oficial) — igual ao Advbox
  const todayCount = intimacoes.filter(i =>
    (i.data_disponibilizacao && i.data_disponibilizacao.startsWith(todayStr)) ||
    (i.data_publicacao && i.data_publicacao.startsWith(todayStr)) ||
    (!i.data_disponibilizacao && !i.data_publicacao && new Date(i.created_at) >= todayStart)
  ).length;
  const unreadCount = intimacoes.filter(i => !i.lida).length;
  const readCount = intimacoes.length - unreadCount;
  const urgentCount = intimacoes.filter(i => { const u = getUrgencyInfo(i); return u.level === 'urgent' || u.level === 'overdue'; }).length;
  const readPct = intimacoes.length > 0 ? Math.round((readCount / intimacoes.length) * 100) : 0;

  const syncAgoText = (() => {
    void tick;
    if (!lastSyncAt) return null;
    const diff = Math.floor((Date.now() - lastSyncAt.getTime()) / 60000);
    if (diff < 1) return 'agora mesmo';
    if (diff < 60) return `há ${diff} min`;
    const hrs = Math.floor(diff / 60);
    return hrs === 1 ? 'há 1h' : `há ${hrs}h`;
  })();

  const filtered = intimacoes.filter(i => {
    const s = searchTerm.toLowerCase();
    const ok = !searchTerm || i.processo_cnj?.toLowerCase().includes(s) || i.processo_titulo?.toLowerCase().includes(s) || i.conteudo?.toLowerCase().includes(s) || i.tipo_intimacao?.toLowerCase().includes(s);
    if (filterLida === 'unread') return ok && !i.lida;
    if (filterLida === 'read') return ok && i.lida;
    if (filterLida === 'urgent') { const u = getUrgencyInfo(i); return ok && (u.level === 'urgent' || u.level === 'overdue'); }
    if (filterLida === 'today') return ok && (
      (i.data_disponibilizacao && i.data_disponibilizacao.startsWith(todayStr)) ||
      (i.data_publicacao && i.data_publicacao.startsWith(todayStr)) ||
      (!i.data_disponibilizacao && !i.data_publicacao && new Date(i.created_at) >= todayStart)
    );
    return ok;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);

  const kpis = [
    { icon: BookOpen, label: 'Total de Publicações', value: intimacoes.length, numClr: 'text-foreground', iconBg: 'bg-primary/10', iconClr: 'text-primary', barClr: 'from-primary to-primary/50', filter: null },
    {
      icon: Sparkles, label: 'Chegaram Hoje', value: todayCount,
      numClr: todayCount > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconClr: 'text-violet-600 dark:text-violet-400',
      barClr: 'from-violet-500 to-purple-400', filter: 'today' as const,
    },
    { icon: AlertTriangle, label: 'Pendentes de Leitura', value: unreadCount, numClr: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-900/30', iconClr: 'text-rose-600 dark:text-rose-400', barClr: 'from-rose-500 to-orange-400', filter: 'unread' as const },
    { icon: CheckCircle2, label: 'Já Analisadas', value: readCount, numClr: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconClr: 'text-emerald-600 dark:text-emerald-400', barClr: 'from-emerald-500 to-teal-400', filter: 'read' as const },
  ];

  return (
    <AppLayout>
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-card/95 backdrop-blur-md">
        <div className="flex h-16 md:h-[72px] items-center justify-between px-4 md:px-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Scale className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-foreground leading-none">Intimações</h1>
                <p className="text-[11px] text-muted-foreground hidden md:block mt-0.5">Monitoramento de publicações em Diários Oficiais</p>
              </div>
            </div>
          </div>

          {/* Stats widget — centro do header */}
          {intimacoes.length > 0 && (
            <div className="hidden md:flex items-stretch gap-0 bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-default border-r border-border/40">
                <div className="relative">
                  <div className="h-7 w-7 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <EyeOff className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  </div>
                  {unreadCount > 0 && <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />}
                </div>
                <div>
                  <p className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums leading-none">{unreadCount}</p>
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mt-0.5">não lidas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-default border-r border-border/40">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{readCount}</p>
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mt-0.5">lidas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-default border-r border-border/40">
                <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-violet-600 dark:text-violet-400 tabular-nums leading-none">{todayCount}</p>
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mt-0.5">hoje</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-default">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-black text-foreground tabular-nums leading-none">{readPct}%</p>
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mt-0.5">concluído</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {oabNumero && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
                <Gavel className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">OAB/{oabUf} {oabNumero}</span>
              </div>
            )}
            <div className="flex flex-col items-end gap-0.5">
              <Button onClick={handleSync} disabled={syncing || !oabNumero} className="h-9 md:h-10 text-xs md:text-sm rounded-xl gap-2 shadow-sm shadow-primary/20">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{syncing ? 'Buscando...' : 'Sincronizar'}</span>
              </Button>
              {syncAgoText && (
                <span className="text-[9px] text-muted-foreground hidden md:block">
                  Última sync: {syncAgoText}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-8 space-y-6">
        {/* OAB warning */}
        {!oabNumero && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40">
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Configure sua OAB</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Acesse Configurações → Escritório para habilitar a busca automática.</p>
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((k, idx) => (
            <button
              key={idx}
              onClick={() => k.filter && setFilterLida(k.filter)}
              className={`group relative overflow-hidden rounded-2xl bg-card border text-left select-none transition-all duration-200 hover:-translate-y-1 hover:shadow-xl p-4 md:p-5
                ${k.filter && filterLida === k.filter ? 'border-primary/50 ring-2 ring-primary/20 shadow-lg' : 'border-border/50'}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${k.barClr}`} />
              <div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${k.barClr} opacity-[0.06] group-hover:opacity-[0.12] group-hover:scale-110 transition-all duration-500`} />
              <div className="relative flex items-start justify-between mb-3">
                <div className={`h-9 w-9 rounded-xl ${k.iconBg} flex items-center justify-center`}>
                  <k.icon className={`h-4 w-4 ${k.iconClr}`} />
                </div>
                {idx === 1 && todayCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 animate-pulse">NOVO</span>
                )}
                {idx === 2 && unreadCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{Math.round((unreadCount/intimacoes.length)*100)}%</span>
                )}
                {idx === 3 && readCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{readPct}%</span>
                )}
              </div>
              <p className={`relative text-3xl lg:text-4xl font-black tracking-tight tabular-nums ${k.numClr}`}>
                {k.value.toLocaleString('pt-BR')}
              </p>
              <p className="relative text-[10px] font-semibold text-muted-foreground mt-1.5 uppercase tracking-widest leading-tight">
                {k.label}
              </p>
            </button>
          ))}
        </div>

        {/* PROGRESS BAR */}
        {intimacoes.length > 0 && (
          <div className="rounded-2xl bg-card border border-border/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-foreground">Progresso de leitura</span>
              </div>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{readPct}% concluído</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                style={{ width: `${readPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">{readCount} lidas</span>
              <span className="text-[10px] text-rose-500 font-medium">{unreadCount} pendentes</span>
            </div>
          </div>
        )}

        {/* SEARCH + FILTERS */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por CNJ, título, tribunal, conteúdo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11 rounded-xl border-border/60 bg-card shadow-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 border border-border/40 flex-wrap">
            {([
              { key: 'all' as const, label: 'Todas', count: intimacoes.length, icon: Inbox, clr: '' },
              { key: 'today' as const, label: 'Hoje', count: todayCount, icon: Sparkles, clr: 'text-violet-600' },
              { key: 'unread' as const, label: 'Não lidas', count: unreadCount, icon: EyeOff, clr: 'text-rose-600' },
              { key: 'read' as const, label: 'Lidas', count: readCount, icon: Eye, clr: 'text-emerald-600' },
              { key: 'urgent' as const, label: 'Urgentes', count: urgentCount, icon: AlertTriangle, clr: 'text-amber-600' },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilterLida(f.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none whitespace-nowrap
                  ${filterLida === f.key
                    ? f.key === 'urgent' ? 'bg-amber-500 text-white shadow-sm' : f.key === 'today' ? 'bg-violet-600 text-white shadow-sm' : f.key === 'unread' ? 'bg-rose-600 text-white shadow-sm' : f.key === 'read' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card'}`}
              >
                <f.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{f.label}</span>
                <span className={`min-w-[16px] text-center text-[10px] font-black px-1 py-0.5 rounded ${filterLida === f.key ? 'bg-white/25' : 'bg-muted-foreground/15'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5 flex-wrap gap-1">
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Sincronização automática: 06h, 12h e 17h (Manaus) · DJEN / Escavador / DataJud</span>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <span className="font-semibold text-primary">{selectedIds.size} selecionada(s)</span>
            )}
            <span className="font-medium">{filtered.length} de {intimacoes.length} publicações</span>
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center relative">
              <Scale className="h-8 w-8 text-primary/20" />
              <Loader2 className="absolute h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Carregando publicações...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 border-2 border-dashed border-border/40 rounded-2xl">
            <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Scale className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <p className="text-sm font-semibold text-foreground">{intimacoes.length === 0 ? 'Nenhuma intimação encontrada' : 'Nenhum resultado'}</p>
            <p className="text-xs text-muted-foreground">{intimacoes.length === 0 ? 'Clique em "Sincronizar" para buscar publicações.' : 'Tente alterar os termos da busca.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Batch bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap px-0.5 pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
                <span className="text-xs text-muted-foreground">{selectedIds.size > 0 ? `${selectedIds.size} selecionada(s)` : 'Selecionar tudo'}</span>
              </label>
              <div className="flex items-center gap-1.5">
                {selectedIds.size > 0 && (
                  <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => { const items = filtered.filter(i => selectedIds.has(i.id)); if (!items.length) { toast.error('Selecione ao menos uma'); return; } generateBatchIntimacaoReport(items); toast.success(`Relatório (${items.length})`); }}>
                    <FileText className="h-3.5 w-3.5" /> Relatório ({selectedIds.size})
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => { generateBatchIntimacaoReport(filtered); toast.success(`Relatório (${filtered.length})`); }}>
                  <FileText className="h-3.5 w-3.5" /> Todas ({filtered.length})
                </Button>
              </div>
            </div>

            {/* TABELA — estilo Advbox: Processo | Publicação | Tribunal | Número do processo | Responsável | Situação */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-9 px-3 py-2.5"></th>
                    <th className="text-left px-3 py-2.5 font-semibold">Processo</th>
                    <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">Publicação</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Tribunal</th>
                    <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">Número do processo</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Responsável</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(intimacao => {
                    const tc = getTypeConfig(intimacao.tipo_intimacao);
                    const isSelected = selectedIds.has(intimacao.id);
                    const isUnread = !intimacao.lida;
                    const temProcessoCadastrado = !!intimacao.processo_id;
                    const responsavel = resolverResponsavel(intimacao);
                    const publicacaoData = intimacao.data_publicacao || intimacao.data_disponibilizacao || intimacao.data_intimacao;

                    return (
                      <tr
                        key={intimacao.id}
                        onClick={() => { setSelectedIntimacao(intimacao); if (isUnread) handleMarkRead(intimacao.id); }}
                        className={`cursor-pointer border-b border-border/30 last:border-0 transition-colors ${isSelected ? 'bg-primary/[0.04]' : isUnread ? 'hover:bg-muted/30' : 'hover:bg-muted/20 opacity-80'}`}
                        style={isUnread ? { backgroundColor: tc.cardUnread } : undefined}
                      >
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(intimacao.id)} />
                        </td>
                        <td className="px-3 py-3 max-w-[280px]">
                          {temProcessoCadastrado ? (
                            <>
                              <p className={`font-semibold leading-snug truncate ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                                {intimacao.processo_titulo || intimacao.tipo_intimacao || 'Publicação'}
                              </p>
                              {intimacao.conteudo && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{intimacao.conteudo}</p>
                              )}
                            </>
                          ) : (
                            <span className="font-semibold text-muted-foreground/70">N/A</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(publicacaoData) || '—'}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {intimacao.tribunal || '—'}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {intimacao.processo_cnj || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${tc.avatarFrom}, ${tc.avatarTo})` }}
                              title={responsavel ? getMemberName(responsavel) : `OAB/${intimacao.oab_uf} ${intimacao.oab_numero}`}
                            >
                              {(responsavel ? getMemberName(responsavel) : intimacao.oab_numero || 'U')[0]?.toUpperCase()}
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[110px]">
                              {responsavel ? getMemberName(responsavel) : `OAB/${intimacao.oab_uf} ${intimacao.oab_numero}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => handleToggleRead(intimacao.id, intimacao.lida, e)}
                            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                              intimacao.lida
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40'
                                : 'bg-card text-muted-foreground border-border/60 hover:bg-muted/50'
                            }`}
                          >
                            {intimacao.lida ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            {intimacao.lida ? 'Concluído' : 'Pendente'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/40 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Registros por página:</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-8 rounded-lg border border-border/60 bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground mr-2">
                    {pageStart}–{pageEnd} de {filtered.length}
                  </span>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Primeira página"
                  >
                    <span className="text-xs font-bold">«</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Página anterior"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                    const page = start + idx;
                    if (page > totalPages) return null;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`h-8 min-w-[2rem] px-2 rounded-lg border text-xs font-semibold transition-colors ${page === safePage ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50 text-muted-foreground hover:bg-muted/60'}`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Última página"
                  >
                    <span className="text-xs font-bold">»</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 gap-0 rounded-2xl border-border/70 bg-background shadow-2xl flex flex-col">
          {selectedIntimacao && (
            <IntimacaoDetailModal
              intimacao={selectedIntimacao}
              formatDate={formatDate}
              formatDateLong={formatDateLong}
              calcularPrazos={calcularPrazos}
              onMarkRead={() => { handleMarkRead(selectedIntimacao.id); setSelectedIntimacao({ ...selectedIntimacao, lida: true }); }}
              onGenerateReport={() => handleGenerateReport(selectedIntimacao)}
              onVisualizarProcesso={handleVisualizarProcesso}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Painel lateral do processo — igual o Advbox, sem sair da tela */}
      {viewingProcesso && (
        <Suspense fallback={null}>
          <ProcessoSidePanel
            processo={viewingProcesso}
            open={!!viewingProcesso}
            onClose={() => setViewingProcesso(null)}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}

function IntimacaoDetailModal({ intimacao, formatDate, formatDateLong, calcularPrazos, onMarkRead, onGenerateReport, onVisualizarProcesso }: {
  intimacao: Intimacao; formatDate: (d: string | null) => string | null; formatDateLong: (d: string | null) => string;
  calcularPrazos: (i: Intimacao) => { dataBase: Date | null; dataConclusao: Date | null; dataFatal: Date | null };
  onMarkRead: () => void; onGenerateReport: () => void; onVisualizarProcesso: (processoId: string) => void;
}) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [comentario, setComentario] = useState('');
  const [processoSearch, setProcessoSearch] = useState('');
  const [processoResults, setProcessoResults] = useState<any[]>([]);
  const [linkedProcesso, setLinkedProcesso] = useState<{
    id: string | null; numero: string; titulo: string; area?: string | null; assunto?: string | null;
    advogado_responsavel?: string | null; tribunal?: string | null; partes_json?: any[] | null;
  } | null>(null);
  const [linkedClienteId, setLinkedClienteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [tarefasAdicionadas, setTarefasAdicionadas] = useState<string[]>([]);
  const [tarefasCustom, setTarefasCustom] = useState<string[]>([]);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [documentoModalOpen, setDocumentoModalOpen] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [selectedTarefaTipo, setSelectedTarefaTipo] = useState('');
  const [prazoSeguranca, setPrazoSeguranca] = useState('');
  const [prazoFatal, setPrazoFatal] = useState('');
  const [horarioTarefa, setHorarioTarefa] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [savingTarefa, setSavingTarefa] = useState(false);
  const [analise, setAnalise] = useState<AnaliseIA | null>(intimacao.analise_ia || null);
  const [analisando, setAnalisando] = useState(false);
  const [aprovandoTudo, setAprovandoTudo] = useState(false);
  const { user: currentUser } = useAuth();

  const TAREFAS = ['Manifestação','Recurso de Apelação','Recurso Especial','Recurso Extraordinário','Recurso Ordinário','Recurso Inominado','Embargos de Declaração','Contrarrazões','Alegações Finais','Memoriais','Agravo de Instrumento','Agravo Interno','Sentença','Acórdão','Sessão de Julgamento','Réplica','Perícia'];
  const allTarefas = [...TAREFAS, ...tarefasCustom];
  const tc = getTypeConfig(intimacao.tipo_intimacao);
  const prazos = calcularPrazos(intimacao);
  const fmt = (d: Date | null) => d ? format(d, 'dd/MM/yyyy') : '—';
  const conteudo = intimacao.conteudo || '';
  const displayContent = showFullContent ? conteudo : conteudo.slice(0, 800);

  const getMemberName = (member: TeamMember) => {
    const name = [member.nome, member.sobrenome].filter(Boolean).join(' ');
    return name || member.email || 'Usuário';
  };

  const pagina = (intimacao.raw_json as any)?.pagina ?? (intimacao.raw_json as any)?.page ?? null;

  // Advogado dono da intimação: tenta por advogado_id primeiro, depois por OAB (cobre jobs com advogado_id: null)
  const advogadoIntimacao =
    members.find((m: TeamMember) => intimacao.advogado_id && m.id === intimacao.advogado_id) ||
    members.find((m: TeamMember) => m.oab_numero && m.oab_numero === intimacao.oab_numero && (m.oab_uf || 'AM') === intimacao.oab_uf) ||
    null;
  const nomePesquisado = advogadoIntimacao
    ? getMemberName(advogadoIntimacao)
    : `OAB/${intimacao.oab_uf} ${intimacao.oab_numero}`;

  const createdAt = new Date(intimacao.created_at);
  const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  const createdAgoText = daysAgo === 0 ? 'hoje' : daysAgo === 1 ? '1 dia atrás' : `${daysAgo} dias atrás`;

  const fonteDisplay = (() => {
    const f = intimacao.fonte || '';
    if (f === 'djen') return 'DJEN (Diário Nacional)';
    if (f === 'datajud' || f === 'datajud_cnj') return 'DataJud (Tribunal)';
    if (f === 'escavador_v2' || f === 'escavador_v2_pub') return 'Escavador';
    if (f === 'escavador_v1' || f === 'escavador_v1_id') return intimacao.processo_titulo || 'Diário Oficial';
    if (f === 'dje_tjam') return 'DJe TJAM';
    return f || 'Sistema';
  })();

  const searchProcessos = async (term: string) => {
    setProcessoSearch(term);
    if (term.length < 2) { setProcessoResults([]); setShowDropdown(false); return; }
    const { data } = await supabase
      .from('processos')
      .select('id, numero_processo, titulo_acao, nome_cliente, area, assunto, advogado_responsavel, tribunal, partes_json, cliente_id')
      .or(`numero_processo.ilike.%${term}%,titulo_acao.ilike.%${term}%,nome_cliente.ilike.%${term}%`)
      .limit(10);
    setProcessoResults((data as any[]) || []);
    setShowDropdown(true);
  };

  const selecionarProcesso = async (p: { id: string; numero_processo: string; titulo_acao?: string; nome_cliente?: string; cliente_id?: string | null; area?: string | null; assunto?: string | null; advogado_responsavel?: string | null; tribunal?: string | null; partes_json?: any[] | null }) => {
    setLinkedProcesso({
      id: p.id, numero: p.numero_processo || '', titulo: p.titulo_acao || p.nome_cliente || '',
      area: p.area, assunto: p.assunto, advogado_responsavel: p.advogado_responsavel,
      tribunal: p.tribunal, partes_json: p.partes_json,
    });
    setLinkedClienteId(p.cliente_id || null);
    setProcessoSearch('');
    setShowDropdown(false);
    await persistProcessoLink(p.id);
  };

  const desvincularProcesso = async () => {
    setLinkedProcesso(null);
    setLinkedClienteId(null);
    await persistProcessoLink(null);
  };

  // Vai para a página de Processos com o modal de cadastro já aberto e
  // preenchido com os dados do DJEN (CNJ/tribunal/título) — evita embutir o
  // ProcessoModalExpanded (componente grande, com premissas próprias de
  // contexto) dentro da página de Intimações. A página de Processos persiste
  // o vínculo de volta em intimacoes.processo_id após salvar (via
  // linkIntimacaoId no state da navegação).
  const handleCadastrarProcesso = () => {
    navigate('/processos', {
      state: {
        novoProcesso: {
          numero_processo: intimacao.processo_cnj || '',
          titulo_acao: intimacao.processo_titulo || '',
          tribunal: intimacao.tribunal || '',
        },
        linkIntimacaoId: intimacao.id,
      },
    });
  };

  useEffect(() => {
    const fetchMembers = async () => {
      // Não filtra por cargo='Advogado': "cargo" em perfis é um papel único
      // (Administrador/Secretaria/Estagiário) e não cobre quem acumula função
      // de advogado (ex: Andrey é Administrador + Advogado via user_roles) —
      // filtrar por cargo deixava a lista sempre vazia. Mesmo padrão simples
      // já usado em ProcessoModalExpanded para a lista de responsáveis.
      const { data } = await supabase
        .from('perfis')
        .select('id, nome, sobrenome, email, oab_numero, oab_uf')
        .eq('aprovado', true)
        .order('nome', { ascending: true });
      // Deduplica por oab_numero (perfis duplicados do mesmo advogado); quem
      // não tem OAB (equipe não-advogada) é deduplicado pelo próprio id.
      const seen = new Set<string>();
      const unique = ((data as TeamMember[]) || []).filter(m => {
        const key = m.oab_numero ? `${m.oab_numero}-${m.oab_uf || 'AM'}` : `id-${m.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setMembers(unique);
    };
    void fetchMembers();
  }, []);

  // Carrega o processo já vinculado (persistido em intimacoes.processo_id)
  useEffect(() => {
    if (!intimacao.processo_id) return;
    (async () => {
      const { data } = await supabase
        .from('processos')
        .select('id, numero_processo, titulo_acao, nome_cliente, cliente_id, area, assunto, advogado_responsavel, tribunal, partes_json')
        .eq('id', intimacao.processo_id)
        .maybeSingle();
      if (data) {
        setLinkedProcesso({
          id: data.id, numero: data.numero_processo || '', titulo: data.titulo_acao || data.nome_cliente || '',
          area: data.area, assunto: (data as any).assunto, advogado_responsavel: data.advogado_responsavel,
          tribunal: data.tribunal, partes_json: (data.partes_json as any[]) || [],
        });
        setLinkedClienteId(data.cliente_id || null);
      }
    })();
  }, [intimacao.processo_id]);

  // Persiste o vínculo (ou remoção) na tabela — antes só vivia no estado local do modal
  const persistProcessoLink = async (processoId: string | null) => {
    const { error } = await supabase.from('intimacoes').update({ processo_id: processoId }).eq('id', intimacao.id);
    if (error) toast.error('Erro ao salvar vínculo do processo', { description: error.message });
  };

  useEffect(() => {
    if (!prazoSeguranca && prazos.dataConclusao) setPrazoSeguranca(format(prazos.dataConclusao, 'yyyy-MM-dd'));
    if (!prazoFatal && prazos.dataFatal) setPrazoFatal(format(prazos.dataFatal, 'yyyy-MM-dd'));
  }, [prazos.dataConclusao, prazos.dataFatal, prazoFatal, prazoSeguranca]);

  const handleAnalisar = async () => {
    setAnalisando(true);
    try {
      const { data, error } = await supabase.functions.invoke('intimacoes-analise', {
        body: {
          intimacao_id: intimacao.id,
          conteudo,
          tipo_intimacao: intimacao.tipo_intimacao,
          tribunal: intimacao.tribunal,
          processo_cnj: intimacao.processo_cnj,
          processo_titulo: intimacao.processo_titulo,
          data_publicacao: intimacao.data_publicacao,
          data_intimacao: intimacao.data_intimacao,
        },
      });
      if (error) throw error;
      if (data?.success) setAnalise(data.analise);
      else throw new Error(data?.error || 'Erro na análise');
    } catch (err: any) {
      toast.error('Erro ao analisar com ISA', { description: err.message });
    } finally {
      setAnalisando(false);
    }
  };

  const addCustomTarefa = () => {
    const title = novaTarefa.trim();
    if (!title) return;
    if (!allTarefas.includes(title)) setTarefasCustom(prev => [...prev, title]);
    setSelectedTarefaTipo(title);
    setNovaTarefa('');
  };

  const handleCreateRelatedTask = async () => {
    if (!selectedTarefaTipo) { toast.error('Selecione ou cadastre o tipo da tarefa'); return; }
    if (!responsavelId) { toast.error('Selecione o responsável pela tarefa'); return; }
    if (!prazoSeguranca || !prazoFatal) { toast.error('Informe o prazo de segurança e o prazo fatal'); return; }
    setSavingTarefa(true);
    try {
      const prazoFat = parseISO(prazoFatal);
      const prioridade = isValid(prazoFat) && Math.ceil((prazoFat.getTime() - Date.now()) / 86400000) <= 3 ? 'Urgente' : 'Alta';
      const processoNumero = linkedProcesso?.numero || intimacao.processo_cnj || 'sem numero';
      const descriptionParts = [
        `Tarefa criada a partir da intimacao ${intimacao.tipo_intimacao || ''}`.trim(),
        `Processo: ${processoNumero}`,
        intimacao.tribunal ? `Tribunal: ${intimacao.tribunal}` : '',
        comentario ? `Comentario: ${comentario}` : '',
        horarioTarefa ? `Horário: ${horarioTarefa}` : '',
        conteudo ? `Resumo da publicacao: ${conteudo.slice(0, 700)}` : '',
      ].filter(Boolean);
      const { data, error } = await supabase.from('tarefas').insert({
        titulo: selectedTarefaTipo, descricao: descriptionParts.join('\n\n'),
        responsavel_id: responsavelId, processo_id: linkedProcesso?.id || null, cliente_id: linkedClienteId,
        intimacao_id: intimacao.id,
        prioridade, status: 'Pendente', data_limite: prazoFatal, prazo_seguranca: prazoSeguranca,
        prazo_fatal: prazoFatal, horario: horarioTarefa || null, data_conclusao: null,
        entrega_texto: null, entrega_anexo_url: null, entregue_em: null, aprovacao_status: null,
        aprovacao_nota: null, aprovacao_feedback: null, aprovado_por: null, aprovado_em: null,
      }).select('id').single();
      if (error) throw error;
      await supabase.from('notificacoes_internas' as any).insert({
        user_id: responsavelId, titulo: 'Nova tarefa atribuída',
        mensagem: `${selectedTarefaTipo} - prazo fatal ${format(prazoFat, 'dd/MM/yyyy')}${horarioTarefa ? ` às ${horarioTarefa}` : ''}`,
        tipo: prioridade === 'Urgente' ? 'alerta' : 'info', lida: false, link: '/tarefas',
        dados: { source: 'intimacoes', intimacao_id: intimacao.id, tarefa_id: data?.id, prazo_seguranca: prazoSeguranca, prazo_fatal: prazoFatal, horario: horarioTarefa || null },
      } as any);
      setTarefasAdicionadas(prev => prev.includes(selectedTarefaTipo) ? prev : [...prev, selectedTarefaTipo]);
      setSelectedTarefaTipo(''); setHorarioTarefa(''); setTarefaModalOpen(false);
      toast.success('Tarefa criada e atribuída ao responsável');
    } catch (err: any) {
      toast.error('Erro ao criar tarefa', { description: err.message });
    } finally { setSavingTarefa(false); }
  };

  const handleAprovarTudo = async () => {
    if (!analise) return;
    const responsavel = responsavelId || currentUser?.id;
    if (!responsavel) { toast.error('Selecione um responsável em "Criar tarefa" primeiro'); return; }
    setAprovandoTudo(true);
    try {
      let criadas = 0;
      for (const acao of analise.acoes) {
        if (tarefasAdicionadas.includes(acao.titulo)) continue;
        const fatal = acao.prazo_dias != null ? addBusinessDays(new Date(), acao.prazo_dias) : (prazos.dataFatal || addBusinessDays(new Date(), 15));
        const fatalStr = format(fatal, 'yyyy-MM-dd');
        const prioridade = acao.prioridade === 'Urgente' ? 'Urgente' : acao.prioridade === 'Alta' ? 'Alta' : 'Media';
        const descriptionParts = [
          `Ação sugerida pela análise ISA: ${acao.titulo}`,
          acao.descricao,
          `Processo: ${linkedProcesso?.numero || intimacao.processo_cnj || 'sem número'}`,
          intimacao.tribunal ? `Tribunal: ${intimacao.tribunal}` : '',
        ].filter(Boolean);
        const { data, error } = await supabase.from('tarefas').insert({
          titulo: acao.titulo, descricao: descriptionParts.join('\n\n'),
          responsavel_id: responsavel, processo_id: linkedProcesso?.id || null, cliente_id: linkedClienteId,
          intimacao_id: intimacao.id,
          prioridade, status: 'Pendente', data_limite: fatalStr, prazo_seguranca: fatalStr, prazo_fatal: fatalStr,
          horario: null, data_conclusao: null, entrega_texto: null, entrega_anexo_url: null, entregue_em: null,
          aprovacao_status: null, aprovacao_nota: null, aprovacao_feedback: null, aprovado_por: null, aprovado_em: null,
        }).select('id').single();
        if (!error) {
          criadas++;
          setTarefasAdicionadas(prev => [...prev, acao.titulo]);
          await supabase.from('notificacoes_internas' as any).insert({
            user_id: responsavel, titulo: 'Nova tarefa atribuída',
            mensagem: `${acao.titulo} - prazo fatal ${format(fatal, 'dd/MM/yyyy')}`,
            tipo: prioridade === 'Urgente' ? 'alerta' : 'info', lida: false, link: '/tarefas',
            dados: { source: 'intimacoes', intimacao_id: intimacao.id, tarefa_id: data?.id },
          } as any);
        }
      }
      if (criadas > 0) toast.success(`${criadas} tarefa(s) criada(s)`);
      else toast.info('Todas as ações já tinham tarefa criada');
    } catch (err: any) {
      toast.error('Erro ao aprovar ações', { description: err.message });
    } finally {
      setAprovandoTudo(false);
    }
  };

  return (
    <>
      {/* HEADER */}
      <div className="relative shrink-0 border-b border-border/50 bg-card rounded-t-2xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${tc.avatarFrom}, ${tc.avatarTo})` }} />
        <div className="px-6 pt-5 pb-4">
          <div className="pr-8">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${tc.badge}`}>{intimacao.tipo_intimacao || 'Publicação'}</span>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${intimacao.lida ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40'}`}>
                {intimacao.lida ? 'Lida' : 'Pendente'}
              </span>
              {intimacao.tribunal && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/50">{intimacao.tribunal}</span>
              )}
            </div>
            <h2 className="text-base font-bold text-foreground leading-snug line-clamp-2">
              {intimacao.processo_titulo || intimacao.tipo_intimacao || 'Publicação'}
            </h2>
            {intimacao.processo_cnj && (
              <button onClick={() => void copyTextToClipboard(intimacao.processo_cnj)} className="mt-1 inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors group">
                <span>{intimacao.processo_cnj}</span>
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {!intimacao.lida && (
              <Button size="sm" className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm" onClick={onMarkRead}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como lida
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5" onClick={onGenerateReport}>
              <FileText className="h-3.5 w-3.5" /> Relatório PDF
            </Button>
            {intimacao.processo_cnj && (
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5" onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}>
                <Copy className="h-3.5 w-3.5" /> Copiar nº
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* BODY: two columns */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT: Content + sections */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Publication text */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Publicação</p>
            <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {displayContent}{conteudo.length > 800 && !showFullContent && '...'}
              </p>
            </div>
            {conteudo.length > 800 && (
              <button onClick={() => setShowFullContent(!showFullContent)} className="text-xs text-primary font-bold mt-2 hover:underline">
                {showFullContent ? '▲ Recolher' : '▼ Ver publicação completa'}
              </button>
            )}
          </div>

          {/* ISA Analysis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Análise ISA</p>
              {!analise && (
                <Button size="sm" className="h-7 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white gap-1.5 shadow-sm" onClick={handleAnalisar} disabled={analisando}>
                  {analisando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {analisando ? 'Analisando...' : 'Analisar com ISA'}
                </Button>
              )}
              {analise && (
                <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1.5" onClick={handleAnalisar} disabled={analisando}>
                  {analisando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {analisando ? 'Refinando...' : 'Refinar análise'}
                </Button>
              )}
            </div>

            {!analise && !analisando && (
              <div className="bg-muted/20 rounded-xl border border-border/40 border-dashed px-4 py-5 text-center">
                <Sparkles className="h-6 w-6 text-violet-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Clique em <span className="font-semibold text-violet-500">Analisar com ISA</span> para obter um resumo inteligente desta intimação, recomendações e ações sugeridas.</p>
              </div>
            )}

            {analisando && (
              <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200 dark:border-violet-800/40 px-4 py-6 text-center">
                <Loader2 className="h-6 w-6 text-violet-500 mx-auto mb-2 animate-spin" />
                <p className="text-sm font-medium text-violet-700 dark:text-violet-300">ISA está analisando a intimação...</p>
                <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">Isso pode levar alguns segundos</p>
              </div>
            )}

            {analise && (
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-xl border border-border/40 p-4 space-y-3">
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">O que aconteceu</p>
                    <p className="text-sm text-foreground leading-relaxed">{analise.resumo}</p>
                  </div>
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">O que fazer</p>
                    <p className="text-sm text-foreground leading-relaxed">{analise.recomendacao}</p>
                  </div>
                </div>

                {analise.acoes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Ações sugeridas</p>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-lg px-2 gap-1" disabled={aprovandoTudo || !responsavelId}
                        title={!responsavelId ? 'Selecione um responsável em "Criar tarefa" primeiro' : undefined}
                        onClick={handleAprovarTudo}>
                        {aprovandoTudo ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Aprovar tudo
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {analise.acoes.map((acao: { titulo: string; descricao: string; prazo_dias: number | null; prioridade: string }, i: number) => {
                        const prioColor =
                          acao.prioridade === 'Urgente' ? 'border-rose-300 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20' :
                          acao.prioridade === 'Alta' ? 'border-amber-300 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20' :
                          'border-border/50 bg-muted/20';
                        const prioBadge =
                          acao.prioridade === 'Urgente' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                          acao.prioridade === 'Alta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-muted text-muted-foreground';
                        return (
                          <div key={i} className={`rounded-xl border p-3 ${prioColor}`}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-foreground leading-tight">{acao.titulo}</p>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${prioBadge}`}>{acao.prioridade}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{acao.descricao}</p>
                            <div className="flex items-center justify-between">
                              {acao.prazo_dias !== null && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Timer className="h-3 w-3" />{acao.prazo_dias} dias úteis
                                </span>
                              )}
                              <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-lg px-2 ml-auto"
                                onClick={() => { setSelectedTarefaTipo(acao.titulo); setTarefaModalOpen(true); }}>
                                + Criar tarefa
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prazos */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Prazos</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Data Base', value: fmt(prazos.dataBase), accent: false },
                { label: 'Conclusão', value: fmt(prazos.dataConclusao), accent: false },
                { label: 'Data Fatal', value: fmt(prazos.dataFatal), accent: true },
              ].map(item => (
                <div key={item.label} className={`p-3 rounded-xl border ${item.accent ? 'border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20' : 'border-border/50 bg-muted/20'}`}>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">{item.label}</p>
                  <p className={`text-sm font-bold ${item.accent ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tarefas */}
          <CollapsibleSection icon={ClipboardList} title="Tarefas relacionadas"
            actions={<Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={e => { e.stopPropagation(); setTarefaModalOpen(true); }}>Adicionar</Button>}
          >
            {tarefasAdicionadas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tarefasAdicionadas.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-rose-100 hover:text-rose-700 transition-colors rounded-lg" onClick={() => setTarefasAdicionadas(p => p.filter(x => x !== t))}>
                    {t} <span className="opacity-50">✕</span>
                  </Badge>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma tarefa relacionada.</p>}
          </CollapsibleSection>

          {/* Documentos */}
          <CollapsibleSection icon={FileText} title="Documentos"
            actions={<Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={e => { e.stopPropagation(); setDocumentoModalOpen(true); }}>Adicionar</Button>}
          >
            <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
          </CollapsibleSection>

          {/* Comentários */}
          <CollapsibleSection icon={MessageSquare} title="Comentários" defaultOpen>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-right">{2000 - comentario.length} caracteres restantes</p>
              <Textarea placeholder="Observações sobre esta intimação..." value={comentario} onChange={e => setComentario(e.target.value)} className="resize-none rounded-xl" rows={3} maxLength={2000} />
            </div>
          </CollapsibleSection>

          {/* Auditoria */}
          <CollapsibleSection icon={Clock} title="Auditoria">
            <div className="text-sm text-muted-foreground space-y-1.5">
              <p>Recebido em: <span className="text-foreground font-semibold">{formatDateLong(intimacao.created_at)}</span></p>
              {intimacao.lida_em && <p>Lida em: <span className="text-foreground font-semibold">{formatDateLong(intimacao.lida_em)}</span></p>}
              <p>OAB: <span className="text-foreground font-semibold">{intimacao.oab_numero}/{intimacao.oab_uf}</span></p>
            </div>
          </CollapsibleSection>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-72 shrink-0 border-l border-border/40 overflow-y-auto bg-muted/[0.03]">
          <div className="px-4 py-2">
            {/* Processo */}
            <SidebarField label="Processo">
              {linkedProcesso ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-mono font-bold text-primary">{linkedProcesso.numero}</p>
                    {linkedProcesso.numero && (
                      <button onClick={() => void copyTextToClipboard(linkedProcesso.numero)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    className="text-xs text-primary font-semibold hover:underline"
                    onClick={() => linkedProcesso.id && onVisualizarProcesso(linkedProcesso.id)}
                  >
                    Visualizar processo →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {intimacao.processo_cnj && !processoSearch && (
                    <p className="text-xs font-mono text-muted-foreground">{intimacao.processo_cnj}</p>
                  )}
                  <div className="relative">
                    <Input
                      placeholder="Buscar por cliente, nº ou CNJ..."
                      value={processoSearch}
                      onChange={e => searchProcessos((e.target as HTMLInputElement).value)}
                      className="h-8 text-xs rounded-lg"
                    />
                    {showDropdown && processoResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {processoResults.map(p => (
                          <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                            onClick={() => selecionarProcesso(p)}>
                            <p className="text-xs font-mono font-bold text-primary">{p.numero_processo || 'Sem número'}</p>
                            {(p.titulo_acao || p.nome_cliente) && <p className="text-[10px] text-muted-foreground line-clamp-1">{p.nome_cliente || p.titulo_acao}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Processo não cadastrado ainda?</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg w-full" onClick={handleCadastrarProcesso}>
                    + Cadastrar processo
                  </Button>
                </div>
              )}
            </SidebarField>

            {/* Campos abaixo só existem quando há um processo vinculado — dados
                reais puxados de processos.partes_json/area/assunto/advogado_responsavel,
                nunca inventados. */}
            {linkedProcesso && (
              <>
                <SidebarField label="Partes envolvidas">
                  {linkedProcesso.partes_json && linkedProcesso.partes_json.length > 0 ? (
                    <div className="space-y-2">
                      {linkedProcesso.partes_json.slice(0, 4).map((parte: any, idx: number) => (
                        <div key={idx}>
                          <p className="text-sm font-medium text-foreground leading-snug">{parte.nome}</p>
                          {parte.celular && (
                            <a href={`https://wa.me/55${parte.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5">
                              📱 {parte.celular}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </SidebarField>

                <SidebarField label="Grupo de ação">
                  <span className="text-sm text-foreground">{linkedProcesso.area || '—'}</span>
                </SidebarField>

                <SidebarField label="Tipo de ação">
                  <span className="text-sm text-foreground">{linkedProcesso.assunto || '—'}</span>
                </SidebarField>

                <SidebarField label="Responsável pelo processo">
                  <span className="text-sm text-foreground">
                    {linkedProcesso.advogado_responsavel ? linkedProcesso.advogado_responsavel.replace(/\s*\(OAB.*\)/i, '') : '—'}
                  </span>
                </SidebarField>

                <div className="py-3">
                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg w-full gap-1.5 text-muted-foreground" onClick={desvincularProcesso}>
                    <X className="h-3.5 w-3.5" /> Desvincular processo
                  </Button>
                </div>
              </>
            )}

            {/* Responsável (da intimação — quem na equipe está acompanhando esta publicação) */}
            <SidebarField label="Responsável pela intimação">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: `linear-gradient(135deg, ${tc.avatarFrom}, ${tc.avatarTo})` }}>
                  {(advogadoIntimacao?.nome || intimacao.oab_numero || 'U')[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium text-foreground">
                  {advogadoIntimacao ? getMemberName(advogadoIntimacao) : `OAB/${intimacao.oab_uf} ${intimacao.oab_numero}`}
                </span>
              </div>
            </SidebarField>

            {/* Situação */}
            <SidebarField label="Situação">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${intimacao.lida ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                {intimacao.lida ? 'Lida' : 'Pendente (1)'}
              </span>
            </SidebarField>

            {/* Data de entrega */}
            <SidebarField label="Data de entrega">
              {intimacao.data_intimacao ? (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span className={`text-sm font-semibold ${new Date(intimacao.data_intimacao) < new Date() && !intimacao.lida ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                    {format(parseISO(intimacao.data_intimacao), "EEE, dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              ) : <span className="text-sm text-muted-foreground">—</span>}
            </SidebarField>

            {/* Página */}
            {pagina !== null && pagina !== undefined && (
              <SidebarField label="Página">
                <span className="text-sm text-foreground font-medium">{String(pagina)}</span>
              </SidebarField>
            )}

            {/* Nome pesquisado */}
            <SidebarField label="Nome pesquisado">
              <span className="text-sm text-foreground">{nomePesquisado}</span>
            </SidebarField>

            {/* Data da publicação */}
            <SidebarField label="Data da publicação">
              {intimacao.data_publicacao ? (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{formatDate(intimacao.data_publicacao)}</span>
                </div>
              ) : <span className="text-sm text-muted-foreground">—</span>}
            </SidebarField>

            {/* Criado por */}
            <SidebarField label="Criado por">
              <div>
                <p className="text-sm text-foreground font-medium leading-snug">{fonteDisplay}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(createdAt, "dd/MM/yyyy HH:mm")} ({createdAgoText})
                </p>
              </div>
            </SidebarField>
          </div>
        </div>
      </div>

      <DocumentoUploadModal open={documentoModalOpen} onOpenChange={setDocumentoModalOpen} processoId={linkedProcesso?.id} />

      <Dialog open={tarefaModalOpen} onOpenChange={setTarefaModalOpen}>
        <DialogContent className="sm:max-w-xl p-0 rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <DialogTitle className="text-base font-semibold">Adicionar tarefa relacionada</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between rounded-lg">
                  {selectedTarefaTipo || 'Selecione o tipo de tarefa'}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar tarefa..." />
                  <CommandEmpty>Nenhuma tarefa encontrada.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {allTarefas.map(t => (
                        <CommandItem key={t} value={t} onSelect={() => setSelectedTarefaTipo(t)}>{t}</CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex gap-2 border-t border-border/50 pt-3">
              <Input placeholder="Cadastrar nova tarefa..." value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTarefa(); } }} className="h-9 rounded-lg" />
              <Button size="sm" variant="secondary" className="h-9 rounded-lg" onClick={addCustomTarefa}>Cadastrar</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/50 pt-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prazo de seguranca</p>
                <Input type="date" value={prazoSeguranca} onChange={e => setPrazoSeguranca(e.target.value)} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prazo fatal</p>
                <Input type="date" value={prazoFatal} onChange={e => setPrazoFatal(e.target.value)} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Horario</p>
                <Input type="time" value={horarioTarefa} onChange={e => setHorarioTarefa(e.target.value)} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Responsavel pela tarefa</p>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Selecione o responsavel" /></SelectTrigger>
                <SelectContent>
                  {members.map(member => (<SelectItem key={member.id} value={member.id}>{getMemberName(member)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="h-9 rounded-lg" onClick={() => setTarefaModalOpen(false)}>Cancelar</Button>
              <Button className="h-9 rounded-lg" disabled={savingTarefa} onClick={handleCreateRelatedTask}>
                {savingTarefa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar tarefa relacionada
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3.5 border-b border-border/30 last:border-0">
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function CollapsibleSection({ icon: Icon, title, actions, children }: {
  icon: React.ElementType; title: string; defaultOpen?: boolean; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/30 bg-muted/15 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{title}</span>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </div>
  );
}