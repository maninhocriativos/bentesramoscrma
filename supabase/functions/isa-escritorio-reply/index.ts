const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// ─── Detectar se a mensagem é sobre processo ────────────────────────────────
const PROCESS_KEYWORDS = [
  'processo', 'andamento', 'movimentação', 'movimentacao',
  'atualização', 'atualizacao', 'notícia', 'noticia', 'novidade',
  'audiência', 'audiencia', 'sentença', 'sentenca', 'decisão', 'decisao',
  'recurso', 'certidão', 'certidao', 'meu caso', 'minha ação', 'minha acao',
  'ação', 'causa', 'julgamento', 'prazo', 'intimação', 'intimacao',
  'despacho', 'vara', 'tribunal', 'advogado', 'status', 'como está',
  'como esta', 'tem novidade', 'alguma novidade', 'o que aconteceu',
];

function isProcessoRelated(msg: string): boolean {
  const lower = msg.toLowerCase();
  return PROCESS_KEYWORDS.some(k => lower.includes(k));
}

// ─── Formatar data ────────────────────────────────────────────────────────────
function formatarData(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (isDateOnly) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
    }
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      timeZone: 'America/Manaus',
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return dateStr; }
}

// ─── Buscar processos ativos do cliente (somente do escritório) ───────────────
async function getProcessosDoCliente(supabase: any, leadId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('processos')
    .select('id, numero_processo, titulo_acao, status, tribunal, orgao_julgador, advogado_responsavel, movimentos_json, data_ultima_atualizacao, updated_at')
    .eq('cliente_id', leadId)
    .not('status', 'in', '("Arquivado","Perdido","Transitado em Julgado")')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[ISA-ESC] Erro ao buscar processos:', error.message);
    return [];
  }
  return data || [];
}

// ─── Formatar lista de processos para contexto da IA ─────────────────────────
function formatarProcessos(processos: any[]): string {
  if (processos.length === 0) {
    return 'Nenhum processo ativo encontrado no sistema para este cliente.';
  }

  const lines: string[] = [`${processos.length} processo(s) ativo(s) no escritório:\n`];
  for (let i = 0; i < processos.length; i++) {
    const p = processos[i];
    lines.push(`[PROCESSO ${i + 1}]`);
    lines.push(`Número: ${p.numero_processo || 'Sem número'}`);
    if (p.titulo_acao) lines.push(`Tipo/Classe: ${p.titulo_acao}`);
    if (p.tribunal) lines.push(`Tribunal: ${p.tribunal}`);
    if (p.orgao_julgador) lines.push(`Vara/Órgão: ${p.orgao_julgador}`);
    lines.push(`Status: ${p.status || 'Em Andamento'}`);
    if (p.advogado_responsavel) lines.push(`Advogado responsável: ${p.advogado_responsavel}`);
    lines.push(`Última atualização no sistema: ${formatarData(p.data_ultima_atualizacao || p.updated_at)}`);

    const movs: any[] = p.movimentos_json || [];
    if (movs.length > 0) {
      lines.push('Últimas movimentações:');
      for (const mov of movs.slice(0, 5)) {
        const data = formatarData(mov.dataHora || mov.data);
        const nome = mov.nome || mov.titulo || 'Movimentação';
        const comp = mov.complemento ? ` — ${String(mov.complemento).substring(0, 150)}` : '';
        lines.push(`  • ${data}: ${nome}${comp}`);
      }
    } else {
      lines.push('Movimentações: sem registros ainda');
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ─── Gerar resposta via OpenAI ────────────────────────────────────────────────
async function gerarResposta(nomeCliente: string, mensagem: string, processosCtx: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');

  const systemPrompt = `Você é a Isa, assistente virtual do escritório Bentes & Ramos Advocacia.
Sua única função neste canal é informar clientes sobre o andamento dos processos gerenciados pelo escritório.

DADOS DOS PROCESSOS DO CLIENTE ${nomeCliente}:
${processosCtx}

REGRAS:
- Apresente TODOS os processos ativos de forma clara, um por um
- Destaque a última movimentação de cada processo — é a informação mais importante
- Use formatação WhatsApp: *negrito* para dados relevantes, emojis com moderação (📋⚖️📅)
- Nunca prometa resultados nem dê parecer jurídico
- Se não houver processos ativos, informe educadamente e oriente a entrar em contato com o escritório
- Se o sistema não tiver movimentações recentes, diga que vai verificar e que a equipe retornará
- Seja objetivo e direto — máximo 6 linhas por processo
- Termine com: "Posso te ajudar em algo mais sobre seu processo?"`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: mensagem },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Handler principal ────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { lead_id, mensagem, subscriber_nome } = body;

    if (!lead_id || !mensagem) {
      return new Response(JSON.stringify({ success: false, error: 'lead_id e mensagem são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ISA-ESC] Lead ${lead_id} | msg: "${String(mensagem).substring(0, 80)}"`);

    // Só responde perguntas sobre processo
    if (!isProcessoRelated(mensagem)) {
      console.log(`[ISA-ESC] Mensagem não é sobre processo — ignorando`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'not_process_related' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar atendimento humano ativo
    const { data: subscriber } = await supabase
      .from('manychat_subscribers')
      .select('atendimento_humano')
      .eq('lead_id', lead_id)
      .maybeSingle();

    if (subscriber?.atendimento_humano) {
      console.log(`[ISA-ESC] Atendimento humano ativo — ignorando`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'atendimento_humano' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar nome do lead
    const { data: lead } = await supabase
      .from('leads_juridicos')
      .select('nome')
      .eq('id', lead_id)
      .maybeSingle();

    const nomeCliente = (lead?.nome || subscriber_nome || 'Cliente').split(' ')[0];

    // Buscar processos do escritório vinculados a este lead
    const processos = await getProcessosDoCliente(supabase, lead_id);
    console.log(`[ISA-ESC] ${processos.length} processo(s) encontrado(s) para lead ${lead_id}`);

    const processosCtx = formatarProcessos(processos);

    // Gerar resposta
    const resposta = await gerarResposta(nomeCliente, mensagem, processosCtx);

    if (!resposta) {
      console.error('[ISA-ESC] Resposta vazia da IA');
      return new Response(JSON.stringify({ success: false, error: 'Resposta vazia' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Registrar evento
    await supabase.from('system_events').insert({
      tipo: 'isa_escritorio',
      fonte: 'isa_escritorio_reply',
      acao: 'processo_consultado',
      lead_id,
      dados: { processos_encontrados: processos.length, mensagem: String(mensagem).substring(0, 100) },
    }).catch(() => {}); // não bloquear se falhar

    console.log(`[ISA-ESC] ✅ Resposta gerada: "${resposta.substring(0, 80)}"`);
    return new Response(JSON.stringify({ success: true, response: resposta }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[ISA-ESC] Erro:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
