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

import { format, parseISO, isValid, addDays, addBusinessDays, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateIntimacaoReport } from '@/lib/intimacaoReportGenerator';

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
  const [filterLida, setFilterLida] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedIntimacao, setSelectedIntimacao] = useState<Intimacao | null>(null);

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

    if (error) {
      console.error('Erro ao buscar intimações:', error);
    } else {
      setIntimacoes((data as any[]) || []);
    }
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
          {
            description: 'A busca foi colocada em fila e será processada automaticamente em segundo plano.',
          },
        );

        window.setTimeout(() => {
          void fetchIntimacoes();
        }, 4000);
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
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatDateLong = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return dateStr;
      return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Calculate procedural deadlines based on intimação type
  const calcularPrazos = (intimacao: Intimacao) => {
    const baseDate = intimacao.data_publicacao || intimacao.data_intimacao || intimacao.data_disponibilizacao;
    if (!baseDate) return { dataBase: null, dataConclusao: null, dataFatal: null };

    const base = parseISO(baseDate);
    if (!isValid(base)) return { dataBase: base, dataConclusao: null, dataFatal: null };

    const tipo = (intimacao.tipo_intimacao || '').toLowerCase();

    // Determine deadline days based on type (Brazilian procedural law)
    let prazoUteis = 15; // default
    let prazoFatal = 20;

    if (tipo.includes('contestação') || tipo.includes('contestacao')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('réplica') || tipo.includes('replica')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('recurso') || tipo.includes('apelação') || tipo.includes('apelacao')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('embargos')) {
      prazoUteis = 5; prazoFatal = 10;
    } else if (tipo.includes('agravo')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('manifestação') || tipo.includes('manifestacao')) {
      prazoUteis = 5; prazoFatal = 10;
    } else if (tipo.includes('contrarrazões') || tipo.includes('contrarrazoes')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('alegações') || tipo.includes('alegacoes')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('ciência') || tipo.includes('ciencia')) {
      prazoUteis = 5; prazoFatal = 15;
    } else if (tipo.includes('sentença') || tipo.includes('sentenca')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('emenda')) {
      prazoUteis = 15; prazoFatal = 20;
    } else if (tipo.includes('pagamento')) {
      prazoUteis = 15; prazoFatal = 15;
    } else if (tipo.includes('sessão') || tipo.includes('sessao') || tipo.includes('julgamento')) {
      prazoUteis = 0; prazoFatal = 0;
    }

    // Add 1 day for start of counting (day after publication)
    const inicioContagem = addDays(base, 1);
    // Skip weekends for start
    let startDate = inicioContagem;
    while (isWeekend(startDate)) {
      startDate = addDays(startDate, 1);
    }

    const dataConclusao = prazoUteis > 0 ? addBusinessDays(startDate, prazoUteis) : null;
    const dataFatal = prazoFatal > 0 ? addBusinessDays(startDate, prazoFatal) : null;

    return { dataBase: base, dataConclusao, dataFatal };
  };

  const handleGenerateReport = (intimacao: Intimacao, e?: React.MouseEvent) => {
    e?.stopPropagation();
    generateIntimacaoReport(intimacao);
    toast.success('Relatório gerado com sucesso');
  };

  const filtered = intimacoes.filter((i) => {
    const matchesSearch =
      !searchTerm ||
      i.processo_cnj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.processo_titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.conteudo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.tipo_intimacao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterLida === 'all' ||
      (filterLida === 'unread' && !i.lida) ||
      (filterLida === 'read' && i.lida);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = intimacoes.filter((i) => !i.lida).length;

  const getTipoBadgeColor = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t.includes('intimação') || t.includes('intimacao')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (t.includes('citação') || t.includes('citacao')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    if (t.includes('despacho')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (t.includes('sentença') || t.includes('sentenca')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (t.includes('decisão') || t.includes('decisao')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <AppLayout>
      {/* Premium Header with gradient */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-gradient-to-r from-card via-card to-secondary/5 backdrop-blur-md">
        <div className="flex h-16 md:h-[72px] items-center justify-between px-4 md:px-8 gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight">Intimações</h1>
                  {unreadCount > 0 && (
                    <span className="flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground hidden md:block">Monitoramento de publicações em Diários Oficiais</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {oabNumero && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/15 border border-secondary/30">
                <Gavel className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-semibold text-foreground">OAB/{oabUf} {oabNumero}</span>
              </div>
            )}
            <Button
              onClick={handleSync}
              disabled={syncing || !oabNumero}
              className="rounded-xl h-9 md:h-10 text-xs md:text-sm shadow-sm gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-8 space-y-6 animate-fade-in">
        {/* OAB Config Warning */}
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

        {/* Premium KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: BookOpen, label: 'Total de Publicações', value: intimacoes.length, color: 'text-primary', bg: 'bg-primary/8', ring: 'ring-primary/10' },
            { icon: AlertTriangle, label: 'Pendentes de Leitura', value: unreadCount, color: 'text-destructive', bg: 'bg-destructive/8', ring: 'ring-destructive/10' },
            { icon: CheckCircle2, label: 'Já Analisadas', value: intimacoes.length - unreadCount, color: 'text-emerald-600', bg: 'bg-emerald-500/8', ring: 'ring-emerald-500/10' },
            {
              icon: Clock, label: 'Últimos 7 Dias', color: 'text-blue-600', bg: 'bg-blue-500/8', ring: 'ring-blue-500/10',
              value: intimacoes.filter((i) => {
                if (!i.data_intimacao) return false;
                return Date.now() - new Date(i.data_intimacao).getTime() < 7 * 24 * 60 * 60 * 1000;
              }).length
            },
          ].map((kpi, idx) => (
            <Card key={idx} className={`relative overflow-hidden p-4 hover:shadow-lg transition-all duration-300 ring-1 ${kpi.ring}`}>
              <div className={`absolute top-0 right-0 w-20 h-20 ${kpi.bg} rounded-bl-[40px] -mr-2 -mt-2`} />
              <div className="relative">
                <div className={`h-9 w-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                  <kpi.icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                </div>
                <p className={`text-3xl font-bold ${kpi.color} tracking-tight`}>{kpi.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">{kpi.label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Search & Filters Bar */}
        <Card className="p-3 shadow-sm">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por CNJ, título, tribunal, conteúdo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl border-border/50 bg-muted/30 focus:bg-card transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                {(['all', 'unread', 'read'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filterLida === f ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterLida(f)}
                    className={`rounded-lg text-xs h-8 px-4 font-medium ${filterLida === f ? 'shadow-sm' : 'hover:bg-card'}`}
                  >
                    {f === 'all' ? `Todas (${intimacoes.length})` : f === 'unread' ? `Não lidas (${unreadCount})` : `Lidas (${intimacoes.length - unreadCount})`}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Sync info strip */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Sincronização automática: 08h e 14h · Fonte: Escavador / Diários Oficiais
          </p>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} de {intimacoes.length} publicações
          </p>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-secondary" />
            <p className="text-sm text-muted-foreground">Carregando publicações...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center border-dashed border-2 border-border/50">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Scale className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {intimacoes.length === 0 ? 'Nenhuma intimação encontrada' : 'Nenhum resultado para o filtro'}
            </p>
            <p className="text-xs text-muted-foreground">
              {intimacoes.length === 0 ? 'Clique em "Sincronizar" para buscar publicações.' : 'Tente alterar os termos da busca.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((intimacao) => {
              const prazos = calcularPrazos(intimacao);
              const fmtPrazo = (d: Date | null) => d ? format(d, 'dd/MM/yyyy') : null;
              const dataFatalStr = fmtPrazo(prazos.dataFatal);

              return (
                <Card
                  key={intimacao.id}
                  className={`group transition-all duration-200 hover:shadow-xl cursor-pointer overflow-hidden ${
                    !intimacao.lida
                      ? 'border-l-4 border-l-destructive bg-gradient-to-r from-destructive/[0.02] to-transparent ring-1 ring-destructive/10'
                      : 'hover:ring-1 hover:ring-secondary/30'
                  }`}
                  onClick={() => {
                    setSelectedIntimacao(intimacao);
                    if (!intimacao.lida) handleMarkRead(intimacao.id);
                  }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2.5">
                        {/* Top row: badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {!intimacao.lida && (
                            <span className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0 animate-pulse shadow-sm shadow-destructive/30" />
                          )}
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${getTipoBadgeColor(intimacao.tipo_intimacao)}`}>
                            {intimacao.tipo_intimacao}
                          </span>
                          {intimacao.tribunal && (
                            <Badge variant="outline" className="text-[10px] h-5 font-semibold border-secondary/40 bg-secondary/5">
                              {intimacao.tribunal}
                            </Badge>
                          )}
                          {dataFatalStr && (
                            <Badge variant="outline" className="text-[10px] h-5 font-semibold border-destructive/30 bg-destructive/5 text-destructive">
                              <Clock className="h-3 w-3 mr-1" />
                              Fatal: {dataFatalStr}
                            </Badge>
                          )}
                        </div>

                        {/* CNJ + title */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground tracking-tight">
                              {intimacao.processo_cnj || 'Sem CNJ'}
                            </p>
                            {intimacao.processo_titulo && (
                              <p className="text-xs text-muted-foreground mt-0.5">{intimacao.processo_titulo}</p>
                            )}
                          </div>
                          {intimacao.processo_cnj && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyTextToClipboard(intimacao.processo_cnj);
                              }}
                              title="Copiar número do processo"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Content preview */}
                        <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3">
                          {intimacao.conteudo || 'Sem conteúdo detalhado'}
                        </p>

                        {/* Dates row - premium pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {intimacao.data_disponibilizacao && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
                              <CalendarDays className="h-3 w-3 text-secondary" />
                              Disponibilização: <span className="font-bold text-foreground">{formatDate(intimacao.data_disponibilizacao)}</span>
                            </span>
                          )}
                          {intimacao.data_publicacao && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
                              <CalendarDays className="h-3 w-3 text-secondary" />
                              Publicação: <span className="font-bold text-foreground">{formatDate(intimacao.data_publicacao)}</span>
                            </span>
                          )}
                          {intimacao.data_intimacao && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg">
                              <CalendarDays className="h-3 w-3 text-secondary" />
                              Intimação: <span className="font-bold text-foreground">{formatDate(intimacao.data_intimacao)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-secondary/15"
                          onClick={(e) => handleGenerateReport(intimacao, e)}
                          title="Gerar relatório PDF"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-secondary transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal - Projuris Style */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {selectedIntimacao && <IntimacaoDetailModal
            intimacao={selectedIntimacao}
            formatDate={formatDate}
            formatDateLong={formatDateLong}
            calcularPrazos={calcularPrazos}
            getTipoBadgeColor={getTipoBadgeColor}
            onMarkRead={() => {
              handleMarkRead(selectedIntimacao.id);
              setSelectedIntimacao({ ...selectedIntimacao, lida: true });
            }}
            onGenerateReport={() => handleGenerateReport(selectedIntimacao)}
            onClose={() => setSelectedIntimacao(null)}
          />}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ── Projuris-style Intimação Detail Modal ──
function IntimacaoDetailModal({
  intimacao,
  formatDate,
  formatDateLong,
  calcularPrazos,
  getTipoBadgeColor,
  onMarkRead,
  onGenerateReport,
  onClose,
}: {
  intimacao: Intimacao;
  formatDate: (d: string | null) => string | null;
  formatDateLong: (d: string | null) => string;
  calcularPrazos: (i: Intimacao) => { dataBase: Date | null; dataConclusao: Date | null; dataFatal: Date | null };
  getTipoBadgeColor: (t: string) => string;
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

  // Tarefas relacionadas
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
    if (!tarefasAdicionadas.includes(tarefa)) {
      setTarefasAdicionadas(prev => [...prev, tarefa]);
    }
  };

  const removerTarefa = (tarefa: string) => {
    setTarefasAdicionadas(prev => prev.filter(t => t !== tarefa));
  };

  const adicionarTarefaCustom = () => {
    const nome = novaTarefaCustom.trim();
    if (nome && !allTarefaOptions.includes(nome)) {
      setTarefasCustom(prev => [...prev, nome]);
      setTarefasAdicionadas(prev => [...prev, nome]);
      setNovaTarefaCustom('');
    } else if (nome && !tarefasAdicionadas.includes(nome)) {
      adicionarTarefa(nome);
      setNovaTarefaCustom('');
    }
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

  // Extract description parts
  const conteudo = intimacao.conteudo || '';
  const isLong = conteudo.length > 400;
  const displayContent = showFullContent ? conteudo : conteudo.slice(0, 400);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground">
              {intimacao.tipo_intimacao || 'Publicação'}
            </h2>
            <Badge className={`text-xs px-3 py-1 rounded-md font-medium ${
              intimacao.lida 
                ? 'bg-emerald-500 text-white' 
                : 'bg-amber-500 text-white'
            }`}>
              {intimacao.lida ? 'Lida' : 'Não lida'}
            </Badge>
          </div>
          {intimacao.processo_cnj && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/[0.06] border border-primary/15">
                <p className="text-sm font-mono font-semibold text-primary tracking-wide">{intimacao.processo_cnj}</p>
                <button
                  type="button"
                  onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}
                  title="Copiar número do processo"
                  className="h-6 w-6 rounded-md flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border/40 bg-muted/20">
        {!intimacao.lida && (
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={onMarkRead}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar como lida
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onGenerateReport}>
          <FileText className="h-3.5 w-3.5" />
          Relatório PDF
        </Button>
        {intimacao.processo_cnj && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => void copyTextToClipboard(intimacao.processo_cnj)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar nº do processo
          </Button>
        )}
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Vincular a processo existente */}
        <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/[0.03] space-y-3">
          <p className="text-xs font-bold text-foreground">Vincular intimação a um processo existente</p>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquise por nº processo, título ou envolvidos"
                value={processoSearch}
                onChange={(e) => searchProcessos(e.target.value)}
                className="pl-10 text-sm"
              />
              {showProcessoDropdown && processoResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
              variant="outline"
              size="sm"
              className="h-10 px-4 font-medium"
              disabled={!linkedProcesso}
              onClick={() => {
                if (linkedProcesso) {
                  toast.success('Processo vinculado com sucesso!');
                }
              }}
            >
              Vincular
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              Cadastrar processo
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Gavel className="h-3.5 w-3.5" />
              Cadastrar processo com IA
            </Button>
          </div>
        </div>

        {/* Processo vinculado card */}
        <div className="border border-border/60 rounded-lg p-4 bg-muted/10 space-y-2">
          <p className="text-xs font-bold text-foreground">Processo vinculado</p>
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

        {/* Detalhes da Tarefa */}
        <div>
          <h3 className="text-base font-bold text-foreground mb-4">Detalhes da Intimação</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-foreground">Tipo da Intimação</p>
                <p className="text-sm text-muted-foreground">{intimacao.tipo_intimacao || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Fonte</p>
                <p className="text-sm text-muted-foreground">Escavador / Diário Oficial</p>
              </div>
            </div>

            {/* Dates - Projuris style with 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-foreground">Data base</p>
                <p className="text-sm text-muted-foreground">{fmtPrazo(prazos.dataBase)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Data de conclusão prevista</p>
                <p className="text-sm text-muted-foreground">{fmtPrazo(prazos.dataConclusao)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Data Fatal</p>
                <p className="text-sm font-semibold text-destructive">{fmtPrazo(prazos.dataFatal)}</p>
              </div>
            </div>

            {/* Original dates from Escavador */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-foreground">Disponibilização</p>
                <p className="text-sm text-muted-foreground">{formatDate(intimacao.data_disponibilizacao) || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Publicação</p>
                <p className="text-sm text-muted-foreground">{formatDate(intimacao.data_publicacao) || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Intimação</p>
                <p className="text-sm text-muted-foreground">{formatDate(intimacao.data_intimacao) || '—'}</p>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <p className="text-xs font-bold text-foreground">Descrição</p>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                {displayContent}
                {isLong && !showFullContent && '...'}
              </p>
              {isLong && (
                <button
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="text-xs text-primary font-semibold mt-1 hover:underline"
                >
                  {showFullContent ? 'Recolher' : 'Expandir'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Sections */}
        <CollapsibleSection icon={Clock} title="Auditoria">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Recebido em: {formatDateLong(intimacao.created_at)}</p>
            {intimacao.lida_em && <p>Lida em: {formatDateLong(intimacao.lida_em)}</p>}
            <p>OAB: {intimacao.oab_numero}/{intimacao.oab_uf}</p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection icon={FileText} title="Documentos"
          actions={<Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Adicionar</Button>}
        >
          <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
        </CollapsibleSection>

        <CollapsibleSection icon={ClipboardList} title="Tarefas relacionadas"
          actions={<Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Adicionar</Button>}
        >
          <p className="text-sm text-muted-foreground">Nenhuma tarefa relacionada.</p>
        </CollapsibleSection>

        <CollapsibleSection icon={MessageSquare} title="Comentários" defaultOpen>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-right">{2000 - comentario.length} caracteres restantes</p>
            <Textarea
              placeholder="Utilize o @ antes de um nome para citar outros usuários do sistema."
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              className="resize-none"
              rows={3}
              maxLength={2000}
            />
          </div>
        </CollapsibleSection>
      </div>
    </>
  );
}

// ── Collapsible Section Component ──
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
      <div className="border border-border/60 rounded-lg bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-lg">
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
          <div className="px-4 pb-4 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
