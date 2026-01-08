import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatarDataHora, formatarData, formatarHora } from '../_shared/timezone-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Aliases para compatibilidade
const formatarDataHoraManaus = formatarDataHora;
const formatarDataManaus = formatarData;
const formatarHoraManaus = formatarHora;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Datas de referência
    const hoje = new Date();
    const seteDias = new Date(hoje);
    seteDias.setDate(seteDias.getDate() + 7);
    const vintQuatroHoras = new Date(hoje);
    vintQuatroHoras.setHours(vintQuatroHoras.getHours() - 24);

    // Buscar compromissos dos próximos 7 dias
    const { data: compromissos } = await supabase
      .from('compromissos')
      .select('*, leads_juridicos(nome)')
      .gte('data_inicio', hoje.toISOString())
      .lte('data_inicio', seteDias.toISOString())
      .order('data_inicio', { ascending: true });

    // Buscar tarefas pendentes
    const { data: tarefas } = await supabase
      .from('tarefas')
      .select('*, leads_juridicos(nome), processos(titulo_acao)')
      .in('status', ['Pendente', 'Em Andamento'])
      .order('data_limite', { ascending: true })
      .limit(30);

    // Buscar leads por status
    const { data: leads } = await supabase
      .from('leads_juridicos')
      .select('id, nome, status, tipo_acao, valor_causa, telefone, email, origem, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);

    // Contar leads por status
    const leadsPorStatus = leads?.reduce((acc: Record<string, number>, lead) => {
      const status = lead.status || 'Sem status';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Buscar processos ativos
    const { data: processos } = await supabase
      .from('processos')
      .select('*, leads_juridicos(nome)')
      .eq('status', 'Em Andamento')
      .order('created_at', { ascending: false })
      .limit(20);

    // Buscar parcelas pendentes/vencidas
    const { data: parcelas } = await supabase
      .from('parcelas')
      .select('*, honorarios(cliente_id, leads_juridicos:cliente_id(nome))')
      .in('status', ['Pendente', 'Vencida'])
      .order('data_vencimento', { ascending: true })
      .limit(20);

    // Buscar despesas pendentes
    const { data: despesas } = await supabase
      .from('despesas')
      .select('*, leads_juridicos(nome)')
      .eq('status', 'Pendente')
      .order('data_despesa', { ascending: false })
      .limit(10);

    // Buscar interações recentes (últimas 24h)
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*, leads_juridicos(nome)')
      .gte('data_interacao', vintQuatroHoras.toISOString())
      .order('data_interacao', { ascending: false })
      .limit(20);

    // Buscar eventos do sistema (últimas 24h) - NOVO
    const { data: systemEvents } = await supabase
      .from('system_events')
      .select('id, tipo, fonte, acao, entidade_tipo, dados, created_at, lead_id')
      .gte('created_at', vintQuatroHoras.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Buscar follow-ups pendentes - NOVO
    const { data: followups } = await supabase
      .from('lead_followups')
      .select('*, leads_juridicos(nome, status)')
      .eq('status', 'pendente')
      .order('proximo_followup', { ascending: true })
      .limit(20);

    // Buscar ações pendentes da Isa - NOVO
    const { data: acoesPendentes } = await supabase
      .from('isa_pending_actions')
      .select('*, leads_juridicos(nome)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar configurações de automação - NOVO
    const { data: automacoesConfig } = await supabase
      .from('app_settings')
      .select('*')
      .in('key', ['isa_auto_followup', 'isa_auto_classify', 'isa_auto_schedule', 'isa_auto_tasks']);

    // Montar resumo do sistema
    const systemData = {
      dataConsulta: formatarDataHoraManaus(hoje.toISOString()),
      fusoHorario: 'America/Manaus (UTC-4)',
      
      resumo: {
        totalLeads: leads?.length || 0,
        leadsPorStatus,
        totalProcessosAtivos: processos?.length || 0,
        totalTarefasPendentes: tarefas?.length || 0,
        totalCompromissosProximos7Dias: compromissos?.length || 0,
        totalParcelasPendentes: parcelas?.length || 0,
        totalDespesasPendentes: despesas?.length || 0,
        totalEventosUltimas24h: systemEvents?.length || 0,
        totalFollowupsPendentes: followups?.length || 0,
        totalAcoesPendentesIsa: acoesPendentes?.length || 0,
      },

      // Compromissos formatados
      compromissos: compromissos?.map(c => ({
        id: c.id,
        titulo: c.titulo,
        tipo: c.tipo,
        data: formatarDataHoraManaus(c.data_inicio),
        horarioInicio: formatarHoraManaus(c.data_inicio),
        horarioFim: c.data_fim ? formatarHoraManaus(c.data_fim) : null,
        cliente: c.leads_juridicos?.nome,
        clienteId: c.lead_id,
        descricao: c.descricao,
        local: c.local,
        status: c.status
      })) || [],

      // Tarefas formatadas
      tarefas: tarefas?.map(t => ({
        id: t.id,
        titulo: t.titulo,
        status: t.status,
        prioridade: t.prioridade,
        dataLimite: t.data_limite ? formatarDataManaus(t.data_limite) : null,
        cliente: t.leads_juridicos?.nome,
        clienteId: t.cliente_id,
        processo: t.processos?.titulo_acao,
        descricao: t.descricao
      })) || [],

      // Leads formatados
      leads: leads?.map(l => ({
        id: l.id,
        nome: l.nome,
        status: l.status,
        tipoAcao: l.tipo_acao,
        valorCausa: l.valor_causa,
        telefone: l.telefone,
        email: l.email,
        origem: l.origem,
        criadoEm: formatarDataManaus(l.created_at),
        atualizadoEm: formatarDataHoraManaus(l.updated_at)
      })) || [],

      // Processos formatados
      processos: processos?.map(p => ({
        id: p.id,
        numeroProcesso: p.numero_processo,
        tituloAcao: p.titulo_acao,
        status: p.status,
        cliente: p.leads_juridicos?.nome,
        clienteId: p.cliente_id,
        advogadoResponsavel: p.advogado_responsavel,
        tribunal: p.tribunal
      })) || [],

      // Parcelas formatadas
      parcelas: parcelas?.map(p => ({
        id: p.id,
        numero: p.numero,
        valor: p.valor,
        dataVencimento: formatarDataManaus(p.data_vencimento),
        status: p.status,
        cliente: p.honorarios?.leads_juridicos?.nome
      })) || [],

      // Despesas formatadas
      despesas: despesas?.map(d => ({
        id: d.id,
        descricao: d.descricao,
        tipo: d.tipo,
        valor: d.valor,
        status: d.status,
        cliente: d.leads_juridicos?.nome,
        clienteId: d.cliente_id
      })) || [],

      // Interações recentes (últimas 24h)
      interacoesRecentes: interacoes?.map(i => ({
        id: i.id,
        tipo: i.tipo,
        resumo: i.resumo,
        data: formatarDataHoraManaus(i.data_interacao),
        cliente: i.leads_juridicos?.nome,
        clienteId: i.cliente_id,
        direcao: i.direcao
      })) || [],

      // Eventos do sistema (últimas 24h) - NOVO
      eventosRecentes: systemEvents?.map(e => ({
        id: e.id,
        tipo: e.tipo,
        fonte: e.fonte,
        acao: e.acao,
        entidade: e.entidade_tipo,
        clienteId: e.lead_id,
        dados: e.dados,
        data: formatarDataHoraManaus(e.created_at)
      })) || [],

      // Follow-ups pendentes - NOVO
      followupsPendentes: followups?.map(f => ({
        id: f.id,
        cliente: f.leads_juridicos?.nome,
        clienteId: f.lead_id,
        statusLead: f.leads_juridicos?.status,
        tipo: f.tipo,
        tentativa: f.tentativa,
        proximoFollowup: formatarDataHoraManaus(f.proximo_followup),
        ultimaInteracao: f.ultima_interacao ? formatarDataHoraManaus(f.ultima_interacao) : null
      })) || [],

      // Ações pendentes da Isa - NOVO
      acoesPendentesIsa: acoesPendentes?.map(a => ({
        id: a.id,
        tipo: a.action_type,
        titulo: a.title,
        descricao: a.description,
        cliente: a.leads_juridicos?.nome,
        clienteId: a.lead_id,
        dados: a.action_data,
        criadoEm: formatarDataHoraManaus(a.created_at)
      })) || [],

      // Configurações de automação - NOVO
      configuracoesAutomacao: automacoesConfig?.reduce((acc: Record<string, boolean>, config) => {
        acc[config.key] = config.value === 'true' || config.value === true;
        return acc;
      }, {}) || {},

      // Horários de agendamento permitidos (regras do sistema)
      regrasAgendamento: {
        diasPermitidos: ['Segunda', 'Quarta', 'Sexta'],
        horariosPermitidos: '09:00-12:00 e 14:00-17:00',
        duracao: '1 hora',
        intervaloMinimo: '1 hora',
        timezone: 'America/Manaus'
      }
    };

    return new Response(JSON.stringify(systemData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao buscar dados do sistema:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
