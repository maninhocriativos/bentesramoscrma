import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Zap, Brain, CheckCircle2, XCircle, Clock,
  Users, MessageSquare, ListTodo,
  Calendar, RefreshCw, Loader2, Activity, Target, Settings,
  AlertTriangle, ScanSearch, ArrowRight, Bell,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IsaAcoesPendentes } from '@/components/assistentes/IsaAcoesPendentes';
import { IsaAutomacoesConfig } from '@/components/assistentes/IsaAutomacoesConfig';
import { FollowupTrafegoEstagnado } from '@/components/assistentes/FollowupTrafegoEstagnado';
import isaAvatar from '@/assets/isa-avatar.png';
import donnaAvatar from '@/assets/donna-avatar.png';

// ── Paleta ────────────────────────────────────────────────────────────────────
const AMBER_DARK = '#1a0e08';
const GOLD       = '#c9a96e';
const NAVY_DARK  = '#080d1a';
const BLUE_A     = '#5b8dd9';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Stats {
  leadsClassificados: number;
  interacoesRegistradas: number;
  tarefasCriadas: number;
  compromissosCriados: number;
  acoesAprovadas: number;
  acoesRejeitadas: number;
}

interface RecentAction {
  id: string;
  created_at: string;
  tipo: string;
  acao: string;
  processado: boolean;
  dados: any;
}

interface SystemAlert {
  id: string;
  agent: 'isa' | 'donna';
  priority: 'Alta' | 'Média';
  title: string;
  description: string;
  count: number;
}

interface AgentSettings {
  isa_auto_enabled: boolean;
  donna_enabled: boolean;
}

// ── Utilitários ───────────────────────────────────────────────────────────────

async function loadAgentSettings(): Promise<AgentSettings> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['isa_auto_enabled', 'donna_enabled']);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    return {
      isa_auto_enabled: map['isa_auto_enabled'] !== 'false',
      donna_enabled:    map['donna_enabled']    !== 'false',
    };
  } catch {
    return { isa_auto_enabled: true, donna_enabled: true };
  }
}

