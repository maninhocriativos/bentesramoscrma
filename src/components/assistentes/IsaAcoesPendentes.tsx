import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  ListTodo, 
  User, 
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AcaoPendente {
  id: string;
  created_at: string;
  lead_id: string | null;
  dados: {
    acao_sugerida: string;
    dados_acao: any;
    motivo: string;
    mensagem_original: string;
    analise: {
      intencao: string;
      sentimento: string;
      urgencia: string;
    };
  };
}

const ACAO_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  criar_tarefa: { 
    label: 'Criar Tarefa', 
    icon: <ListTodo className="h-4 w-4" />, 
    color: 'bg-blue-500' 
  },
  criar_compromisso: { 
    label: 'Agendar Compromisso', 
    icon: <Calendar className="h-4 w-4" />, 
    color: 'bg-purple-500' 
  },
  atualizar_status_lead: { 
    label: 'Atualizar Status', 
    icon: <User className="h-4 w-4" />, 
    color: 'bg-green-500' 
  },
  enviar_contrato: { 
    label: 'Enviar Contrato', 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'bg-orange-500' 
  },
};

const URGENCIA_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  baixa: { label: 'Baixa', variant: 'secondary' },
  media: { label: 'Média', variant: 'default' },
  alta: { label: 'Alta', variant: 'destructive' },
  urgente: { label: 'Urgente', variant: 'destructive' },
};

export function IsaAcoesPendentes() {
  const [acoes, setAcoes] = useState<AcaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchAcoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_events')
        .select('*')
        .eq('tipo', 'acao_pendente')
        .eq('processado', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAcoes(data as unknown as AcaoPendente[] || []);
    } catch (error) {
      console.error('Erro ao buscar ações pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcoes();

    // Realtime subscription
    const channel = supabase
      .channel('isa-acoes-pendentes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_events',
          filter: "tipo=eq.acao_pendente"
        },
        () => {
          fetchAcoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const aprovarAcao = async (acao: AcaoPendente) => {
    setProcessing(acao.id);
    try {
      const { error } = await supabase.functions.invoke('isa-actions', {
        body: {
          action: acao.dados.acao_sugerida,
          data: acao.dados.dados_acao,
        },
      });

      if (error) throw error;

      // Marcar como processado
      await supabase
        .from('system_events')
        .update({ processado: true })
        .eq('id', acao.id);

      toast.success('Ação executada com sucesso!');
      fetchAcoes();
    } catch (error) {
      console.error('Erro ao aprovar ação:', error);
      toast.error('Erro ao executar ação');
    } finally {
      setProcessing(null);
    }
  };

  const rejeitarAcao = async (acao: AcaoPendente) => {
    setProcessing(acao.id);
    try {
      // Marcar como processado (rejeitado)
      await supabase
        .from('system_events')
        .update({ 
          processado: true,
          metadata: { rejeitado: true, rejeitado_em: new Date().toISOString() }
        })
        .eq('id', acao.id);

      toast.info('Ação rejeitada');
      fetchAcoes();
    } catch (error) {
      console.error('Erro ao rejeitar ação:', error);
      toast.error('Erro ao rejeitar ação');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (acoes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Ações da Isa
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchAcoes}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma ação pendente de aprovação 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Ações Pendentes da Isa
            <Badge variant="secondary">{acoes.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchAcoes}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 p-4">
            {acoes.map((acao) => {
              const config = ACAO_CONFIG[acao.dados.acao_sugerida] || {
                label: acao.dados.acao_sugerida,
                icon: <AlertTriangle className="h-4 w-4" />,
                color: 'bg-gray-500',
              };
              const urgenciaConfig = URGENCIA_CONFIG[acao.dados.analise?.urgencia] || URGENCIA_CONFIG.media;

              return (
                <div 
                  key={acao.id} 
                  className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-sm transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${config.color} text-white`}>
                        {config.icon}
                      </div>
                      <div>
                        <p className="font-medium">{config.label}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(acao.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={urgenciaConfig.variant}>
                      {urgenciaConfig.label}
                    </Badge>
                  </div>

                  {/* Motivo */}
                  {acao.dados.motivo && (
                    <p className="text-sm text-muted-foreground">
                      {acao.dados.motivo}
                    </p>
                  )}

                  {/* Mensagem original */}
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Mensagem do cliente:</p>
                    <p className="italic">"{acao.dados.mensagem_original?.substring(0, 150)}{acao.dados.mensagem_original?.length > 150 ? '...' : ''}"</p>
                  </div>

                  {/* Detalhes da ação */}
                  {acao.dados.dados_acao && (
                    <div className="text-sm space-y-1">
                      {acao.dados.dados_acao.titulo && (
                        <p><span className="text-muted-foreground">Título:</span> {acao.dados.dados_acao.titulo}</p>
                      )}
                      {acao.dados.dados_acao.data_inicio && (
                        <p><span className="text-muted-foreground">Data:</span> {format(new Date(acao.dados.dados_acao.data_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      )}
                      {acao.dados.dados_acao.prioridade && (
                        <p><span className="text-muted-foreground">Prioridade:</span> {acao.dados.dados_acao.prioridade}</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => aprovarAcao(acao)}
                      disabled={processing === acao.id}
                    >
                      {processing === acao.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Aprovar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                      onClick={() => rejeitarAcao(acao)}
                      disabled={processing === acao.id}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
