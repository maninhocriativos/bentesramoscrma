import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // PAUSADO — aguardando validação completa do fluxo de agendamentos
  const ATIVO = false;
  if (!ATIVO) {
    console.log('[ISA-CHECK] Função pausada (ATIVO=false)');
    return new Response(JSON.stringify({ success: true, paused: true, message: 'Função pausada temporariamente' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ISA-CHECK] Iniciando verificação de agendamentos...');

    // 1. Buscar todos os leads em "Em Atendimento" ou "Em Negociação"
    const { data: leadsEmAtendimento, error: leadsError } = await supabase
      .from('leads_juridicos')
      .select('id, nome, status')
      .in('status', ['Em Atendimento', 'Em Negociação']);

    if (leadsError) {
      console.error('[ISA-CHECK] Erro ao buscar leads:', leadsError);
      throw leadsError;
    }

    console.log(`[ISA-CHECK] Encontrados ${leadsEmAtendimento?.length || 0} leads em atendimento/negociação`);

    if (!leadsEmAtendimento || leadsEmAtendimento.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum lead em atendimento encontrado',
        processed: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const leadIds = leadsEmAtendimento.map(l => l.id);

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const sinceIso = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Buscar compromissos recentes (últimos 30 dias) e futuros.
    //    Importante: alguns compromissos foram criados sem lead_id; nesses casos usamos o padrão "Atendimento - {NOME}".
    const { data: compromissos, error: compromissosError } = await supabase
      .from('compromissos')
      .select('id, lead_id, titulo, data_inicio')
      .gte('data_inicio', sinceIso)
      .or(
        `lead_id.in.(${leadIds.join(',')}),and(lead_id.is.null,titulo.ilike.%Atendimento - %)`
      )
      .order('data_inicio', { ascending: true });

    if (compromissosError) {
      console.error('[ISA-CHECK] Erro ao buscar compromissos:', compromissosError);
      throw compromissosError;
    }

    const normalize = (v: string | null | undefined) => (v || '').trim().toLowerCase();
    const extractNomeAtendimento = (titulo: string | null | undefined) => {
      const t = (titulo || '').trim();
      const m = t.match(/^Atendimento\s*-\s*(.+)$/i);
      return m?.[1]?.trim() || null;
    };

    const leadByNome = new Map<string, { id: string; nome: string | null }>();
    for (const lead of leadsEmAtendimento) {
      leadByNome.set(normalize(lead.nome), { id: lead.id, nome: lead.nome });
    }

    const compromissosPorLead = new Map<string, Array<{ id: string; data_inicio: string; titulo: string | null }>>();
    let compromissosVinculados = 0;

    for (const c of compromissos || []) {
      if (c.lead_id && leadIds.includes(c.lead_id)) {
        const arr = compromissosPorLead.get(c.lead_id) || [];
        arr.push({ id: c.id, data_inicio: c.data_inicio, titulo: c.titulo });
        compromissosPorLead.set(c.lead_id, arr);
        continue;
      }

      // Tentar vincular compromissos sem lead_id via padrão "Atendimento - Nome"
      if (!c.lead_id) {
        const nome = extractNomeAtendimento(c.titulo);
        if (!nome) continue;

        const match = leadByNome.get(normalize(nome));
        if (!match) continue;

        // Atualizar compromisso para garantir que o Kanban/Agenda reconheçam
        const { error: vincularError } = await supabase
          .from('compromissos')
          .update({ lead_id: match.id })
          .eq('id', c.id);

        if (!vincularError) {
          compromissosVinculados++;
          const arr = compromissosPorLead.get(match.id) || [];
          arr.push({ id: c.id, data_inicio: c.data_inicio, titulo: c.titulo });
          compromissosPorLead.set(match.id, arr);
          console.log(`[ISA-CHECK] Compromisso ${c.id} vinculado ao lead ${match.nome || match.id}`);
        }
      }
    }

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
      const compromissosLead = compromissosPorLead.get(lead.id) || [];
      const temAgendamento = compromissosLead.length > 0;

      if (temAgendamento) {
        // Lead tem compromisso recente/futuro - resolver ações pendentes de agendamento
        const acoesDoLead = acoesPendentes?.filter(a =>
          a.lead_id === lead.id &&
          (a.dados as any)?.acao_sugerida === 'agendar_atendimento'
        ) || [];

        for (const acao of acoesDoLead) {
          const { error: updateError } = await supabase
            .from('system_events')
            .update({
              processado: true,
              dados: {
                ...(acao.dados as object),
                resolvido_automaticamente: true,
                resolvido_em: new Date().toISOString(),
                motivo_resolucao: 'Compromisso detectado automaticamente pela Isa'
              }
            })
            .eq('id', acao.id);

          if (!updateError) {
            acoesResolvidas++;
            console.log(`[ISA-CHECK] Ação ${acao.id} resolvida para lead ${lead.nome}`);
          }
        }
      } else {
        // Lead SEM compromisso - verificar se já existe alerta
        const alertaExistente = acoesPendentes?.find(a =>
          a.lead_id === lead.id &&
          (a.dados as any)?.acao_sugerida === 'agendar_atendimento'
        );

        if (!alertaExistente) {
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

    console.log(`[ISA-CHECK] Finalizado: ${acoesResolvidas} ações resolvidas, ${alertasCriados} alertas criados, ${compromissosVinculados} compromissos vinculados`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Verificação concluída',
      leadsVerificados: leadsEmAtendimento.length,
      acoesResolvidas,
      alertasCriados,
      compromissosVinculados,
      since: sinceIso,
      now: nowIso
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
