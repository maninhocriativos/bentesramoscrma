import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { usePerfil } from '@/hooks/usePerfil';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Loader2, Gavel, Search, RefreshCw, Bell, CheckCircle2,
  Clock, AlertTriangle, Eye, ExternalLink, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Intimacao {
  id: string;
  processo_cnj: string;
  processo_titulo: string;
  tribunal: string;
  tipo_intimacao: string;
  conteudo: string;
  data_intimacao: string | null;
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

  // OAB: prioriza office_settings, fallback para perfil
  const oabNumero = officeSettings?.oab_number || (perfil as any)?.oab_numero || '';
  const oabUf = officeSettings?.oab_state || (perfil as any)?.oab_uf || 'AM';

  useEffect(() => {
    if (user) {
      fetchIntimacoes();
    }
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
        body: {
          oab_numero: oabNumero,
          oab_uf: oabUf,
          advogado_id: user?.id,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`${data.total} intimações encontradas`, {
          description: `${data.processosAnalisados} processos analisados`,
        });
        await fetchIntimacoes();
      } else {
        toast.error(data?.error || 'Erro ao buscar intimações');
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar intimações', {
        description: err.message,
      });
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
    if (!dateStr) return '—';
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return dateStr;
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
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

  return (
    <AppLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
        <div className="flex h-14 md:h-16 items-center justify-between px-3 md:px-6 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary hidden md:block" />
              <h1 className="text-base md:text-xl font-semibold text-foreground truncate">Intimações</h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="rounded-full text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {oabNumero && (
              <Badge variant="outline" className="hidden md:inline-flex text-xs">
                OAB/{oabUf} {oabNumero}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || !oabNumero}
              className="rounded-xl h-8 md:h-9 text-xs md:text-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Buscar Intimações</span>
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
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Configure sua OAB
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Acesse Configurações → seu perfil e adicione seu número da OAB para buscar intimações automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{intimacoes.length}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Não lidas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-destructive">{unreadCount}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Lidas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">
              {intimacoes.length - unreadCount}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {intimacoes.filter((i) => {
                if (!i.data_intimacao) return false;
                const d = new Date(i.data_intimacao);
                return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
              }).length}
            </p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por CNJ, título, conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl shadow-soft border-0"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'unread', 'read'] as const).map((f) => (
              <Button
                key={f}
                variant={filterLida === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterLida(f)}
                className="rounded-xl text-xs h-8"
              >
                {f === 'all' ? 'Todas' : f === 'unread' ? 'Não lidas' : 'Lidas'}
              </Button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Gavel className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {intimacoes.length === 0
                ? 'Nenhuma intimação encontrada. Clique em "Buscar Intimações" para sincronizar.'
                : 'Nenhuma intimação corresponde ao filtro.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((intimacao) => (
              <Card
                key={intimacao.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  !intimacao.lida ? 'border-l-4 border-l-primary bg-primary/5' : ''
                }`}
                onClick={() => {
                  setSelectedIntimacao(intimacao);
                  if (!intimacao.lida) handleMarkRead(intimacao.id);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {!intimacao.lida && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-foreground truncate">
                          {intimacao.tipo_intimacao}
                        </span>
                        {intimacao.tribunal && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {intimacao.tribunal}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <span className="font-medium">{intimacao.processo_cnj}</span>
                        {' — '}
                        {intimacao.processo_titulo}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {intimacao.conteudo || 'Sem conteúdo detalhado'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(intimacao.data_intimacao)}
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 mt-1">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedIntimacao} onOpenChange={() => setSelectedIntimacao(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              {selectedIntimacao?.tipo_intimacao}
            </DialogTitle>
          </DialogHeader>

          {selectedIntimacao && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Processo</label>
                  <p className="text-sm font-medium">{selectedIntimacao.processo_cnj}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Ação</label>
                  <p className="text-sm font-medium">{selectedIntimacao.processo_titulo}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tribunal</label>
                  <p className="text-sm font-medium">{selectedIntimacao.tribunal || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data</label>
                  <p className="text-sm font-medium">{formatDate(selectedIntimacao.data_intimacao)}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Conteúdo</label>
                <div className="mt-1 p-4 bg-muted/50 rounded-xl text-sm whitespace-pre-wrap">
                  {selectedIntimacao.conteudo || 'Sem conteúdo detalhado disponível.'}
                </div>
              </div>

              <div className="flex gap-2">
                {!selectedIntimacao.lida && (
                  <Button
                    onClick={() => handleMarkRead(selectedIntimacao.id)}
                    size="sm"
                    className="rounded-xl"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Marcar como lida
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
