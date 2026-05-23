import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { usePerfil } from '@/hooks/usePerfil';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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

interface TeamMember {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  email: string | null;
}

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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    const s = localStorage.getItem('intimacoes-last-sync');
    return s ? new Date(s) : null;
  });
  const [tick, setTick] = useState(0);

  const oabNumero = officeSettings?.oab_number || (perfil as any)?.oab_numero || '';
  const oabUf = officeSettings?.oab_state || (perfil as any)?.oab_uf || 'AM';

  useEffect(() => { if (user) fetchIntimacoes(); }, [user]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 60000); return () => clearInterval(t); }, []);

  const fetchIntimacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('intimacoes').select('*').order('data_intimacao', { ascending: false });
    if (error) console.error(error); else setIntimacoes((data as any[]) || []);
    setLoading(false);
  };

  const handleSync = async () => {
    if (!oabNumero) { toast.error('Configure seu número da OAB no perfil'); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('intimacoes-oab', { body: { oab_numero: oabNumero, oab_uf: oabUf, advogado_id: user?.id } });
      if (error) throw error;
      const syncedAt = new Date();
      setLastSyncAt(syncedAt);
      localStorage.setItem('intimacoes-last-sync', syncedAt.toISOString());
      if (data?.success) {
        const saved: number = data.saved ?? 0;
        const updated: number = data.updated ?? 0;
        if (saved > 0) {
          toast.success(`${saved} nova(s) intimação(ões) encontrada(s)`, { description: updated > 0 ? `${updated} atualizada(s)` : undefined });
        } else {
          toast.success('Sincronização concluída', { description: updated > 0 ? `${updated} intimação(ões) atualizada(s)` : 'Nenhuma novidade no momento.' });
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
  const todayCount = intimacoes.filter(i => new Date(i.created_at) >= todayStart).length;
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
    if (filterLida === 'today') return ok && new Date(i.created_at) >= todayStart;
    return ok;
  });

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
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Sincronização automática: 08h e 14h · Escavador / Diários Oficiais</span>
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

            {/* CARDS com agrupamento por data */}
            {(() => {
              const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
              const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
              const getGroup = (i: Intimacao) => {
                const d = new Date(i.created_at);
                if (d >= todayStart) return 'Hoje';
                if (d >= yesterdayStart) return 'Ontem';
                if (d >= weekStart) return 'Esta semana';
                return 'Anteriores';
              };
              const groups: Record<string, Intimacao[]> = {};
              for (const i of filtered) { const g = getGroup(i); (groups[g] = groups[g] || []).push(i); }
              const order = ['Hoje', 'Ontem', 'Esta semana', 'Anteriores'];
              return order.filter(g => groups[g]?.length).map(group => (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                    <div className={`h-2 w-2 rounded-full ${group === 'Hoje' ? 'bg-violet-500 animate-pulse' : group === 'Ontem' ? 'bg-blue-400' : 'bg-muted-foreground/40'}`} />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{group}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{groups[group].length}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  {groups[group].map(intimacao => {
              const urgency = getUrgencyInfo(intimacao);
              const tc = getTypeConfig(intimacao.tipo_intimacao);
              const isExpanded = expandedCards.has(intimacao.id);
              const contentText = intimacao.conteudo || 'Sem conteúdo detalhado';
              const isLong = contentText.length > 160;
              const isSelected = selectedIds.has(intimacao.id);
              const isUnread = !intimacao.lida;

              return (
                <div
                  key={intimacao.id}
                  onClick={() => { setSelectedIntimacao(intimacao); if (isUnread) handleMarkRead(intimacao.id); }}
                  className={`group relative flex rounded-2xl cursor-pointer overflow-hidden border transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg
                    ${isSelected
                      ? 'border-primary/40 bg-primary/[0.03] shadow-md shadow-primary/10'
                      : isUnread
                      ? 'border-border/60 hover:border-border hover:shadow-md'
                      : 'border-border/40 bg-card hover:border-border/70'
                    }`}
                  style={isUnread ? { backgroundColor: tc.cardUnread } : undefined}
                >
                  {/* Left accent bar using inline style for reliable color */}
                  <div
                    className={`w-1.5 shrink-0 rounded-l-2xl transition-opacity duration-200 ${isUnread ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}
                    style={{ background: `linear-gradient(to bottom, ${tc.avatarFrom}, ${tc.avatarTo})` }}
                  />

                  <div className="flex-1 px-4 py-4 min-w-0">
                    <div className="flex items-start gap-3.5">
                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(intimacao.id)} />
                      </div>

                      {/* Avatar */}
                      <div
                        className="shrink-0 h-11 w-11 rounded-xl flex items-center justify-center shadow-md text-white font-black text-lg leading-none"
                        style={{ background: `linear-gradient(135deg, ${tc.avatarFrom}, ${tc.avatarTo})` }}
                      >
                        {(intimacao.tipo_intimacao || 'P')[0].toUpperCase()}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isUnread && <span className={`h-2 w-2 rounded-full ${tc.dot} animate-pulse shrink-0`} />}
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${tc.badge}`}>
                            {intimacao.tipo_intimacao || 'Publicação'}
                          </span>
                          {intimacao.tribunal && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-border/50 bg-muted/60 text-muted-foreground">
                              {intimacao.tribunal}
                            </span>
                          )}
                          {(urgency.level === 'urgent' || urgency.level === 'overdue') && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5" /> {urgency.label}
                            </span>
                          )}
                          {urgency.level === 'warning' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/60">
                              <Timer className="h-2.5 w-2.5" /> {urgency.label}
                            </span>
                          )}
                          {urgency.level === 'safe' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border border-emerald-200/50">
                              <Clock className="h-2.5 w-2.5" /> {urgency.label}
                            </span>
                          )}
                        </div>

                        {/* CNJ + título */}
                        <div>
                          <p className={`text-sm font-bold font-mono leading-snug ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                            {intimacao.processo_cnj || 'Sem CNJ'}
                          </p>
                          {intimacao.processo_titulo && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{intimacao.processo_titulo}</p>
                          )}
                        </div>

                        {/* Conteúdo */}
                        <p className={`text-xs leading-relaxed text-muted-foreground/80 ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {contentText}
                        </p>
                        {isLong && (
                          <button onClick={e => { e.stopPropagation(); setExpandedCards(prev => { const n = new Set(prev); n.has(intimacao.id) ? n.delete(intimacao.id) : n.add(intimacao.id); return n; }); }} className="text-[11px] text-primary font-semibold hover:underline">
                            {isExpanded ? '▲ Recolher' : '▼ Ver mais'}
                          </button>
                        )}

                        {/* Dates */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {intimacao.data_disponibilizacao && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg border border-border/30">
                              <CalendarDays className="h-2.5 w-2.5 shrink-0" style={{ color: tc.bar }} />
                              Disponib.: <b className="text-foreground/80 ml-0.5">{formatDate(intimacao.data_disponibilizacao)}</b>
                            </span>
                          )}
                          {intimacao.data_publicacao && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg border border-border/30">
                              <CalendarDays className="h-2.5 w-2.5 shrink-0" style={{ color: tc.bar }} />
                              Publicação: <b className="text-foreground/80 ml-0.5">{formatDate(intimacao.data_publicacao)}</b>
                            </span>
                          )}
                          {intimacao.data_intimacao && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg border border-border/30">
                              <CalendarDays className="h-2.5 w-2.5 shrink-0" style={{ color: tc.bar }} />
                              Intimação: <b className="text-foreground/80 ml-0.5">{formatDate(intimacao.data_intimacao)}</b>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex flex-col items-center gap-1 shrink-0 self-start pt-0.5">
                        <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all" onClick={e => handleToggleRead(intimacao.id, intimacao.lida, e)} title={intimacao.lida ? 'Marcar como não lida' : 'Marcar como lida'}>
                          {intimacao.lida ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        </button>
                        {intimacao.processo_cnj && (
                          <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all" onClick={e => { e.stopPropagation(); void copyTextToClipboard(intimacao.processo_cnj); }} title="Copiar CNJ">
                            <Copy className="h-3.5 w-3.5 text-blue-600" />
                          </button>
                        )}
                        <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all" onClick={e => handleGenerateReport(intimacao, e)} title="Relatório">
                          <FileText className="h-3.5 w-3.5 text-purple-600" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/25 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200 mt-1" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/70 bg-background shadow-2xl">
          {selectedIntimacao && (
            <IntimacaoDetailModal
              intimacao={selectedIntimacao}
              formatDate={formatDate}
              formatDateLong={formatDateLong}
              calcularPrazos={calcularPrazos}
              onMarkRead={() => { handleMarkRead(selectedIntimacao.id); setSelectedIntimacao({ ...selectedIntimacao, lida: true }); }}
              onGenerateReport={() => handleGenerateReport(selectedIntimacao)}
              onClose={() => setSelectedIntimacao(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function IntimacaoDetailModal({ intimacao, formatDate, formatDateLong, calcularPrazos, onMarkRead, onGenerateReport, onClose }: {
  intimacao: Intimacao; formatDate: (d: string | null) => string | null; formatDateLong: (d: string | null) => string;
  calcularPrazos: (i: Intimacao) => { dataBase: Date | null; dataConclusao: Date | null; dataFatal: Date | null };
  onMarkRead: () => void; onGenerateReport: () => void; onClose: () => void;
}) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [comentario, setComentario] = useState('');
  const [processoSearch, setProcessoSearch] = useState('');
  const [processoResults, setProcessoResults] = useState<any[]>([]);
  const [linkedProcesso, setLinkedProcesso] = useState<{ id: string; numero: string; titulo: string } | null>(null);
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

  const TAREFAS = ['Manifestação','Recurso de Apelação','Recurso Especial','Recurso Extraordinário','Recurso Ordinário','Recurso Inominado','Embargos de Declaração','Contrarrazões','Alegações Finais','Memoriais','Agravo de Instrumento','Agravo Interno','Sentença','Acórdão','Sessão de Julgamento','Réplica','Perícia'];
  const allTarefas = [...TAREFAS, ...tarefasCustom];
  const tc = getTypeConfig(intimacao.tipo_intimacao);
  const prazos = calcularPrazos(intimacao);
  const fmt = (d: Date | null) => d ? format(d, 'dd/MM/yyyy') : '—';
  const conteudo = intimacao.conteudo || '';
  const displayContent = showFullContent ? conteudo : conteudo.slice(0, 400);

  const searchProcessos = async (term: string) => {
    setProcessoSearch(term);
    if (term.length < 2) { setProcessoResults([]); setShowDropdown(false); return; }
    const { data } = await supabase.from('processos').select('id,numero_processo,titulo_acao').or(`numero_processo.ilike.%${term}%,titulo_acao.ilike.%${term}%`).limit(8);
    setProcessoResults((data as any[]) || []); setShowDropdown(true);
  };

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('perfis')
        .select('id, nome, sobrenome, email')
        .eq('aprovado', true)
        .order('nome', { ascending: true });
      setMembers((data as TeamMember[]) || []);
    };
    void fetchMembers();
  }, []);

  useEffect(() => {
    if (!prazoSeguranca && prazos.dataConclusao) setPrazoSeguranca(format(prazos.dataConclusao, 'yyyy-MM-dd'));
    if (!prazoFatal && prazos.dataFatal) setPrazoFatal(format(prazos.dataFatal, 'yyyy-MM-dd'));
  }, [prazos.dataConclusao, prazos.dataFatal, prazoFatal, prazoSeguranca]);

  const getMemberName = (member: TeamMember) => {
    const name = [member.nome, member.sobrenome].filter(Boolean).join(' ');
    return name || member.email || 'Usuario';
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

      const { data, error } = await supabase
        .from('tarefas')
        .insert({
          titulo: selectedTarefaTipo,
          descricao: descriptionParts.join('\n\n'),
          responsavel_id: responsavelId,
          processo_id: linkedProcesso?.id || null,
          cliente_id: null,
          prioridade,
          status: 'Pendente',
          data_limite: prazoFatal,
          prazo_seguranca: prazoSeguranca,
          prazo_fatal: prazoFatal,
          horario: horarioTarefa || null,
          data_conclusao: null,
          entrega_texto: null,
          entrega_anexo_url: null,
          entregue_em: null,
          aprovacao_status: null,
          aprovacao_nota: null,
          aprovacao_feedback: null,
          aprovado_por: null,
          aprovado_em: null,
        })
        .select('id')
        .single();
      if (error) throw error;

      await supabase.from('notificacoes_internas' as any).insert({
        user_id: responsavelId,
        titulo: 'Nova tarefa atribuída',
        mensagem: `${selectedTarefaTipo} - prazo fatal ${format(prazoFat, 'dd/MM/yyyy')}${horarioTarefa ? ` às ${horarioTarefa}` : ''}`,
        tipo: prioridade === 'Urgente' ? 'alerta' : 'info',
        lida: false,
        link: '/tarefas',
        dados: {
          source: 'intimacoes',
          intimacao_id: intimacao.id,
          tarefa_id: data?.id,
          prazo_seguranca: prazoSeguranca,
          prazo_fatal: prazoFatal,
          horario: horarioTarefa || null,
        },
      } as any);

      setTarefasAdicionadas(prev => prev.includes(selectedTarefaTipo) ? prev : [...prev, selectedTarefaTipo]);
      setSelectedTarefaTipo('');
      setHorarioTarefa('');
      setTarefaModalOpen(false);
      toast.success('Tarefa criada e atribuída ao responsável');
    } catch (err: any) {
      toast.error('Erro ao criar tarefa', { description: err.message });
    } finally {
      setSavingTarefa(false);
    }
  };
  return (
    <>
      <div className="relative overflow-hidden rounded-t-2xl border-b border-border/50 bg-card">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${tc.avatarFrom}, ${tc.avatarTo})` }} />
        <div className="px-7 pb-5 pt-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              {intimacao.tipo_intimacao || 'Publicação'}
            </span>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${intimacao.lida ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {intimacao.lida ? 'Lida' : 'Não lida'}
            </span>
          </div>

          <div className="space-y-3 pr-8">
            <h2 className="text-xl font-bold leading-snug text-foreground">
              {intimacao.processo_titulo || intimacao.tipo_intimacao || 'Publicação'}
            </h2>
            {intimacao.processo_cnj && (
              <button
                type="button"
                onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-muted/35 px-3 py-2 text-left transition-colors hover:bg-muted/60"
              >
                <span className="truncate font-mono text-sm font-bold text-foreground">{intimacao.processo_cnj}</span>
                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 bg-muted/15 px-6 py-3">
        {!intimacao.lida && (
          <Button size="sm" className="h-8 rounded-lg bg-emerald-600 text-xs text-white shadow-sm hover:bg-emerald-700" onClick={onMarkRead}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Marcar como lida
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={onGenerateReport}>
          <FileText className="mr-1.5 h-3.5 w-3.5" /> Relatório PDF
        </Button>
        {intimacao.processo_cnj && (
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar nº
          </Button>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Vincular processo */}
        <div className="border-2 border-primary/15 rounded-xl p-4 bg-primary/[0.02] space-y-3">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Vincular a processo existente</p>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquise por nº ou título" value={processoSearch} onChange={e => searchProcessos(e.target.value)} className="pl-10 text-sm rounded-lg" />
              {showDropdown && processoResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {processoResults.map(p => (
                    <button key={p.id} className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                      onClick={() => { setLinkedProcesso({ id: p.id, numero: p.numero_processo || '', titulo: p.titulo_acao || '' }); setProcessoSearch(p.numero_processo || ''); setShowDropdown(false); }}>
                      <p className="text-sm font-mono font-bold text-primary">{p.numero_processo || 'Sem número'}</p>
                      {p.titulo_acao && <p className="text-xs text-muted-foreground">{p.titulo_acao}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-10 px-4 rounded-lg" disabled={!linkedProcesso} onClick={() => { if (linkedProcesso) toast.success('Processo vinculado!'); }}>Vincular</Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg"><Scale className="h-3.5 w-3.5" /> Cadastrar processo</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg"><Gavel className="h-3.5 w-3.5" /> Cadastrar com IA</Button>
          </div>
        </div>

        {/* Processo vinculado */}
        <div className="border border-border/50 rounded-xl p-4 bg-muted/10">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Processo vinculado</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-primary">{linkedProcesso?.numero || intimacao.processo_cnj || 'Não identificado'}</span>
            {(linkedProcesso || intimacao.processo_cnj) && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          {(linkedProcesso?.titulo || intimacao.processo_titulo) && <p className="text-xs text-muted-foreground mt-1">{linkedProcesso?.titulo || intimacao.processo_titulo}</p>}
          {intimacao.tribunal && <p className="text-xs text-muted-foreground mt-1">Tribunal: <span className="font-semibold text-foreground">{intimacao.tribunal}</span></p>}
        </div>

        {/* Detalhes */}
        <div>
          <p className="text-xs font-black text-foreground mb-4 uppercase tracking-widest">Detalhes da Intimação</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Tipo</p><p className="text-sm text-foreground font-semibold">{intimacao.tipo_intimacao || '—'}</p></div>
              <div><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Fonte</p><p className="text-sm text-foreground font-semibold">Escavador / Diário Oficial</p></div>
            </div>
            {/* Prazos */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Data Base', value: fmt(prazos.dataBase), accent: false },
                { label: 'Conclusão Prevista', value: fmt(prazos.dataConclusao), accent: false },
                { label: 'Data Fatal', value: fmt(prazos.dataFatal), accent: true },
              ].map(item => (
                <div key={item.label} className={`p-3 rounded-xl border ${item.accent ? 'border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20' : 'border-border/50 bg-muted/20'}`}>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">{item.label}</p>
                  <p className={`text-sm font-bold ${item.accent ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {/* Datas originais */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Disponibilização', value: formatDate(intimacao.data_disponibilizacao) || '—' },
                { label: 'Publicação', value: formatDate(intimacao.data_publicacao) || '—' },
                { label: 'Intimação', value: formatDate(intimacao.data_intimacao) || '—' },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-sm text-foreground font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            {/* Descrição */}
            <div>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Descrição</p>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/40">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{displayContent}{conteudo.length > 400 && !showFullContent && '...'}</p>
              </div>
              {conteudo.length > 400 && (
                <button onClick={() => setShowFullContent(!showFullContent)} className="text-xs text-primary font-bold mt-2 hover:underline">
                  {showFullContent ? '▲ Recolher' : '▼ Expandir conteúdo completo'}
                </button>
              )}
            </div>
          </div>
        </div>

        <CollapsibleSection icon={Clock} title="Auditoria">
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>Recebido em: <span className="text-foreground font-semibold">{formatDateLong(intimacao.created_at)}</span></p>
            {intimacao.lida_em && <p>Lida em: <span className="text-foreground font-semibold">{formatDateLong(intimacao.lida_em)}</span></p>}
            <p>OAB: <span className="text-foreground font-semibold">{intimacao.oab_numero}/{intimacao.oab_uf}</span></p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection icon={FileText} title="Documentos" actions={<Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={e => { e.stopPropagation(); setDocumentoModalOpen(true); }}>Adicionar</Button>}>
          <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
        </CollapsibleSection>

        <CollapsibleSection icon={ClipboardList} title="Tarefas relacionadas"
          actions={<Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={e => { e.stopPropagation(); setTarefaModalOpen(true); }}>Adicionar</Button>}
        >
          <div className="space-y-3">
            {tarefasAdicionadas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tarefasAdicionadas.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-rose-100 hover:text-rose-700 transition-colors rounded-lg" onClick={() => setTarefasAdicionadas(p => p.filter(x => x !== t))}>
                    {t} <span className="opacity-50">✕</span>
                  </Badge>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma tarefa relacionada.</p>}
          </div>
        </CollapsibleSection>

        <CollapsibleSection icon={MessageSquare} title="Comentários" defaultOpen>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-right">{2000 - comentario.length} caracteres restantes</p>
            <Textarea placeholder="Utilize @ para citar outros usuários..." value={comentario} onChange={e => setComentario(e.target.value)} className="resize-none rounded-xl" rows={3} maxLength={2000} />
          </div>
        </CollapsibleSection>
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
                        <CommandItem key={t} value={t} onSelect={() => setSelectedTarefaTipo(t)}>
                          {t}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex gap-2 border-t border-border/50 pt-3">
              <Input
                placeholder="Cadastrar nova tarefa..."
                value={novaTarefa}
                onChange={e => setNovaTarefa(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTarefa();
                  }
                }}
                className="h-9 rounded-lg"
              />
              <Button size="sm" variant="secondary" className="h-9 rounded-lg" onClick={addCustomTarefa}>
                Cadastrar
              </Button>
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
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder="Selecione o responsavel" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>{getMemberName(member)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="h-9 rounded-lg" onClick={() => setTarefaModalOpen(false)}>
                Cancelar
              </Button>
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