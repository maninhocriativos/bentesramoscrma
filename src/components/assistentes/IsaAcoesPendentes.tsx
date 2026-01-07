import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  ListTodo, 
  User, 
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AcaoPendente {
  id: string;
  created_at: string;
  lead_id: string | null;
  acao: string;
  fonte: string;
  dados: {
    acao_sugerida?: string;
    dados_acao?: any;
    motivo?: string;
    mensagem_original?: string;
    analise?: {
      intencao?: string;
      sentimento?: string;
      urgencia?: string;
    };
    lead_nome?: string;
  };
  lead?: {
    nome: string;
    telefone?: string;
    status?: string;
  } | null;
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
  solicitar_agendamento: { 
    label: 'Solicitar Agendamento', 
    icon: <Calendar className="h-4 w-4" />, 
    color: 'bg-amber-500' 
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
  agendar_atendimento: { 
    label: 'Agendar Atendimento', 
    icon: <Calendar className="h-4 w-4" />, 
    color: 'bg-amber-500' 
  },
  acao_sugerida: { 
    label: 'Ação Sugerida', 
    icon: <MessageSquare className="h-4 w-4" />, 
    color: 'bg-indigo-500' 
  },
  alerta_agendamento: { 
    label: 'Alerta de Agendamento', 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'bg-red-500' 
  },
};

const URGENCIA_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  baixa: { label: 'Baixa', variant: 'secondary' },
  media: { label: 'Média', variant: 'default' },
  média: { label: 'Média', variant: 'default' },
  alta: { label: 'Alta', variant: 'destructive' },
  urgente: { label: 'Urgente', variant: 'destructive' },
};

