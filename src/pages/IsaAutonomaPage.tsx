import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, Brain, CheckCircle2, XCircle, Clock, 
  Users, MessageSquare, ListTodo, 
  Calendar, RefreshCw, Loader2, Activity, Target, Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IsaAcoesPendentes } from '@/components/assistentes/IsaAcoesPendentes';
import isaAvatar from '@/assets/isa-avatar.png';

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

export default function IsaAutonomaPage() {
  const [stats, setStats] = useState<Stats>({
    leadsClassificados: 0,
    interacoesRegistradas: 0,
    tarefasCriadas: 0,
    compromissosCriados: 0,
    acoesAprovadas: 0,
    acoesRejeitadas: 0,
  });
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const last7Days = subDays(startOfDay(new Date()), 7).toISOString();
      
      // Buscar eventos da Isa
      const { data: events } = await supabase
        .from('system_events')
        .select('*')
        .eq('fonte', 'isa')
        .gte('created_at', last7Days)
        .order('created_at', { ascending: false });

      if (events) {
        const leadsClassificados = events.filter(e => e.acao === 'classificar_lead').length;
        const interacoesRegistradas = events.filter(e => e.acao === 'criar_interacao').length;
        const tarefasCriadas = events.filter(e => e.acao === 'criar_tarefa' && e.processado).length;
        const compromissosCriados = events.filter(e => e.acao === 'criar_compromisso' && e.processado).length;
        
        const pendentes = events.filter(e => e.tipo === 'acao_pendente');
        const acoesAprovadas = pendentes.filter(e => e.processado && !e.metadata?.rejeitado).length;
        const acoesRejeitadas = pendentes.filter(e => e.processado && e.metadata?.rejeitado).length;

        setStats({
          leadsClassificados,
          interacoesRegistradas,
          tarefasCriadas,
          compromissosCriados,
          acoesAprovadas,
          acoesRejeitadas,
        });

        setRecentActions(events.slice(0, 20) as RecentAction[]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      case 'criar_interacao': return <MessageSquare className="h-3 w-3" />;
      case 'criar_tarefa': return <ListTodo className="h-3 w-3" />;
      case 'criar_compromisso': return <Calendar className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  const getActionLabel = (acao: string) => {
    switch (acao) {
      case 'classificar_lead': return 'Classificou lead';
      case 'criar_interacao': return 'Registrou interação';
      case 'criar_tarefa': return 'Criou tarefa';
      case 'criar_compromisso': return 'Agendou compromisso';
      case 'atualizar_resumo': return 'Atualizou resumo';
      default: return acao;
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Isa Autônoma" />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 text-white">
            {/* Background Effects */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-300 rounded-full blur-3xl" />
            </div>
            
            <div className="relative flex items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-xl scale-110" />
                  <img 
                    src={isaAvatar} 
                    alt="Isa" 
                    className="relative h-20 w-20 rounded-full object-cover object-top border-4 border-white/30 shadow-2xl"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center animate-pulse">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">Isa Autônoma</h1>
                    <Badge className="bg-white/20 text-white border-0 text-[10px] backdrop-blur-sm">
                      ATIVO
                    </Badge>
                  </div>
                  <p className="text-white/80 text-sm max-w-md">
                    Processamento automático de mensagens, classificação de leads e sugestão inteligente de ações.
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs">
                      <Brain className="w-3.5 h-3.5" />
                      IA Avançada
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      Tempo Real
                    </div>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={fetchData} 
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Leads classificados" value={stats.leadsClassificados} color="bg-violet-500" />
            <StatCard icon={MessageSquare} label="Interações" value={stats.interacoesRegistradas} color="bg-blue-500" />
            <StatCard icon={ListTodo} label="Tarefas criadas" value={stats.tarefasCriadas} color="bg-emerald-500" />
            <StatCard icon={Calendar} label="Compromissos" value={stats.compromissosCriados} color="bg-purple-500" />
            <StatCard icon={CheckCircle2} label="Aprovadas" value={stats.acoesAprovadas} color="bg-green-600" />
            <StatCard icon={XCircle} label="Rejeitadas" value={stats.acoesRejeitadas} color="bg-red-500" />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="pendentes" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pendentes" className="gap-2">
                <Target className="h-4 w-4" />
                Ações Pendentes
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

            <TabsContent value="pendentes">
              <IsaAcoesPendentes />
            </TabsContent>

            <TabsContent value="historico">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Ações Recentes (últimos 7 dias)
                  </CardTitle>
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
                            <Badge variant={action.processado ? "secondary" : "outline"} className="text-[10px]">
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

            <TabsContent value="config">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Ações Automáticas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Classificar Leads</p>
                        <p className="text-xs text-muted-foreground">
                          Analisa mensagens e atualiza status do lead automaticamente.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Registrar Interações</p>
                        <p className="text-xs text-muted-foreground">
                          Cria registro de cada contato com análise de sentimento.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Atualizar Resumo IA</p>
                        <p className="text-xs text-muted-foreground">
                          Mantém o resumo do lead atualizado com cada nova mensagem.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      Ações que Precisam Aprovação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Criar Tarefas</p>
                        <p className="text-xs text-muted-foreground">
                          Sugere tarefas de follow-up baseadas na urgência.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Agendar Compromissos</p>
                        <p className="text-xs text-muted-foreground">
                          Propõe reuniões quando detecta interesse do cliente.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Enviar Contrato</p>
                        <p className="text-xs text-muted-foreground">
                          Sugere envio de contrato quando lead está pronto.
                        </p>
                      </div>
                    </div>
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