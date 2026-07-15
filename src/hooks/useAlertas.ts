import { useMemo, useState, useEffect } from 'react';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';
import { differenceInDays, differenceInHours, isAfter, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface Alerta {
  id: string;
  tipo: 'risco' | 'prazo' | 'tarefa' | 'resposta';
  titulo: string;
  descricao: string;
  prioridade: 'alta' | 'media' | 'baixa';
  leadId?: string;
  processoId?: string;
}

export function useAlertas(leads: Lead[], processos: Processo[]) {
  const [alertasRetomada, setAlertasRetomada] = useState<Alerta[]>([]);
  const [alertasParcelas, setAlertasParcelas] = useState<Alerta[]>([]);
  const [alertasPrazos, setAlertasPrazos] = useState<Alerta[]>([]);

  // Buscar alertas de leads frios que responderam
  useEffect(() => {
    const fetchAlertasRetomada = async () => {
      const { data: events } = await supabase
        .from('system_events')
        .select('*')
        .eq('tipo', 'alerta')
        .eq('fonte', 'retomada')
        .eq('acao', 'lead_frio_respondeu')
        .eq('processado', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (events) {
        const alertas: Alerta[] = events.map((event) => ({
          id: `retomada-${event.id}`,
          tipo: 'resposta' as const,
          titulo: '🔥 Lead Frio Respondeu!',
          descricao: `${(event.dados as any)?.nome || 'Lead'} respondeu após retomada`,
          prioridade: 'alta' as const,
          leadId: event.lead_id || undefined,
        }));
        setAlertasRetomada(alertas);
      }
    };

    if (!(typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
      fetchAlertasRetomada();
    }

    // Subscribe para novos alertas em tempo real
    const channel = supabase
      .channel('alertas-retomada')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_events',
          filter: 'acao=eq.lead_frio_respondeu',
        },
        () => fetchAlertasRetomada()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Parcelas vencidas
  useEffect(() => {
    const fetchParcelasVencidas = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('parcelas')
        .select('id, valor, data_vencimento')
        .eq('status', 'Pendente')
        .lt('data_vencimento', today)
        .limit(20);
      if (data && data.length > 0) {
        const totalVencido = data.reduce((s, p) => s + Number(p.valor), 0);
        const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
        setAlertasParcelas([{
          id: 'parcelas-vencidas',
          tipo: 'risco',
          titulo: `${data.length} Parcela${data.length > 1 ? 's' : ''} Vencida${data.length > 1 ? 's' : ''}`,
          descricao: `${fmt.format(totalVencido)} em pagamentos pendentes`,
          prioridade: data.length >= 3 ? 'alta' : 'media',
        }]);
      } else {
        setAlertasParcelas([]);
      }
    };
    fetchParcelasVencidas();
    const interval = setInterval(fetchParcelasVencidas, 300_000);
    return () => clearInterval(interval);
  }, []);

  // Prazos fatais de tarefas vinculadas a processos, vencendo nos próximos 3 dias
  useEffect(() => {
    const fetchPrazosProcessos = async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const limite = addDays(now, 3).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('tarefas')
        .select('id, titulo, prazo_fatal, processo_id')
        .not('processo_id', 'is', null)
        .not('prazo_fatal', 'is', null)
        .gte('prazo_fatal', today)
        .lte('prazo_fatal', limite)
        .not('status', 'in', '("Concluída","Cancelada")')
        .order('prazo_fatal', { ascending: true })
        .limit(20);

      if (data) {
        const alertas: Alerta[] = data.map((t) => {
          const diasRestantes = differenceInDays(new Date(t.prazo_fatal as string), now);
          return {
            id: `deadline-${t.id}`,
            tipo: 'prazo' as const,
            titulo: 'Prazo Próximo',
            descricao: `${t.titulo} vence em ${diasRestantes} dia(s)`,
            prioridade: diasRestantes <= 1 ? 'alta' as const : 'media' as const,
            processoId: t.processo_id as string,
          };
        });
        setAlertasPrazos(alertas);
      }
    };
    fetchPrazosProcessos();
    const interval = setInterval(fetchPrazosProcessos, 300_000);
    return () => clearInterval(interval);
  }, []);

  const alertas = useMemo(() => {
    const now = new Date();
    const result: Alerta[] = [];

    // 1. Leads estagnados (Em Atendimento há mais de 5 dias)
    leads.forEach(lead => {
      if (lead.status === 'Em Atendimento') {
        const lastUpdate = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
        const diasParado = differenceInDays(now, lastUpdate);
        
        if (diasParado >= 5) {
          result.push({
            id: `stagnant-${lead.id}`,
            tipo: 'risco',
            titulo: 'Lead Estagnado',
            descricao: `${lead.nome || 'Lead sem nome'} está parado há ${diasParado} dias`,
            prioridade: diasParado >= 7 ? 'alta' : 'media',
            leadId: lead.id,
          });
        }
      }

      // 2. Leads aguardando contrato sem link
      if (lead.status === 'Aguardando Contrato' && !lead.link_contrato) {
        result.push({
          id: `contract-${lead.id}`,
          tipo: 'tarefa',
          titulo: 'Contrato Pendente',
          descricao: `Falta gerar contrato para ${lead.nome || 'lead'}`,
          prioridade: 'media',
          leadId: lead.id,
        });
      }
    });

    // 3. Leads de tráfego parados há mais de 48h (sem movimentação)
    const trafegoParados = leads.filter(lead => {
      if (lead.is_lost) return false;
      if (!['Lead Frio', 'Em Atendimento'].includes(lead.status || '')) return false;
      const isTraffic = (lead as any).tipo_origem === 'trafego' || lead.origem === 'Tráfego Pago';
      if (!isTraffic) return false;
      const lastActivity = (lead as any).last_contact_at || lead.updated_at || lead.created_at;
      return differenceInHours(now, new Date(lastActivity)) >= 48;
    });
    if (trafegoParados.length > 0) {
      const dias = Math.floor(differenceInHours(now, new Date(
        (trafegoParados[0] as any).last_contact_at || trafegoParados[0].updated_at || trafegoParados[0].created_at
      )) / 24);
      result.push({
        id: 'trafego-parado',
        tipo: 'risco',
        titulo: `${trafegoParados.length} Lead${trafegoParados.length > 1 ? 's' : ''} Tráfego Parado${trafegoParados.length > 1 ? 's' : ''}`,
        descricao: `Sem movimentação há ${dias}+ dias — verifique o follow-up`,
        prioridade: trafegoParados.length >= 5 ? 'alta' : 'media',
      });
    }

    // Ordenar por prioridade
    return [...alertasRetomada, ...alertasParcelas, ...alertasPrazos, ...result].sort((a, b) => {
      const prioridadeOrder = { alta: 0, media: 1, baixa: 2 };
      return prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
    });
  }, [leads, alertasRetomada, alertasParcelas, alertasPrazos]);

  return { alertas };
}

// Helper para determinar o status visual do lead (para indicadores coloridos)
export function getLeadIndicator(lead: Lead): 'red' | 'yellow' | 'green' | null {
  const now = new Date();
  const lastUpdate = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
  const createdAt = new Date(lead.created_at);
  
  const diasSemInteracao = differenceInDays(now, lastUpdate);
  const horasDesdeCreacao = differenceInHours(now, createdAt);

  // Sem interação há 7 dias = vermelho
  if (diasSemInteracao >= 7) {
    return 'red';
  }
  
  // Lead novo (menos de 24h) = amarelo
  if (horasDesdeCreacao < 24) {
    return 'yellow';
  }
  
  // Movimentado hoje = verde
  if (diasSemInteracao === 0) {
    return 'green';
  }

  return null;
}
