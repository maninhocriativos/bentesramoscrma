import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LeadExtra {
  leadId: string;
  ultimaInteracao: {
    resumo: string;
    data: string;
  } | null;
  temAgendamento: boolean;
  proximoAgendamento: {
    titulo: string;
    data: string;
  } | null;
}

export function useLeadExtras(leadIds: string[]) {
  const [extras, setExtras] = useState<Record<string, LeadExtra>>({});
  const [loading, setLoading] = useState(true);
  const alertsCreatedRef = useRef<Set<string>>(new Set());

  const stableLeadIds = useMemo(() => leadIds.sort().join(','), [leadIds]);

  useEffect(() => {
    if (leadIds.length === 0) {
      setExtras({});
      setLoading(false);
      return;
    }

    const fetchExtras = async () => {
      setLoading(true);
      
      try {
        // Buscar últimas interações
        const { data: interacoes } = await supabase
          .from('interacoes')
          .select('cliente_id, resumo, data_interacao')
          .in('cliente_id', leadIds)
          .order('data_interacao', { ascending: false });

        // Buscar compromissos futuros
        const now = new Date().toISOString();
        const { data: compromissos } = await supabase
          .from('compromissos')
          .select('lead_id, titulo, data_inicio')
          .in('lead_id', leadIds)
          .gte('data_inicio', now)
          .order('data_inicio', { ascending: true });

        // Buscar leads para verificar status
        const { data: leads } = await supabase
          .from('leads_juridicos')
          .select('id, status, nome')
          .in('id', leadIds);

        // Verificar alertas já criados para não duplicar
        const { data: existingAlerts } = await supabase
          .from('system_events')
          .select('lead_id')
          .eq('tipo', 'acao_pendente')
          .eq('processado', false)
          .in('lead_id', leadIds)
          .contains('dados', { acao_sugerida: 'agendar_atendimento' });

        const existingAlertLeadIds = new Set(existingAlerts?.map(a => a.lead_id) || []);

        // Organizar dados por lead
        const extrasMap: Record<string, LeadExtra> = {};

        for (const leadId of leadIds) {
          // Última interação do lead
          const ultimaInteracao = interacoes?.find(i => i.cliente_id === leadId);
          
          // Agendamentos do lead
          const agendamentosLead = compromissos?.filter(c => c.lead_id === leadId) || [];
          const proximoAgendamento = agendamentosLead[0];

          // Lead info
          const leadInfo = leads?.find(l => l.id === leadId);
          const isEmAtendimento = leadInfo?.status === 'Em Atendimento';
          const temAgendamento = agendamentosLead.length > 0;

          extrasMap[leadId] = {
            leadId,
            ultimaInteracao: ultimaInteracao ? {
              resumo: ultimaInteracao.resumo,
              data: ultimaInteracao.data_interacao
            } : null,
            temAgendamento,
            proximoAgendamento: proximoAgendamento ? {
              titulo: proximoAgendamento.titulo,
              data: proximoAgendamento.data_inicio
            } : null
          };

          // Criar alerta automático para Isa se lead em atendimento sem agendamento
          if (isEmAtendimento && !temAgendamento && 
              !existingAlertLeadIds.has(leadId) && 
              !alertsCreatedRef.current.has(leadId)) {
            
            alertsCreatedRef.current.add(leadId);
            
            // Criar ação pendente para a Isa
            await supabase.from('system_events').insert({
              tipo: 'acao_pendente',
              fonte: 'sistema',
              acao: 'alerta_agendamento',
              lead_id: leadId,
              dados: {
                acao_sugerida: 'agendar_atendimento',
                motivo: `Lead "${leadInfo?.nome || 'Sem nome'}" está em atendimento mas ainda não tem reunião agendada. Agende um atendimento para dar continuidade.`,
                mensagem_original: ultimaInteracao?.resumo || 'Lead em atendimento sem agendamento',
                analise: {
                  intencao: 'agendamento',
                  sentimento: 'neutro',
                  urgencia: 'alta'
                },
                dados_acao: {
                  lead_id: leadId,
                  lead_nome: leadInfo?.nome
                }
              }
            });
          }
        }

        setExtras(extrasMap);
      } catch (error) {
        console.error('Erro ao buscar extras dos leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExtras();
  }, [stableLeadIds]);

  return { extras, loading };
}