export function IsaAcoesPendentes() {
  const [acoes, setAcoes] = useState<AcaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  
  // Modal de agendamento
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedAcao, setSelectedAcao] = useState<AcaoPendente | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00');

  const removeWithAnimation = (id: string, callback: () => Promise<void>) => {
    setRemovingIds(prev => new Set(prev).add(id));
    
    // Aguarda a animação completar antes de executar a ação
    setTimeout(async () => {
      await callback();
      setAcoes(prev => prev.filter(a => a.id !== id));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

  const fetchAcoes = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar ações pendentes com dados do lead
      const { data, error } = await supabase
        .from('system_events')
        .select(`
          id,
          created_at,
          lead_id,
          acao,
          fonte,
          dados,
          leads_juridicos!system_events_lead_id_fkey (
            nome,
            telefone,
            status
          )
        `)
        .eq('tipo', 'acao_pendente')
        .or('processado.eq.false,processado.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro na query:', error);
        throw error;
      }

      console.log('Ações pendentes encontradas:', data?.length, data);

      // Mapear dados com informações do lead
      const acoesComLead = (data || []).map((item: any) => ({
        ...item,
        lead: item.leads_juridicos,
      })) as AcaoPendente[];

      setAcoes(acoesComLead);
    } catch (error) {
      console.error('Erro ao buscar ações pendentes:', error);
      toast.error('Erro ao carregar ações pendentes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcoes();

    // Realtime subscription para ações pendentes
    const channel = supabase
      .channel('isa-acoes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_events',
        },
        (payload) => {
          console.log('🔔 Novo evento:', payload.new);
          if ((payload.new as any)?.tipo === 'acao_pendente') {
            fetchAcoes();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_events',
        },
        (payload) => {
          console.log('🔄 Evento atualizado:', payload.new);
          if ((payload.new as any)?.tipo === 'acao_pendente') {
            fetchAcoes();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAcoes]);

  // Pega o tipo de ação sugerida (pode vir de diferentes campos)
  const getAcaoSugerida = (acao: AcaoPendente): string => {
    return acao.dados?.acao_sugerida || acao.acao || 'acao_sugerida';
  };

  // Verifica se a ação é de agendamento
  const isAgendamentoAction = (acao: AcaoPendente) => {
    const acaoSugerida = getAcaoSugerida(acao);
    return ['criar_compromisso', 'solicitar_agendamento', 'agendar_atendimento'].includes(acaoSugerida);
  };

  // Pega o nome do lead
  const getLeadNome = (acao: AcaoPendente): string => {
    return acao.lead?.nome || 
           acao.dados?.dados_acao?.lead_nome || 
           acao.dados?.lead_nome || 
           'Cliente';
  };

  // Pega a urgência
  const getUrgencia = (acao: AcaoPendente): string => {
    return acao.dados?.analise?.urgencia || 'media';
  };

  const handleAprovar = (acao: AcaoPendente) => {
    if (isAgendamentoAction(acao)) {
      setSelectedAcao(acao);
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
      setSelectedTime('10:00');
      setShowDateModal(true);
    } else {
      aprovarAcao(acao);
    }
  };

  const aprovarComData = async () => {
    if (!selectedAcao || !selectedDate || !selectedTime) {
      toast.error('Selecione uma data e horário');
      return;
    }

    const acaoId = selectedAcao.id;
    setProcessing(acaoId);
    setShowDateModal(false);
    
    removeWithAnimation(acaoId, async () => {
      try {
        const dataHoraAgendamento = new Date(`${selectedDate}T${selectedTime}:00`);
        
        const dadosComData = {
          ...selectedAcao.dados?.dados_acao,
          lead_id: selectedAcao.lead_id,
          titulo: `Atendimento - ${getLeadNome(selectedAcao)}`,
          tipo: 'Reunião',
          data_inicio: dataHoraAgendamento.toISOString(),
          data_fim: new Date(dataHoraAgendamento.getTime() + 60 * 60 * 1000).toISOString(),
        };

        const { error } = await supabase.functions.invoke('isa-actions', {
          body: {
            action: 'criar_compromisso',
            data: dadosComData,
          },
        });

        if (error) throw error;

        // Marcar como processado
        await supabase
          .from('system_events')
          .update({ processado: true })
          .eq('id', acaoId);

        toast.success(`Agendamento criado para ${format(dataHoraAgendamento, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
        setSelectedAcao(null);
      } catch (error) {
        console.error('Erro ao aprovar ação com data:', error);
        toast.error('Erro ao executar ação');
      } finally {
        setProcessing(null);
      }
    });
  };

  const aprovarAcao = async (acao: AcaoPendente) => {
    setProcessing(acao.id);
    
    removeWithAnimation(acao.id, async () => {
      try {
        const acaoSugerida = getAcaoSugerida(acao);
        
        const { error } = await supabase.functions.invoke('isa-actions', {
          body: {
            action: acaoSugerida,
            data: {
              ...acao.dados?.dados_acao,
              lead_id: acao.lead_id,
            },
          },
        });

        if (error) throw error;

        // Marcar como processado
        await supabase
          .from('system_events')
          .update({ processado: true })
          .eq('id', acao.id);

        toast.success('Ação executada com sucesso!');
      } catch (error) {
        console.error('Erro ao aprovar ação:', error);
        toast.error('Erro ao executar ação');
      } finally {
        setProcessing(null);
      }
    });
  };

  const rejeitarAcao = async (acao: AcaoPendente) => {
    setProcessing(acao.id);
    
    removeWithAnimation(acao.id, async () => {
      try {
        const { error } = await supabase
          .from('system_events')
          .update({ 
            processado: true,
            metadata: { rejeitado: true, rejeitado_em: new Date().toISOString() }
          })
          .eq('id', acao.id);

        if (error) throw error;

        toast.info('Ação rejeitada');
      } catch (error) {
        console.error('Erro ao rejeitar ação:', error);
        toast.error('Erro ao rejeitar ação');
      } finally {
        setProcessing(null);
      }
    });
  };

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando ações...</span>
        </CardContent>
      </Card>
    );
  }

  if (acoes.length === 0) {
    return (
      <Card className="border-dashed border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="font-medium text-foreground mb-1">Tudo em dia!</p>
          <p className="text-sm text-muted-foreground">
            Nenhuma ação pendente de aprovação
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchAcoes}
            className="mt-3 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Atualizar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 shadow-lg">
      <CardHeader className="pb-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500 text-white animate-pulse">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Ações Pendentes</CardTitle>
              <p className="text-xs text-muted-foreground">Aguardando sua aprovação</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500 text-white hover:bg-amber-600 animate-pulse">
              {acoes.length}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchAcoes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <div className="p-3 space-y-3">
            {acoes.map((acao) => {
              const acaoSugerida = getAcaoSugerida(acao);
              const config = ACAO_CONFIG[acaoSugerida] || {
                label: acaoSugerida.replace(/_/g, ' '),
                icon: <AlertTriangle className="h-4 w-4" />,
                color: 'bg-gray-500',
              };
              const urgencia = getUrgencia(acao);
              const urgenciaConfig = URGENCIA_CONFIG[urgencia] || URGENCIA_CONFIG.media;
              const leadNome = getLeadNome(acao);
              const isRemoving = removingIds.has(acao.id);

              return (
                <div 
                  key={acao.id} 
                  className={`border rounded-xl p-3 space-y-2.5 bg-card hover:shadow-md transition-all duration-300 ${
                    isRemoving ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100 scale-100 translate-x-0'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${config.color} text-white`}>
                        {config.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{config.label}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(acao.created_at), { locale: ptBR, addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={urgenciaConfig.variant}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {urgenciaConfig.label}
                    </Badge>
                  </div>

                  {/* Lead Info */}
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{leadNome}</span>
                    {acao.lead?.status && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">
                        {acao.lead.status}
                      </Badge>
                    )}
                  </div>

                  {/* Motivo */}
                  {acao.dados?.motivo && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {acao.dados.motivo}
                    </p>
                  )}

                  {/* Mensagem original */}
                  {acao.dados?.mensagem_original && (
                    <div className="bg-muted/50 rounded-lg p-2.5 text-xs">
                      <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" />
                        Mensagem:
                      </p>
                      <p className="italic text-muted-foreground line-clamp-2">
                        "{acao.dados.mensagem_original?.substring(0, 120)}{(acao.dados.mensagem_original?.length || 0) > 120 ? '...' : ''}"
                      </p>
                    </div>
                  )}

                  {/* Análise da IA */}
                  {acao.dados?.analise?.intencao && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Intenção:</span>{' '}
                      <span className="font-medium">{acao.dados.analise.intencao}</span>
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleAprovar(acao)}
                      disabled={processing === acao.id}
                    >
                      {processing === acao.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      {isAgendamentoAction(acao) ? 'Agendar' : 'Aprovar'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1 h-8 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                      onClick={() => rejeitarAcao(acao)}
                      disabled={processing === acao.id}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Modal de seleção de data para agendamento */}
      <Dialog open={showDateModal} onOpenChange={setShowDateModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Escolha a data do agendamento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
              />
            </div>

            {selectedAcao && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground text-xs mb-1">Lead:</p>
                <p className="font-medium">{getLeadNome(selectedAcao)}</p>
                {selectedAcao.lead?.telefone && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedAcao.lead.telefone}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDateModal(false);
                setSelectedAcao(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={aprovarComData}
              disabled={!selectedDate || !selectedTime || processing !== null}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
