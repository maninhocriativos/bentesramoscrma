import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ISA-CHECK] Iniciando verificação de agendamentos...');

    // 1. Buscar todos os leads em "Em Atendimento"
    const { data: leadsEmAtendimento, error: leadsError } = await supabase
      .from('leads_juridicos')
      .select('id, nome')
      .eq('status', 'Em Atendimento');

    if (leadsError) {
      console.error('[ISA-CHECK] Erro ao buscar leads:', leadsError);
      throw leadsError;
    }

    console.log(`[ISA-CHECK] Encontrados ${leadsEmAtendimento?.length || 0} leads em atendimento`);

    if (!leadsEmAtendimento || leadsEmAtendimento.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum lead em atendimento encontrado',
        processed: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const leadIds = leadsEmAtendimento.map(l => l.id);
    const now = new Date().toISOString();

    // 2. Buscar compromissos futuros para esses leads
    const { data: compromissos, error: compromissosError } = await supabase
      .from('compromissos')
      .select('lead_id, titulo, data_inicio')
      .in('lead_id', leadIds)
      .gte('data_inicio', now)
      .order('data_inicio', { ascending: true });

    if (compromissosError) {
      console.error('[ISA-CHECK] Erro ao buscar compromissos:', compromissosError);
      throw compromissosError;
    }

    // Mapear leads com agendamentos
    const leadsComAgendamento = new Set(compromissos?.map(c => c.lead_id) || []);
    console.log(`[ISA-CHECK] ${leadsComAgendamento.size} leads têm agendamentos futuros`);

    // 3. Buscar ações pendentes de agendamento
    const { data: acoesPendentes, error: acoesError } = await supabase
      .from('system_events')
      .select('id, lead_id, dados')
      .eq('tipo', 'acao_pendente')
      .eq('processado', false)
      .in('lead_id', leadIds);

    if (acoesError) {
      console.error('[ISA-CHECK] Erro ao buscar ações pendentes:', acoesError);
      throw acoesError;
    }

    let acoesResolvidas = 0;
    let alertasCriados = 0;

    // 4. Para cada lead, verificar e atualizar
    for (const lead of leadsEmAtendimento) {
      const temAgendamento = leadsComAgendamento.has(lead.id);

      if (temAgendamento) {
        // Lead tem agendamento - resolver ações pendentes de agendamento
        const acoesDoLead = acoesPendentes?.filter(a => 
          a.lead_id === lead.id && 
          (a.dados as any)?.acao_sugerida === 'agendar_atendimento'
        ) || [];

        for (const acao of acoesDoLead) {
          // Marcar ação como processada (resolvida automaticamente)
          const { error: updateError } = await supabase
            .from('system_events')
            .update({ 
              processado: true,
              dados: {
                ...(acao.dados as object),
                resolvido_automaticamente: true,
                resolvido_em: new Date().toISOString(),
                motivo_resolucao: 'Agendamento detectado automaticamente pela Isa'
              }
            })
            .eq('id', acao.id);

          if (!updateError) {
            acoesResolvidas++;
            console.log(`[ISA-CHECK] Ação ${acao.id} resolvida para lead ${lead.nome}`);
          }
        }
      } else {
        // Lead SEM agendamento - verificar se já existe alerta
        const alertaExistente = acoesPendentes?.find(a => 
          a.lead_id === lead.id && 
          (a.dados as any)?.acao_sugerida === 'agendar_atendimento'
        );

        if (!alertaExistente) {
          // Criar novo alerta
          const { error: insertError } = await supabase
            .from('system_events')
            .insert({
              tipo: 'acao_pendente',
              fonte: 'isa_automatica',
              acao: 'alerta_agendamento',
              lead_id: lead.id,
              dados: {
                acao_sugerida: 'agendar_atendimento',
                motivo: `Lead "${lead.nome || 'Sem nome'}" está em atendimento mas ainda não tem reunião agendada. Agende um atendimento para dar continuidade.`,
                mensagem_original: 'Verificação automática da Isa',
                analise: {
                  intencao: 'agendamento',
                  sentimento: 'neutro',
                  urgencia: 'alta'
                },
                dados_acao: {
                  lead_id: lead.id,
                  lead_nome: lead.nome
                },
                verificacao_automatica: true,
                verificado_em: new Date().toISOString()
              }
            });

          if (!insertError) {
            alertasCriados++;
            console.log(`[ISA-CHECK] Alerta criado para lead ${lead.nome}`);
          }
        }
      }
    }

    console.log(`[ISA-CHECK] Finalizado: ${acoesResolvidas} ações resolvidas, ${alertasCriados} alertas criados`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Verificação concluída',
      leadsVerificados: leadsEmAtendimento.length,
      leadsComAgendamento: leadsComAgendamento.size,
      acoesResolvidas,
      alertasCriados
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('[ISA-CHECK] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
