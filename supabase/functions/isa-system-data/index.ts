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

    // Buscar compromissos dos próximos 7 dias
    const hoje = new Date();
    const seteDias = new Date(hoje);
    seteDias.setDate(seteDias.getDate() + 7);

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
      .limit(20);

    // Buscar leads por status
    const { data: leads } = await supabase
      .from('leads_juridicos')
      .select('id, nome, status, tipo_acao, valor_causa, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

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

    // Buscar interações recentes
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*, leads_juridicos(nome)')
      .order('data_interacao', { ascending: false })
      .limit(10);

    // Montar resumo do sistema
    const systemData = {
      dataConsulta: hoje.toISOString(),
      resumo: {
        totalLeads: leads?.length || 0,
        leadsPorStatus,
        totalProcessosAtivos: processos?.length || 0,
        totalTarefasPendentes: tarefas?.length || 0,
        totalCompromissosProximos7Dias: compromissos?.length || 0,
        totalParcelasPendentes: parcelas?.length || 0,
        totalDespesasPendentes: despesas?.length || 0,
      },
      compromissos: compromissos?.map(c => ({
        titulo: c.titulo,
        tipo: c.tipo,
        data: formatarDataHoraManaus(c.data_inicio),
        horario: formatarHoraManaus(c.data_inicio),
        cliente: c.leads_juridicos?.nome,
        descricao: c.descricao
      })) || [],
      tarefas: tarefas?.map(t => ({
        titulo: t.titulo,
        status: t.status,
        prioridade: t.prioridade,
        dataLimite: t.data_limite ? formatarDataManaus(t.data_limite) : null,
        cliente: t.leads_juridicos?.nome,
        processo: t.processos?.titulo_acao
      })) || [],
      leads: leads?.map(l => ({
        nome: l.nome,
        status: l.status,
        tipoAcao: l.tipo_acao,
        valorCausa: l.valor_causa
      })) || [],
      processos: processos?.map(p => ({
        numeroProcesso: p.numero_processo,
        tituloAcao: p.titulo_acao,
        status: p.status,
        cliente: p.leads_juridicos?.nome,
        advogadoResponsavel: p.advogado_responsavel
      })) || [],
      parcelas: parcelas?.map(p => ({
        numero: p.numero,
        valor: p.valor,
        dataVencimento: formatarDataManaus(p.data_vencimento),
        status: p.status,
        cliente: p.honorarios?.leads_juridicos?.nome
      })) || [],
      despesas: despesas?.map(d => ({
        descricao: d.descricao,
        tipo: d.tipo,
        valor: d.valor,
        status: d.status,
        cliente: d.leads_juridicos?.nome
      })) || [],
      interacoesRecentes: interacoes?.map(i => ({
        tipo: i.tipo,
        resumo: i.resumo,
        data: formatarDataHoraManaus(i.data_interacao),
        cliente: i.leads_juridicos?.nome
      })) || [],
      // Nota: todos os horários estão no fuso de Manaus (UTC-4), horário local do escritório
      fusoHorario: 'America/Manaus (UTC-4)'
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
