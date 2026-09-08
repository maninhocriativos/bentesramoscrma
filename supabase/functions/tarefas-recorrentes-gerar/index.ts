const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";
import { getHojeManaus } from '../_shared/timezone-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Dado "hoje" (YYYY-MM-DD, já em horário de Manaus), decide se uma recorrência
// deve gerar tarefa hoje.
function devoGerarHoje(rec: {
  frequencia: string;
  dias_semana: number[] | null;
  dia_mes: number | null;
}, hoje: string): boolean {
  const [anoStr, mesStr, diaStr] = hoje.split('-');
  const ano = parseInt(anoStr, 10), mes = parseInt(mesStr, 10), dia = parseInt(diaStr, 10);

  if (rec.frequencia === 'diaria') return true;

  if (rec.frequencia === 'semanal') {
    const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(); // 0=domingo
    return (rec.dias_semana || []).includes(dow);
  }

  if (rec.frequencia === 'mensal') {
    if (!rec.dia_mes) return false;
    const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const diaAlvo = Math.min(rec.dia_mes, diasNoMes); // clamp: dia_mes=31 num mês de 30 dias gera no dia 30
    return dia === diaAlvo;
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const hoje = getHojeManaus();

    const { data: recorrentes, error: fetchErr } = await supabase
      .from('tarefas_recorrentes')
      .select('*')
      .eq('ativa', true)
      .or(`ultima_geracao_em.is.null,ultima_geracao_em.neq.${hoje}`);

    if (fetchErr) throw fetchErr;

    const geradas: string[] = [];

    for (const rec of recorrentes || []) {
      if (!devoGerarHoje(rec, hoje)) continue;

      const { error: insertErr } = await supabase.from('tarefas').insert({
        titulo: rec.titulo,
        descricao: rec.descricao,
        tipo: rec.tipo,
        prioridade: rec.prioridade,
        responsavel_id: rec.responsaveis_ids?.[0] || null,
        responsaveis_ids: rec.responsaveis_ids || [],
        processo_id: rec.processo_id,
        cliente_id: rec.cliente_id,
        status: 'Pendente',
        data_limite: hoje,
        prazo_fatal: hoje,
        horario: rec.horario,
        tarefa_recorrente_id: rec.id,
      });

      if (insertErr) {
        console.error(`[tarefas-recorrentes-gerar] erro ao gerar "${rec.titulo}" (${rec.id}):`, insertErr);
        continue;
      }

      await supabase.from('tarefas_recorrentes').update({ ultima_geracao_em: hoje }).eq('id', rec.id);
      geradas.push(rec.titulo);
    }

    return new Response(JSON.stringify({ success: true, hoje, total_avaliadas: (recorrentes || []).length, geradas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[tarefas-recorrentes-gerar] Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
