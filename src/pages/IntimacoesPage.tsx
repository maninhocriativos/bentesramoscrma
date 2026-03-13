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
  Scale, BookOpen, ChevronRight
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
import { Separator } from '@/components/ui/separator';
import { format, parseISO, isValid } from 'date-fns';
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
      .order('data_intimacao', { ascending: false })
      .limit(200);

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
      const { data, error } = await supabase.functions.invoke('intimacoes-oab', {
        body: { oab_numero: oabNumero, oab_uf: oabUf, advogado_id: user?.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${data.total} intimações encontradas`, {
          description: `${data.saved} novas salvas · Fonte: ${data.fonte}`,
        });
        await fetchIntimacoes();
      } else {
        toast.error(data?.error || 'Erro ao buscar intimações');
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
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-semibold text-foreground leading-tight">Intimações</h1>
                <p className="text-[10px] text-muted-foreground hidden md:block">Monitoramento de publicações oficiais</p>
              </div>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="rounded-full text-xs h-5 min-w-5 flex items-center justify-center">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {oabNumero && (
              <Badge variant="outline" className="hidden md:inline-flex text-xs font-medium border-secondary/50">
                OAB/{oabUf} {oabNumero}
              </Badge>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleSync}
              disabled={syncing || !oabNumero}
              className="rounded-xl h-8 md:h-9 text-xs md:text-sm shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 space-y-5 animate-fade-in">
        {/* OAB Config Warning */}
        {!oabNumero && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Configure sua OAB</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Acesse Configurações → Escritório e adicione seu número da OAB para buscar intimações automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: BookOpen, label: 'Total', value: intimacoes.length, color: 'text-primary' },
            { icon: AlertTriangle, label: 'Não lidas', value: unreadCount, color: 'text-destructive' },
            { icon: CheckCircle2, label: 'Lidas', value: intimacoes.length - unreadCount, color: 'text-emerald-600' },
            {
              icon: Clock, label: 'Últimos 7 dias', color: 'text-blue-600',
              value: intimacoes.filter((i) => {
                if (!i.data_intimacao) return false;
                return Date.now() - new Date(i.data_intimacao).getTime() < 7 * 24 * 60 * 60 * 1000;
              }).length
            },
          ].map((kpi, idx) => (
            <Card key={idx} className="p-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1.5">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por CNJ, título, conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl shadow-soft border-0 bg-card"
            />
          </div>
          <div className="flex gap-1.5 bg-muted/50 rounded-xl p-1">
            {(['all', 'unread', 'read'] as const).map((f) => (
              <Button
                key={f}
                variant={filterLida === f ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterLida(f)}
                className={`rounded-lg text-xs h-7 px-3 ${filterLida === f ? '' : 'hover:bg-card'}`}
              >
                {f === 'all' ? 'Todas' : f === 'unread' ? 'Não lidas' : 'Lidas'}
              </Button>
            ))}
          </div>
        </div>

        {/* Sync info */}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Sincronização automática: 08h e 14h diariamente
        </p>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Scale className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {intimacoes.length === 0
                ? 'Nenhuma intimação encontrada. Clique em "Sincronizar" para buscar.'
                : 'Nenhuma intimação corresponde ao filtro.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((intimacao) => (
              <Card
                key={intimacao.id}
                className={`group transition-all hover:shadow-lg cursor-pointer overflow-hidden ${
                  !intimacao.lida
                    ? 'border-l-[3px] border-l-destructive bg-gradient-to-r from-destructive/[0.03] to-transparent'
                    : 'hover:border-secondary/50'
                }`}
                onClick={() => {
                  setSelectedIntimacao(intimacao);
                  if (!intimacao.lida) handleMarkRead(intimacao.id);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Top row: tipo + tribunal */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {!intimacao.lida && (
                          <span className="h-2 w-2 rounded-full bg-destructive shrink-0 animate-pulse" />
                        )}
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getTipoBadgeColor(intimacao.tipo_intimacao)}`}>
                          {intimacao.tipo_intimacao}
                        </span>
                        {intimacao.tribunal && (
                          <Badge variant="outline" className="text-[10px] h-5 font-medium">
                            {intimacao.tribunal}
                          </Badge>
                        )}
                      </div>

                      {/* CNJ + title */}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {intimacao.processo_cnj || 'Sem CNJ'}
                        </p>
                        {intimacao.processo_titulo && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {intimacao.processo_titulo}
                          </p>
                        )}
                      </div>

                      {/* Content preview */}
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {intimacao.conteudo || 'Sem conteúdo detalhado'}
                      </p>

                      {/* Dates row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                        {intimacao.data_disponibilizacao && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 text-secondary" />
                            Disponibilização: <span className="font-semibold text-foreground">{formatDate(intimacao.data_disponibilizacao)}</span>
                          </span>
                        )}
                        {intimacao.data_publicacao && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 text-secondary" />
                            Publicação: <span className="font-semibold text-foreground">{formatDate(intimacao.data_publicacao)}</span>
                          </span>
                        )}
                        {intimacao.data_intimacao && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 text-secondary" />
                            Intimação: <span className="font-semibold text-foreground">{formatDate(intimacao.data_intimacao)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={(e) => handleGenerateReport(intimacao, e)}
                        title="Gerar relatório PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal - Premium */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          {/* Modal Header with gradient */}
          <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent px-6 pt-6 pb-4">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold text-foreground leading-tight">
                    {selectedIntimacao?.tipo_intimacao}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {selectedIntimacao?.processo_cnj || 'Sem número CNJ'}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {selectedIntimacao && (
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <InfoField label="Processo (CNJ)" value={selectedIntimacao.processo_cnj} icon={<Gavel className="h-3.5 w-3.5" />} />
                <InfoField label="Ação / Classe" value={selectedIntimacao.processo_titulo} icon={<BookOpen className="h-3.5 w-3.5" />} />
                <InfoField label="Tribunal" value={selectedIntimacao.tribunal} icon={<Scale className="h-3.5 w-3.5" />} />
                <InfoField
                  label="Tipo"
                  value={selectedIntimacao.tipo_intimacao}
                  badge
                  badgeClass={getTipoBadgeColor(selectedIntimacao.tipo_intimacao)}
                />
              </div>

              <Separator />

              {/* Dates Section */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Datas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <DateCard label="Disponibilização" value={formatDateLong(selectedIntimacao.data_disponibilizacao)} />
                  <DateCard label="Publicação" value={formatDateLong(selectedIntimacao.data_publicacao)} />
                  <DateCard label="Intimação" value={formatDateLong(selectedIntimacao.data_intimacao)} />
                </div>
              </div>

              <Separator />

              {/* Content */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Conteúdo da Publicação
                </h3>
                <div className="p-4 bg-muted/30 rounded-xl text-sm whitespace-pre-wrap leading-relaxed border border-border/50 max-h-60 overflow-y-auto">
                  {selectedIntimacao.conteudo || 'Sem conteúdo detalhado disponível.'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {!selectedIntimacao.lida && (
                  <Button
                    onClick={() => {
                      handleMarkRead(selectedIntimacao.id);
                      setSelectedIntimacao({ ...selectedIntimacao, lida: true });
                    }}
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Marcar como lida
                  </Button>
                )}
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => handleGenerateReport(selectedIntimacao)}
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  Gerar Relatório PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function InfoField({ label, value, icon, badge, badgeClass }: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
  badge?: boolean;
  badgeClass?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {icon && <span className="text-secondary">{icon}</span>}
        {label}
      </label>
      {badge ? (
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>
          {value || '—'}
        </span>
      ) : (
        <p className="text-sm font-medium text-foreground">{value || '—'}</p>
      )}
    </div>
  );
}

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
