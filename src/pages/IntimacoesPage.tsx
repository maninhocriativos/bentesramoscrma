import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { usePerfil } from '@/hooks/usePerfil';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Loader2, Gavel, Search, RefreshCw, Bell, CheckCircle2,
  Clock, AlertTriangle, Eye, FileText, Filter, CalendarDays,
  Scale, BookOpen, ChevronRight, ChevronDown, ChevronUp,
  MessageSquare, ClipboardList, Pencil, Copy, ExternalLink,
  Inbox, EyeOff, Timer, SearchCheck, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

import { format, parseISO, isValid, addDays, addBusinessDays, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateIntimacaoReport, generateBatchIntimacaoReport } from '@/lib/intimacaoReportGenerator';
import { Checkbox } from '@/components/ui/checkbox';

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
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    toast.success(`${label} copiado!`);
  } catch (error) {
    console.error('Erro ao copiar texto:', error);
    toast.error(`Não foi possível copiar ${label.toLowerCase()}`);
  }
}

export default function IntimacoesPage() {
  const { perfil } = usePerfil();
  const { settings: officeSettings } = useOfficeSettings();
  const { user } = useAuth();
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLida, setFilterLida] = useState<'all' | 'unread' | 'read' | 'urgent'>('all');
  const [selectedIntimacao, setSelectedIntimacao] = useState<Intimacao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const oabNumero = officeSettings?.oab_number || (perfil as any)?.oab_numero || '';
  const oabUf = officeSettings?.oab_state || (perfil as any)?.oab_uf || 'AM';

  useEffect(() => {
    if (user) fetchIntimacoes();
  }, [user]);

  const fetchIntimacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('intimacoes')
      .select('*')
      .order('data_intimacao', { ascending: false });
    if (error) console.error('Erro ao buscar intimações:', error);
    else setIntimacoes((data as any[]) || []);
    setLoading(false);
  };

  const handleSync = async () => {
    if (!oabNumero) {
      toast.error('Configure seu número da OAB no perfil para buscar intimações');
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('intimacoes-scheduler', {
        body: { oab_numero: oabNumero, oab_uf: oabUf, advogado_id: user?.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(
          data?.deduplicated ? 'Sincronização já estava em andamento' : 'Sincronização iniciada',
          { description: 'A busca foi colocada em fila e será processada automaticamente em segundo plano.' },
        );
        window.setTimeout(() => void fetchIntimacoes(), 4000);
      } else {
        toast.error(data?.error || 'Erro ao iniciar sincronização');
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar intimações', { description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await supabase
      .from('intimacoes')
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('id', id);
    setIntimacoes((prev) =>
      prev.map((i) => (i.id === id ? { ...i, lida: true, lida_em: new Date().toISOString() } : i))
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return dateStr;
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch { return dateStr; }
  };

  const formatDateLong = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return dateStr;
      return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR });
    } catch { return dateStr; }
  };

  const calcularPrazos = (intimacao: Intimacao) => {
    const baseDate = intimacao.data_publicacao || intimacao.data_intimacao || intimacao.data_disponibilizacao;
    if (!baseDate) return { dataBase: null, dataConclusao: null, dataFatal: null };
    const base = parseISO(baseDate);
    if (!isValid(base)) return { dataBase: base, dataConclusao: null, dataFatal: null };
    const tipo = (intimacao.tipo_intimacao || '').toLowerCase();
    let prazoUteis = 15;
    let prazoFatal = 20;
    if (tipo.includes('embargos')) { prazoUteis = 5; prazoFatal = 10; }
    else if (tipo.includes('manifestação') || tipo.includes('manifestacao')) { prazoUteis = 5; prazoFatal = 10; }
    else if (tipo.includes('ciência') || tipo.includes('ciencia')) { prazoUteis = 5; prazoFatal = 15; }
    else if (tipo.includes('sessão') || tipo.includes('sessao') || tipo.includes('julgamento')) { prazoUteis = 0; prazoFatal = 0; }
    else if (tipo.includes('pagamento')) { prazoUteis = 15; prazoFatal = 15; }
    const inicioContagem = addDays(base, 1);
    let startDate = inicioContagem;
    while (isWeekend(startDate)) startDate = addDays(startDate, 1);
    const dataConclusao = prazoUteis > 0 ? addBusinessDays(startDate, prazoUteis) : null;
    const dataFatal = prazoFatal > 0 ? addBusinessDays(startDate, prazoFatal) : null;
    return { dataBase: base, dataConclusao, dataFatal };
  };

  const handleGenerateReport = (intimacao: Intimacao, e?: React.MouseEvent) => {
    e?.stopPropagation();
    generateIntimacaoReport(intimacao);
    toast.success('Relatório gerado com sucesso');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(i => i.id)));
  };

  const handleBatchReport = () => {
    const items = filtered.filter(i => selectedIds.has(i.id));
    if (items.length === 0) { toast.error('Selecione ao menos uma intimação'); return; }
    generateBatchIntimacaoReport(items);
    toast.success(`Relatório em lote gerado (${items.length} intimações)`);
  };

  const handleReportAll = () => {
    generateBatchIntimacaoReport(filtered);
    toast.success(`Relatório gerado com todas as ${filtered.length} intimações`);
  };

  const getUrgencyInfo = (intimacao: Intimacao) => {
    const prazos = calcularPrazos(intimacao);
    if (!prazos.dataFatal) return { level: 'none' as const, daysLeft: null, label: '' };
    const now = new Date();
    const diff = Math.ceil((prazos.dataFatal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { level: 'overdue' as const, daysLeft: diff, label: `Vencido há ${Math.abs(diff)} dias` };
    if (diff <= 7) return { level: 'urgent' as const, daysLeft: diff, label: diff === 0 ? 'Vence hoje!' : diff === 1 ? 'Falta 1 dia' : `Faltam ${diff} dias` };
    if (diff <= 15) return { level: 'warning' as const, daysLeft: diff, label: `Faltam ${diff} dias` };
    return { level: 'safe' as const, daysLeft: diff, label: `Faltam ${diff} dias` };
  };

  const toggleCardExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleRead = async (id: string, currentlyRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentlyRead) {
      await supabase.from('intimacoes').update({ lida: false, lida_em: null }).eq('id', id);
      setIntimacoes(prev => prev.map(i => i.id === id ? { ...i, lida: false, lida_em: null } : i));
    } else {
      await handleMarkRead(id);
    }
  };

  const filtered = intimacoes.filter((i) => {
    const matchesSearch =
      !searchTerm ||
      i.processo_cnj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.processo_titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.conteudo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.tipo_intimacao?.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesFilter = true;
    if (filterLida === 'unread') matchesFilter = !i.lida;
    else if (filterLida === 'read') matchesFilter = i.lida;
    else if (filterLida === 'urgent') {
      const urgency = getUrgencyInfo(i);
      matchesFilter = urgency.level === 'urgent' || urgency.level === 'overdue';
    }
    return matchesSearch && matchesFilter;
  });

  const unreadCount = intimacoes.filter((i) => !i.lida).length;
  const urgentCount = intimacoes.filter(i => {
    const u = getUrgencyInfo(i);
    return u.level === 'urgent' || u.level === 'overdue';
  }).length;

  // ── Type styles ──
  const getTypeConfig = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t.includes('intimação') || t.includes('intimacao') || t.includes('citação') || t.includes('citacao')) {
      return {
        topBar: 'bg-gradient-to-r from-amber-500 to-orange-500',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        dot: 'bg-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
        ring: 'hover:ring-amber-200 dark:hover:ring-amber-800/40',
        unreadRing: 'ring-1 ring-amber-200 dark:ring-amber-800/30',
      };
    }
    if (t.includes('sentença') || t.includes('sentenca')) {
      return {
        topBar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        ring: 'hover:ring-emerald-200 dark:hover:ring-emerald-800/40',
        unreadRing: 'ring-1 ring-emerald-200 dark:ring-emerald-800/30',
      };
    }
    if (t.includes('decisão') || t.includes('decisao')) {
      return {
        topBar: 'bg-gradient-to-r from-purple-500 to-violet-500',
        badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
        dot: 'bg-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
        ring: 'hover:ring-purple-200 dark:hover:ring-purple-800/40',
        unreadRing: 'ring-1 ring-purple-200 dark:ring-purple-800/30',
      };
    }
    // default: publicação / despacho
    return {
      topBar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      dot: 'bg-blue-500',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      ring: 'hover:ring-blue-200 dark:hover:ring-blue-800/40',
      unreadRing: 'ring-1 ring-blue-200 dark:ring-blue-800/30',
    };
  };

  // Initial for avatar
  const getInitial = (tipo: string) => {
    const t = (tipo || 'P').trim();
    return t[0].toUpperCase();
  };

  // Gradient for avatar by type
  const getAvatarGradient = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t.includes('intimação') || t.includes('intimacao')) return 'from-amber-500 to-orange-600';
    if (t.includes('citação') || t.includes('citacao')) return 'from-orange-500 to-red-500';
    if (t.includes('sentença') || t.includes('sentenca')) return 'from-emerald-500 to-teal-600';
    if (t.includes('decisão') || t.includes('decisao')) return 'from-purple-500 to-violet-600';
    if (t.includes('despacho')) return 'from-sky-500 to-blue-600';
    return 'from-blue-500 to-indigo-600';
  };

  return (
    <AppLayout>
      {/* ── Premium Header ── */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-gradient-to-r from-card via-card to-secondary/5 backdrop-blur-md">
        <div className="flex h-16 md:h-[72px] items-center justify-between px-4 md:px-8 gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-3">
              {/* Icon with gradient */}
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                  <Scale className="h-5 w-5 text-primary-foreground" />
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Intimações</h1>
                  {unreadCount > 0 && (
                    <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold border border-destructive/20">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground hidden md:block">
                  Monitoramento de publicações em Diários Oficiais
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {oabNumero && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20">
                <Gavel className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-semibold text-foreground">OAB/{oabUf} {oabNumero}</span>
              </div>
            )}
            <Button
              onClick={handleSync}
              disabled={syncing || !oabNumero}
              className="rounded-xl h-9 md:h-10 text-xs md:text-sm shadow-sm gap-2 bg-primary hover:bg-primary/90"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-8 space-y-6 animate-fade-in">
        {/* OAB Warning */}
        {!oabNumero && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Configure sua OAB</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Acesse Configurações → Escritório para habilitar a busca automática.
              </p>
            </div>
          </div>
        )}

        {/* ── Premium KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: BookOpen,
              label: 'Total de Publicações',
              value: intimacoes.length,
              color: 'text-foreground',
              iconColor: 'text-primary',
              bg: 'bg-primary/8',
              decoBg: 'bg-primary/5',
              ring: 'ring-primary/10',
              borderTop: 'from-primary/60 to-primary/30',
            },
            {
              icon: AlertTriangle,
              label: 'Pendentes de Leitura',
              value: unreadCount,
              color: 'text-destructive',
              iconColor: 'text-destructive',
              bg: 'bg-destructive/8',
              decoBg: 'bg-destructive/5',
              ring: 'ring-destructive/10',
              borderTop: 'from-destructive/60 to-orange-400/30',
            },
            {
              icon: CheckCircle2,
              label: 'Já Analisadas',
              value: intimacoes.length - unreadCount,
              color: 'text-emerald-600',
              iconColor: 'text-emerald-600',
              bg: 'bg-emerald-500/8',
              decoBg: 'bg-emerald-500/5',
              ring: 'ring-emerald-500/10',
              borderTop: 'from-emerald-500/60 to-teal-400/30',
            },
            {
              icon: Clock,
              label: 'Últimos 7 Dias',
              value: intimacoes.filter((i) => {
                if (!i.data_intimacao) return false;
                return Date.now() - new Date(i.data_intimacao).getTime() < 7 * 24 * 60 * 60 * 1000;
              }).length,
              color: 'text-blue-600',
              iconColor: 'text-blue-600',
              bg: 'bg-blue-500/8',
              decoBg: 'bg-blue-500/5',
              ring: 'ring-blue-500/10',
              borderTop: 'from-blue-500/60 to-indigo-400/30',
            },
          ].map((kpi, idx) => (
            <Card
              key={idx}
              className={`relative overflow-hidden cursor-default select-none
                transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5
                ring-1 ${kpi.ring} border-border/50 group`}
            >
              {/* Top gradient bar */}
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${kpi.borderTop}`} />
              {/* Decorative circle */}
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full ${kpi.decoBg} blur-xl group-hover:scale-150 transition-transform duration-500`} />
              <div className={`absolute bottom-0 right-0 w-12 h-12 ${kpi.bg} rounded-tl-3xl -mr-1 -mb-1 opacity-60`} />

              <CardContent className="p-5 relative">
                <div className={`h-9 w-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3 ring-1 ${kpi.ring}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
                <p className={`text-3xl font-black ${kpi.color} tracking-tight tabular-nums`}>
                  {kpi.value.toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground mt-1.5 uppercase tracking-widest leading-tight">
                  {kpi.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Search + Filter Bar ── */}
        <Card className="p-3 shadow-sm border-border/50">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por CNJ, título, tribunal, conteúdo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-9 h-10 rounded-xl border-border/50 bg-muted/30 focus:bg-card transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Pill Filters */}
            <div className="flex gap-1.5 bg-muted/40 rounded-xl p-1 flex-wrap">
              {([
                { key: 'all' as const, label: 'Todas', count: intimacoes.length, icon: Inbox },
                { key: 'unread' as const, label: 'Não lidas', count: unreadCount, icon: EyeOff },
                { key: 'read' as const, label: 'Lidas', count: intimacoes.length - unreadCount, icon: Eye },
                { key: 'urgent' as const, label: 'Prazo urgente', count: urgentCount, icon: AlertTriangle },
              ]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterLida(f.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    transition-all duration-200 select-none
                    ${filterLida === f.key
                      ? f.key === 'urgent'
                        ? 'bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20'
                        : 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/80'
                    }
                  `}
                >
                  <f.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{f.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filterLida === f.key
                      ? 'bg-white/20 text-current'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Sync strip */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Sincronização automática: 08h e 14h · Fonte: Escavador / Diários Oficiais
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">
            {filtered.length} de {intimacoes.length} publicações
          </p>
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Scale className="h-7 w-7 text-primary/40" />
              </div>
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Carregando publicações...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center border-dashed border-2 border-border/40">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Scale className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {intimacoes.length === 0 ? 'Nenhuma intimação encontrada' : 'Nenhum resultado para o filtro'}
            </p>
            <p className="text-xs text-muted-foreground">
              {intimacoes.length === 0
                ? 'Clique em "Sincronizar" para buscar publicações.'
                : 'Tente alterar os termos da busca.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Batch toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap py-1 px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todas"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0 ? `${selectedIds.size} selecionada(s)` : 'Selecionar'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedIds.size > 0 && (
                  <Button
                    size="sm" variant="default"
                    className="h-7 text-xs gap-1.5 rounded-lg"
                    onClick={handleBatchReport}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Relatório Selecionadas ({selectedIds.size})
                  </Button>
                )}
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs gap-1.5 rounded-lg border-border/50"
                  onClick={handleReportAll}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Relatório de Todas ({filtered.length})
                </Button>
              </div>
            </div>

            {/* ── Cards ── */}
            {filtered.map((intimacao) => {
              const prazos = calcularPrazos(intimacao);
              const fmtPrazo = (d: Date | null) => d ? format(d, 'dd/MM/yyyy') : null;
              const dataFatalStr = fmtPrazo(prazos.dataFatal);
              const urgency = getUrgencyInfo(intimacao);
              const typeConfig = getTypeConfig(intimacao.tipo_intimacao);
              const isExpanded = expandedCards.has(intimacao.id);
              const contentText = intimacao.conteudo || 'Sem conteúdo detalhado';
              const isLongContent = contentText.length > 150;
              const isSelected = selectedIds.has(intimacao.id);

              return (
                <Card
                  key={intimacao.id}
                  className={`
                    group relative overflow-hidden cursor-pointer
                    transition-all duration-200
                    hover:shadow-xl hover:-translate-y-[1px]
                    border-border/50
                    ${isSelected
                      ? 'ring-2 ring-primary/40 border-primary/30 shadow-md shadow-primary/10'
                      : !intimacao.lida
                      ? `${typeConfig.unreadRing} hover:ring-2 ${typeConfig.ring}`
                      : `hover:ring-1 ${typeConfig.ring}`
                    }
                  `}
                  onClick={() => {
                    setSelectedIntimacao(intimacao);
                    if (!intimacao.lida) handleMarkRead(intimacao.id);
                  }}
                >
                  {/* Top color bar */}
                  <div className={`absolute top-0 left-0 right-0 h-[3px] ${typeConfig.topBar} opacity-80`} />

                  <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(intimacao.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Selecionar ${intimacao.processo_cnj}`}
                        />
                      </div>

                      {/* Avatar */}
                      <div className={`shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(intimacao.tipo_intimacao)} flex items-center justify-center shadow-sm`}>
                        <span className="text-base font-black text-white">
                          {getInitial(intimacao.tipo_intimacao)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Badges row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {!intimacao.lida && (
                            <span className={`h-2 w-2 rounded-full ${typeConfig.dot} shrink-0 animate-pulse`} />
                          )}
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${typeConfig.badge}`}>
                            {intimacao.tipo_intimacao || 'Publicação'}
                          </span>
                          {intimacao.tribunal && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-secondary/30 bg-secondary/5 text-muted-foreground">
                              {intimacao.tribunal}
                            </span>
                          )}
                          {/* Urgency chip */}
                          {(urgency.level === 'urgent' || urgency.level === 'overdue') && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse">
                              <AlertTriangle className="h-3 w-3" />
                              {urgency.label}
                            </span>
                          )}
                          {urgency.level === 'warning' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              <Timer className="h-3 w-3" />
                              {urgency.label}
                            </span>
                          )}
                          {urgency.level === 'safe' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                              <Clock className="h-3 w-3" />
                              {urgency.label}
                            </span>
                          )}
                          {urgency.level === 'none' && dataFatalStr && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40">
                              <Clock className="h-3 w-3" />
                              Fatal: {dataFatalStr}
                            </span>
                          )}
                        </div>

                        {/* CNJ + title */}
                        <div>
                          <p className="text-sm font-bold text-foreground tracking-tight font-mono leading-tight">
                            {intimacao.processo_cnj || 'Sem CNJ'}
                          </p>
                          {intimacao.processo_titulo && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {intimacao.processo_titulo}
                            </p>
                          )}
                        </div>

                        {/* Content preview */}
                        <div>
                          <p className={`text-xs text-muted-foreground/80 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {contentText}
                          </p>
                          {isLongContent && (
                            <button
                              onClick={(e) => toggleCardExpand(intimacao.id, e)}
                              className="text-[11px] text-primary font-semibold mt-1 hover:underline"
                            >
                              {isExpanded ? '▲ Recolher' : '▼ Ver mais'}
                            </button>
                          )}
                        </div>

                        {/* Dates */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {intimacao.data_disponibilizacao && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg border border-border/30">
                              <CalendarDays className="h-3 w-3 text-secondary shrink-0" />
                              Disponib.: <span className="font-bold text-foreground ml-0.5">{formatDate(intimacao.data_disponibilizacao)}</span>
                            </span>
                          )}
                          {intimacao.data_publicacao && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg border border-border/30">
                              <CalendarDays className="h-3 w-3 text-secondary shrink-0" />
                              Publicação: <span className="font-bold text-foreground ml-0.5">{formatDate(intimacao.data_publicacao)}</span>
                            </span>
                          )}
                          {intimacao.data_intimacao && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg border border-border/30">
                              <CalendarDays className="h-3 w-3 text-secondary shrink-0" />
                              Intimação: <span className="font-bold text-foreground ml-0.5">{formatDate(intimacao.data_intimacao)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <button
                          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center"
                          onClick={(e) => handleToggleRead(intimacao.id, intimacao.lida, e)}
                          title={intimacao.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                        >
                          {intimacao.lida
                            ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        </button>
                        {intimacao.processo_cnj && (
                          <button
                            className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); void copyTextToClipboard(intimacao.processo_cnj); }}
                            title="Copiar número"
                          >
                            <Copy className="h-3.5 w-3.5 text-blue-600" />
                          </button>
                        )}
                        <button
                          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-purple-100 dark:hover:bg-purple-900/30 flex items-center justify-center"
                          onClick={(e) => handleGenerateReport(intimacao, e)}
                          title="Gerar relatório PDF"
                        >
                          <FileText className="h-3.5 w-3.5 text-purple-600" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-secondary group-hover:translate-x-0.5 transition-all duration-200 mt-1" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {selectedIntimacao && (
            <IntimacaoDetailModal
              intimacao={selectedIntimacao}
              formatDate={formatDate}
              formatDateLong={formatDateLong}
              calcularPrazos={calcularPrazos}
              getTypeConfig={getTypeConfig}
              onMarkRead={() => {
                handleMarkRead(selectedIntimacao.id);
                setSelectedIntimacao({ ...selectedIntimacao, lida: true });
              }}
              onGenerateReport={() => handleGenerateReport(selectedIntimacao)}
              onClose={() => setSelectedIntimacao(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ── Detail Modal ──
function IntimacaoDetailModal({
  intimacao,
  formatDate,
  formatDateLong,
  calcularPrazos,
  getTypeConfig,
  onMarkRead,
  onGenerateReport,
  onClose,
}: {
  intimacao: Intimacao;
  formatDate: (d: string | null) => string | null;
  formatDateLong: (d: string | null) => string;
  calcularPrazos: (i: Intimacao) => { dataBase: Date | null; dataConclusao: Date | null; dataFatal: Date | null };
  getTypeConfig: (tipo: string) => any;
  onMarkRead: () => void;
  onGenerateReport: () => void;
  onClose: () => void;
}) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [comentario, setComentario] = useState('');
  const [processoSearch, setProcessoSearch] = useState('');
  const [processoResults, setProcessoResults] = useState<Array<{ id: string; numero_processo: string | null; titulo_acao: string | null }>>([]);
  const [searchingProcesso, setSearchingProcesso] = useState(false);
  const [linkedProcesso, setLinkedProcesso] = useState<{ id: string; numero: string; titulo: string } | null>(null);
  const [showProcessoDropdown, setShowProcessoDropdown] = useState(false);

  const TAREFAS_PREDEFINIDAS = [
    'Manifestação', 'Recurso de Apelação', 'Recurso Especial', 'Recurso Extraordinário',
    'Recurso Ordinário', 'Recurso Inominado', 'Embargos de Declaração', 'Contrarrazões',
    'Alegações Finais', 'Memoriais', 'Agravo de Instrumento', 'Agravo Interno',
    'Sentença', 'Acórdão', 'Sessão de Julgamento', 'Réplica', 'Perícia',
  ];
  const [tarefasAdicionadas, setTarefasAdicionadas] = useState<string[]>([]);
  const [tarefasCustom, setTarefasCustom] = useState<string[]>([]);
  const [showTarefaSelector, setShowTarefaSelector] = useState(false);
  const [novaTarefaCustom, setNovaTarefaCustom] = useState('');

  const allTarefaOptions = [...TAREFAS_PREDEFINIDAS, ...tarefasCustom];

  const adicionarTarefa = (tarefa: string) => {
    if (!tarefasAdicionadas.includes(tarefa)) setTarefasAdicionadas(prev => [...prev, tarefa]);
  };
  const removerTarefa = (tarefa: string) => setTarefasAdicionadas(prev => prev.filter(t => t !== tarefa));
  const adicionarTarefaCustom = () => {
    const nome = novaTarefaCustom.trim();
    if (!nome) return;
    if (!allTarefaOptions.includes(nome)) setTarefasCustom(prev => [...prev, nome]);
    if (!tarefasAdicionadas.includes(nome)) setTarefasAdicionadas(prev => [...prev, nome]);
    setNovaTarefaCustom('');
  };

  const searchProcessos = async (term: string) => {
    setProcessoSearch(term);
    if (term.length < 2) { setProcessoResults([]); setShowProcessoDropdown(false); return; }
    setSearchingProcesso(true);
    const { data } = await supabase
      .from('processos')
      .select('id, numero_processo, titulo_acao')
      .or(`numero_processo.ilike.%${term}%,titulo_acao.ilike.%${term}%`)
      .limit(8);
    setProcessoResults((data as any[]) || []);
    setShowProcessoDropdown(true);
    setSearchingProcesso(false);
  };

  const selectProcesso = (p: { id: string; numero_processo: string | null; titulo_acao: string | null }) => {
    setLinkedProcesso({ id: p.id, numero: p.numero_processo || '', titulo: p.titulo_acao || '' });
    setProcessoSearch(p.numero_processo || p.titulo_acao || '');
    setShowProcessoDropdown(false);
  };

  const prazos = calcularPrazos(intimacao);
  const fmtPrazo = (d: Date | null) => d ? format(d, 'dd/MM/yyyy') : '—';
  const typeConfig = getTypeConfig(intimacao.tipo_intimacao);
  const conteudo = intimacao.conteudo || '';
  const isLong = conteudo.length > 400;
  const displayContent = showFullContent ? conteudo : conteudo.slice(0, 400);

  return (
    <>
      {/* Header with gradient */}
      <div className={`relative overflow-hidden`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-primary/60`} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-sm`}>
                  {intimacao.tipo_intimacao || 'Publicação'}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                  intimacao.lida
                    ? 'bg-emerald-400/30 text-emerald-100'
                    : 'bg-amber-400/30 text-amber-100'
                }`}>
                  {intimacao.lida ? '✓ Lida' : '● Não lida'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {intimacao.processo_titulo || intimacao.tipo_intimacao || 'Publicação'}
              </h2>
              {intimacao.processo_cnj && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 backdrop-blur-sm">
                  <p className="text-sm font-mono font-bold text-white tracking-wide">{intimacao.processo_cnj}</p>
                  <button
                    type="button"
                    onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}
                    className="h-5 w-5 rounded-md flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border/40 bg-muted/20 flex-wrap">
        {!intimacao.lida && (
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg" onClick={onMarkRead}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar como lida
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={onGenerateReport}>
          <FileText className="h-3.5 w-3.5" />
          Relatório PDF
        </Button>
        {intimacao.processo_cnj && (
          <Button
            variant="outline" size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg"
            onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar nº
          </Button>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Link to existing process */}
        <div className="border-2 border-primary/20 rounded-xl p-4 bg-primary/[0.02] space-y-3">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Vincular a processo existente</p>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquise por nº processo, título ou envolvidos"
                value={processoSearch}
                onChange={(e) => searchProcessos(e.target.value)}
                className="pl-10 text-sm rounded-lg"
              />
              {showProcessoDropdown && processoResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {processoResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                      onClick={() => selectProcesso(p)}
                    >
                      <p className="text-sm font-mono font-semibold text-primary">{p.numero_processo || 'Sem número'}</p>
                      {p.titulo_acao && <p className="text-xs text-muted-foreground">{p.titulo_acao}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline" size="sm"
              className="h-10 px-4 font-medium rounded-lg"
              disabled={!linkedProcesso}
              onClick={() => { if (linkedProcesso) toast.success('Processo vinculado com sucesso!'); }}
            >
              Vincular
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
              <Scale className="h-3.5 w-3.5" />
              Cadastrar processo
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
              <Gavel className="h-3.5 w-3.5" />
              Cadastrar com IA
            </Button>
          </div>
        </div>

        {/* Linked process info */}
        <div className="border border-border/50 rounded-xl p-4 bg-muted/10 space-y-2">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Processo vinculado</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary font-semibold font-mono">
              {linkedProcesso?.numero || intimacao.processo_cnj || 'Não identificado'}
            </span>
            {(linkedProcesso || intimacao.processo_cnj) && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          {(linkedProcesso?.titulo || intimacao.processo_titulo) && (
            <>
              <p className="text-xs font-bold text-foreground mt-2">Assunto</p>
              <p className="text-sm text-muted-foreground">{linkedProcesso?.titulo || intimacao.processo_titulo}</p>
            </>
          )}
          {intimacao.tribunal && (
            <>
              <p className="text-xs font-bold text-foreground mt-2">Tribunal</p>
              <p className="text-sm text-muted-foreground">{intimacao.tribunal}</p>
            </>
          )}
        </div>

        {/* Detalhes */}
        <div>
          <h3 className="text-base font-bold text-foreground mb-4">Detalhes da Intimação</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tipo</p>
                <p className="text-sm text-foreground font-medium">{intimacao.tipo_intimacao || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Fonte</p>
                <p className="text-sm text-foreground font-medium">Escavador / Diário Oficial</p>
              </div>
            </div>

            {/* Prazos */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Data Base', value: fmtPrazo(prazos.dataBase), accent: false },
                { label: 'Conclusão prevista', value: fmtPrazo(prazos.dataConclusao), accent: false },
                { label: 'Data Fatal', value: fmtPrazo(prazos.dataFatal), accent: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`p-3 rounded-xl border ${
                    item.accent
                      ? 'border-destructive/20 bg-destructive/5'
                      : 'border-border/50 bg-muted/20'
                  }`}
                >
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`text-sm font-bold ${item.accent ? 'text-destructive' : 'text-foreground'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Datas originais */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Disponibilização', value: formatDate(intimacao.data_disponibilizacao) || '—' },
                { label: 'Publicação', value: formatDate(intimacao.data_publicacao) || '—' },
                { label: 'Intimação', value: formatDate(intimacao.data_intimacao) || '—' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-sm text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Descrição */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Descrição</p>
              <div className="bg-muted/20 rounded-xl p-3 border border-border/40">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {displayContent}{isLong && !showFullContent && '...'}
                </p>
              </div>
              {isLong && (
                <button
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="text-xs text-primary font-semibold mt-2 hover:underline"
                >
                  {showFullContent ? 'Recolher' : 'Expandir conteúdo completo'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible sections */}
        <CollapsibleSection icon={Clock} title="Auditoria">
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>Recebido em: <span className="text-foreground font-medium">{formatDateLong(intimacao.created_at)}</span></p>
            {intimacao.lida_em && <p>Lida em: <span className="text-foreground font-medium">{formatDateLong(intimacao.lida_em)}</span></p>}
            <p>OAB: <span className="text-foreground font-medium">{intimacao.oab_numero}/{intimacao.oab_uf}</span></p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          icon={FileText}
          title="Documentos"
          actions={<Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg">Adicionar</Button>}
        >
          <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
        </CollapsibleSection>

        <CollapsibleSection
          icon={ClipboardList}
          title="Tarefas relacionadas"
          actions={
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
              onClick={(e) => { e.stopPropagation(); setShowTarefaSelector(prev => !prev); }}
            >
              Adicionar
            </Button>
          }
        >
          <div className="space-y-3">
            {tarefasAdicionadas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tarefasAdicionadas.map((tarefa) => (
                  <Badge
                    key={tarefa}
                    variant="secondary"
                    className="gap-1.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors rounded-lg"
                    onClick={() => removerTarefa(tarefa)}
                    title="Clique para remover"
                  >
                    {tarefa} <span className="text-[10px] opacity-60">✕</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa relacionada.</p>
            )}
            {showTarefaSelector && (
              <div className="border border-border rounded-xl p-3 bg-muted/20 space-y-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-9 text-xs rounded-lg">
                      Selecione o tipo de tarefa...
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar tarefa..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma tarefa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {allTarefaOptions.filter(t => !tarefasAdicionadas.includes(t)).map((tarefa) => (
                            <CommandItem key={tarefa} value={tarefa} onSelect={() => adicionarTarefa(tarefa)} className="text-xs cursor-pointer">
                              {tarefa}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2 pt-1 border-t border-border/50">
                  <Input
                    placeholder="Cadastrar nova tarefa..."
                    value={novaTarefaCustom}
                    onChange={(e) => setNovaTarefaCustom(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarTarefaCustom()}
                    className="h-8 text-xs rounded-lg"
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 rounded-lg" onClick={adicionarTarefaCustom} disabled={!novaTarefaCustom.trim()}>
                    Cadastrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection icon={MessageSquare} title="Comentários" defaultOpen>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-right">{2000 - comentario.length} caracteres restantes</p>
            <Textarea
              placeholder="Utilize o @ antes de um nome para citar outros usuários do sistema."
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              className="resize-none rounded-xl"
              rows={3}
              maxLength={2000}
            />
          </div>
        </CollapsibleSection>
      </div>
    </>
  );
}

// ── Collapsible Section ──
function CollapsibleSection({
  icon: Icon,
  title,
  defaultOpen = false,
  actions,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
            </div>
            <div className="flex items-center gap-2">
              {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t border-border/30">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