async function saveAgentSetting(key: string, value: boolean): Promise<void> {
  await supabase
    .from('app_settings')
    .upsert({ key, value: String(value) }, { onConflict: 'key' });
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function IsaAutonomaPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats>({
    leadsClassificados: 0,
    interacoesRegistradas: 0,
    tarefasCriadas: 0,
    compromissosCriados: 0,
    acoesAprovadas: 0,
    acoesRejeitadas: 0,
  });
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [loading, setLoading]             = useState(true);
  const [scanning, setScanning]           = useState(false);
  const [alerts, setAlerts]               = useState<SystemAlert[]>([]);
  const [lastScan, setLastScan]           = useState<Date | null>(null);
  const [settings, setSettings]           = useState<AgentSettings>({ isa_auto_enabled: true, donna_enabled: true });
  const [togglingKey, setTogglingKey]     = useState<string | null>(null);

  // ── Contadores de alertas por agente ────────────────────────────────────────
  const isaAlertCount   = alerts.filter(a => a.agent === 'isa').length;
  const donnaAlertCount = alerts.filter(a => a.agent === 'donna').length;

  // ── Carregar dados de performance ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const last7Days = subDays(startOfDay(new Date()), 7).toISOString();

      const { data: events } = await supabase
        .from('system_events')
        .select('id, acao, tipo, processado, metadata, created_at, fonte, dados')
        .or('fonte.eq.isa,fonte.eq.isa_auto,fonte.eq.isa_scheduler,fonte.eq.sistema')
        .gte('created_at', last7Days)
        .order('created_at', { ascending: false });

      if (events) {
        const leadsClassificados = events.filter(e =>
          e.acao === 'lead_classificado' || e.acao === 'dados_lead_atualizados' || e.acao === 'classificar_lead'
        ).length;
        const interacoesRegistradas = events.filter(e =>
          e.fonte === 'isa_auto' && e.processado
        ).length;
        const tarefasCriadas = events.filter(e =>
          e.acao === 'tarefa_criada' && e.processado
        ).length;
        const compromissosCriados = events.filter(e =>
          (e.acao === 'compromisso_criado' || e.acao === 'agendamento_confirmado_lead') && e.processado
        ).length;
        const pendentes        = events.filter(e => e.tipo === 'acao_pendente');
        const acoesAprovadas   = pendentes.filter(e => e.processado && !(e.metadata as any)?.rejeitado).length;
        const acoesRejeitadas  = pendentes.filter(e => e.processado && (e.metadata as any)?.rejeitado).length;

        setStats({ leadsClassificados, interacoesRegistradas, tarefasCriadas, compromissosCriados, acoesAprovadas, acoesRejeitadas });
        setRecentActions(events.slice(0, 30) as RecentAction[]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Varredura do sistema ──────────────────────────────────────────────────────
  const scanSystem = async () => {
    setScanning(true);
    const found: SystemAlert[] = [];
    const today         = new Date().toISOString().split('T')[0];
    const sevenDaysAgo  = subDays(new Date(), 7).toISOString();
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    try {
      // ── Isa: tarefas atrasadas ─────────────────────────────────────────────
      const { data: overdueTasks } = await supabase
        .from('tarefas')
        .select('id, titulo, data_limite')
        .lt('data_limite', today)
        .in('status', ['Pendente', 'Em Andamento']);

      if (overdueTasks && overdueTasks.length > 0) {
        found.push({
          id: 'isa-overdue-tasks',
          agent: 'isa',
          priority: 'Alta',
          title: 'Tarefas atrasadas',
          description: `${overdueTasks.length} tarefa(s) com prazo vencido aguardam ação`,
          count: overdueTasks.length,
        });
      }

      // ── Isa: leads sem contato +7d ─────────────────────────────────────────
      const { data: leadsNoContact } = await supabase
        .from('leads_juridicos')
        .select('id, nome, updated_at')
        .lt('updated_at', sevenDaysAgo)
        .in('status', ['Lead Frio', 'Em Negociação', 'Aguardando Contrato']);

      if (leadsNoContact && leadsNoContact.length > 0) {
        found.push({
          id: 'isa-leads-no-contact',
          agent: 'isa',
          priority: 'Alta',
          title: 'Leads sem contato há +7 dias',
          description: `${leadsNoContact.length} lead(s) ativo(s) sem atualização recente`,
          count: leadsNoContact.length,
        });
      }

      // ── Isa: leads aguardando contrato ────────────────────────────────────
      const { data: leadsAguardando } = await supabase
        .from('leads_juridicos')
        .select('id, nome, status')
        .eq('status', 'Aguardando Contrato');

      if (leadsAguardando && leadsAguardando.length > 0) {
        found.push({
          id: 'isa-leads-awaiting-contract',
          agent: 'isa',
          priority: 'Média',
          title: 'Leads aguardando contrato',
          description: `${leadsAguardando.length} lead(s) prontos para assinatura de contrato`,
          count: leadsAguardando.length,
        });
      }

      // ── Donn@: parcelas em atraso ─────────────────────────────────────────
      const { data: overdueParcelas } = await supabase
        .from('parcelas')
        .select('id, valor, data_vencimento')
        .lt('data_vencimento', today)
        .in('status', ['Pendente', 'Atrasado']);

      if (overdueParcelas && overdueParcelas.length > 0) {
        found.push({
          id: 'donna-overdue-parcelas',
          agent: 'donna',
          priority: 'Alta',
          title: 'Parcelas em atraso',
          description: `${overdueParcelas.length} parcela(s) com vencimento passado sem pagamento`,
          count: overdueParcelas.length,
        });
      }

      // ── Donn@: processos parados +30d ─────────────────────────────────────
      const { data: staleProcessos } = await supabase
        .from('processos')
        .select('id, titulo, updated_at')
        .lt('updated_at', thirtyDaysAgo);

      if (staleProcessos && staleProcessos.length > 0) {
        found.push({
          id: 'donna-stale-processos',
          agent: 'donna',
          priority: 'Média',
          title: 'Processos sem atualização',
          description: `${staleProcessos.length} processo(s) sem movimentação nos últimos 30 dias`,
          count: staleProcessos.length,
        });
      }
    } catch (err) {
      console.error('Erro na varredura:', err);
    }

    setAlerts(found);
    setLastScan(new Date());
    setScanning(false);
  };

  // ── Toggle de agente ──────────────────────────────────────────────────────────
  const handleToggle = async (key: keyof AgentSettings, value: boolean) => {
    setTogglingKey(key);
    setSettings(prev => ({ ...prev, [key]: value }));
    await saveAgentSetting(key, value);
    setTogglingKey(null);
  };

  // ── Realtime ──────────────────────────────────────────────────────────────────
  const handleNovoEvento = (novoEvento: any) => {
    const { acao, tipo, fonte, processado, metadata } = novoEvento;
    setStats(prev => ({
      ...prev,
      leadsClassificados:    prev.leadsClassificados + (acao === 'lead_classificado' || acao === 'dados_lead_atualizados' || acao === 'classificar_lead' ? 1 : 0),
      interacoesRegistradas: prev.interacoesRegistradas + (fonte === 'isa_auto' && processado ? 1 : 0),
      tarefasCriadas:        prev.tarefasCriadas + (acao === 'tarefa_criada' && processado ? 1 : 0),
      compromissosCriados:   prev.compromissosCriados + ((acao === 'compromisso_criado' || acao === 'agendamento_confirmado_lead') && processado ? 1 : 0),
      acoesAprovadas:        prev.acoesAprovadas + (tipo === 'acao_pendente' && processado && !metadata?.rejeitado ? 1 : 0),
      acoesRejeitadas:       prev.acoesRejeitadas + (tipo === 'acao_pendente' && processado && metadata?.rejeitado ? 1 : 0),
    }));
    setRecentActions(prev => [novoEvento as RecentAction, ...prev].slice(0, 30));
  };

  useEffect(() => {
    fetchData();
    loadAgentSettings().then(setSettings);

    const channel = supabase
      .channel('central-agentes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_events' }, (p) => handleNovoEvento(p.new))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // ── Sub-componentes ───────────────────────────────────────────────────────────

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color} text-white`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getActionIcon = (acao: string) => {
    switch (acao) {
      case 'classificar_lead': return <Users className="h-3 w-3" />;
      case 'criar_interacao':  return <MessageSquare className="h-3 w-3" />;
      case 'criar_tarefa':     return <ListTodo className="h-3 w-3" />;
      case 'criar_compromisso':return <Calendar className="h-3 w-3" />;
      default:                 return <Activity className="h-3 w-3" />;
    }
  };

  const getActionLabel = (acao: string) => {
    switch (acao) {
      case 'classificar_lead':  return 'Classificou lead';
      case 'criar_interacao':   return 'Registrou interação';
      case 'criar_tarefa':      return 'Criou tarefa';
      case 'criar_compromisso': return 'Agendou compromisso';
      case 'atualizar_resumo':  return 'Atualizou resumo';
      default:                  return acao;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <AppHeader title="Central de Agentes" />

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── Cabeçalho ── */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                Inteligência Artificial
              </p>
              <h1 className="text-2xl font-black text-foreground">Central de Agentes</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie, monitore e converse com os agentes do escritório
              </p>
            </div>
            <Button
              onClick={scanSystem}
              disabled={scanning}
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {scanning
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ScanSearch className="h-4 w-4" />
              }
              {scanning ? 'Analisando…' : 'Analisar Sistema'}
            </Button>
          </div>

          {lastScan && (
            <p className="text-[11px] text-muted-foreground -mt-4">
              Última varredura: {format(lastScan, "dd/MM 'às' HH:mm", { locale: ptBR })}
              {alerts.length === 0 && ' — nenhum alerta encontrado'}
              {alerts.length > 0  && ` — ${alerts.length} alerta(s) encontrado(s)`}
            </p>
          )}

          {/* ── Cards dos agentes ── */}
          <div className="grid md:grid-cols-3 gap-5">

            {/* ── Isa ── */}
            <div
              className="relative overflow-hidden rounded-2xl flex flex-col"
              style={{
                background: `linear-gradient(160deg, ${AMBER_DARK} 0%, #2d1810 50%, #3d2b1f 100%)`,
                border: `1px solid ${GOLD}35`,
                boxShadow: `0 20px 60px rgba(61,43,31,0.35), 0 4px 16px ${GOLD}15`,
              }}
            >
              <div style={{ height: 3, background: `linear-gradient(90deg, #3d2b1f, ${GOLD}, #3d2b1f)` }} />
              <div className="p-5 flex flex-col gap-4">
                {/* Avatar + nome */}
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={isaAvatar} alt="Isa" className="h-14 w-14 rounded-full object-cover object-top border-2 shadow-lg" style={{ borderColor: `${GOLD}60` }} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${settings.isa_auto_enabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">Isa</p>
                    <p className="text-[11px]" style={{ color: `${GOLD}cc` }}>Recepcionista IA · WhatsApp</p>
                  </div>
                  {isaAlertCount > 0 && (
                    <Badge className="ml-auto bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                      <Bell className="h-2.5 w-2.5 mr-1" />
                      {isaAlertCount}
                    </Badge>
                  )}
                </div>

                {/* Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/70">Processamento automático</span>
                  <Switch
                    checked={settings.isa_auto_enabled}
                    onCheckedChange={(v) => handleToggle('isa_auto_enabled', v)}
                    disabled={togglingKey === 'isa_auto_enabled'}
                    className="scale-90"
                  />
                </div>

                {/* Botão conversar */}
                <Button
                  onClick={() => navigate('/assistente')}
                  size="sm"
                  className="w-full gap-2 text-[#1a0e08] font-semibold"
                  style={{ background: `linear-gradient(90deg, ${GOLD}, #e8c07d)` }}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Conversar com Isa
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </div>
            </div>

            {/* ── Donn@ ── */}
            <div
              className="relative overflow-hidden rounded-2xl flex flex-col"
              style={{
                background: `linear-gradient(160deg, ${NAVY_DARK} 0%, #0d1a33 50%, #132145 100%)`,
                border: `1px solid ${BLUE_A}35`,
                boxShadow: `0 20px 60px rgba(8,13,26,0.5), 0 4px 16px ${BLUE_A}15`,
              }}
            >
              <div style={{ height: 3, background: `linear-gradient(90deg, #0d1a33, ${BLUE_A}, #0d1a33)` }} />
              <div className="p-5 flex flex-col gap-4">
                {/* Avatar + nome */}
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={donnaAvatar} alt="Donn@" className="h-14 w-14 rounded-full object-cover object-top border-2 shadow-lg" style={{ borderColor: `${BLUE_A}60` }} />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${settings.donna_enabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">Donn@</p>
                    <p className="text-[11px]" style={{ color: `${BLUE_A}cc` }}>Análise e Gestão · Relatórios</p>
                  </div>
                  {donnaAlertCount > 0 && (
                    <Badge className="ml-auto bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                      <Bell className="h-2.5 w-2.5 mr-1" />
                      {donnaAlertCount}
                    </Badge>
                  )}
                </div>

                {/* Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/70">Análise ativa</span>
                  <Switch
                    checked={settings.donna_enabled}
                    onCheckedChange={(v) => handleToggle('donna_enabled', v)}
                    disabled={togglingKey === 'donna_enabled'}
                    className="scale-90"
                  />
                </div>

                {/* Botão conversar */}
                <Button
                  onClick={() => navigate('/assistente')}
                  size="sm"
                  className="w-full gap-2 text-[#080d1a] font-semibold"
                  style={{ background: `linear-gradient(90deg, ${BLUE_A}, #7aa8e8)` }}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Conversar com Donn@
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </div>
            </div>

          </div>

          {/* ── Stats (últimos 7 dias da Isa) ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users}        label="Leads classificados"   value={stats.leadsClassificados}    color="bg-violet-500" />
            <StatCard icon={MessageSquare} label="Interações"            value={stats.interacoesRegistradas} color="bg-blue-500" />
            <StatCard icon={ListTodo}     label="Tarefas criadas"       value={stats.tarefasCriadas}        color="bg-emerald-500" />
            <StatCard icon={Calendar}     label="Compromissos"          value={stats.compromissosCriados}   color="bg-purple-500" />
            <StatCard icon={CheckCircle2} label="Ações aprovadas"       value={stats.acoesAprovadas}        color="bg-green-600" />
            <StatCard icon={XCircle}      label="Ações rejeitadas"      value={stats.acoesRejeitadas}       color="bg-red-500" />
          </div>

          {/* ── Tabs ── */}
          <Tabs defaultValue="alertas" className="space-y-4">
            <TabsList>
              <TabsTrigger value="alertas" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alertas
                {alerts.length > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-red-500 text-white border-0 rounded-full">
                    {alerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="gap-2">
                <Target className="h-4 w-4" />
                Pendentes
              </TabsTrigger>
              <TabsTrigger value="automacoes" className="gap-2">
                <Settings className="h-4 w-4" />
                Automações
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-2">
                <Activity className="h-4 w-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2">
                <Brain className="h-4 w-4" />
                Como Funciona
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Alertas ── */}
            <TabsContent value="alertas">
              {alerts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    {lastScan ? (
                      <>
                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                        <p className="font-semibold text-foreground">Nenhum alerta encontrado</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Os agentes verificaram o sistema e está tudo em ordem.
                        </p>
                      </>
                    ) : (
                      <>
                        <ScanSearch className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="font-semibold text-foreground">Varredura não executada</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Clique em "Analisar Sistema" para os agentes verificarem pendências.
                        </p>
                        <Button onClick={scanSystem} variant="outline" size="sm" className="mt-4 gap-2" disabled={scanning}>
                          <ScanSearch className="h-4 w-4" /> Analisar agora
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {(['Alta', 'Média'] as const).map(priority => {
                    const group = alerts.filter(a => a.priority === priority);
                    if (group.length === 0) return null;
                    return (
                      <div key={priority}>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className={`h-3.5 w-3.5 ${priority === 'Alta' ? 'text-red-500' : 'text-amber-500'}`} />
                          <span className={`text-xs font-bold uppercase tracking-wider ${priority === 'Alta' ? 'text-red-500' : 'text-amber-500'}`}>
                            Prioridade {priority}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {group.map(alert => (
                            <Card key={alert.id} className={`border-l-4 ${priority === 'Alta' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] py-0 h-4 ${alert.agent === 'isa' ? 'border-amber-500/50 text-amber-600' : 'border-blue-500/50 text-blue-600'}`}
                                      >
                                        {alert.agent === 'isa' ? 'Isa' : 'Donn@'}
                                      </Badge>
                                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                                  </div>
                                  <span className={`text-2xl font-black shrink-0 ${priority === 'Alta' ? 'text-red-500' : 'text-amber-500'}`}>
                                    {alert.count}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Pendentes ── */}
            <TabsContent value="pendentes">
              <IsaAcoesPendentes />
            </TabsContent>

            {/* ── Tab: Automações ── */}
            <TabsContent value="automacoes">
              <div className="space-y-4">
                <IsaAutomacoesConfig />
                <FollowupTrafegoEstagnado />
              </div>
            </TabsContent>

            {/* ── Tab: Histórico ── */}
            <TabsContent value="historico">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Ações Recentes (últimos 7 dias)
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="h-7 gap-1.5 text-xs">
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentActions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhuma ação registrada nos últimos 7 dias.
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="divide-y">
                        {recentActions.map((action) => (
                          <div key={action.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                            <div className="p-1.5 rounded bg-muted">
                              {getActionIcon(action.acao)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{getActionLabel(action.acao)}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(action.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            <Badge variant={action.processado ? 'secondary' : 'outline'} className="text-[10px]">
                              {action.tipo === 'acao_pendente'
                                ? (action.processado ? 'Processado' : 'Pendente')
                                : 'Automático'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Como Funciona ── */}
            <TabsContent value="config">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Ações Automáticas (Isa)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { title: 'Classificar Leads', desc: 'Analisa mensagens e atualiza status do lead automaticamente.' },
                      { title: 'Registrar Interações', desc: 'Cria registro de cada contato com análise de sentimento.' },
                      { title: 'Atualizar Resumo IA', desc: 'Mantém o resumo do lead atualizado com cada nova mensagem.' },
                    ].map(item => (
                      <div key={item.title} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      Ações com Aprovação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { title: 'Criar Tarefas', desc: 'Sugere tarefas de follow-up baseadas na urgência.' },
                      { title: 'Agendar Compromissos', desc: 'Propõe reuniões quando detecta interesse do cliente.' },
                      { title: 'Enviar Contrato', desc: 'Sugere envio de contrato quando lead está pronto.' },
                    ].map(item => (
                      <div key={item.title} className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
