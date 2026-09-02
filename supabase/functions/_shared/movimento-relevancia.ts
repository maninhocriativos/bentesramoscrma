// ─────────────────────────────────────────────────────────────────────────────
// Controle de "o que já foi comunicado ao cliente" a nível de MOVIMENTAÇÃO
// (não de processo inteiro) + classificação de relevância por IA.
//
// Por que por movimentação e não por data/contagem: `processos.movimentos_json`
// é sobrescrito inteiro a cada sync (pode mudar de ordem, ganhar/perder itens
// no limite de 100). A tabela `processo_movimentacoes` já existe e faz upsert
// por hash único (cnj+data+título+descrição) a cada sync — reaproveitamos isso
// como fonte de verdade: uma linha nova (hash novo) = movimentação genuinamente
// nova; `notificado_em` marca quando ela foi avaliada para envio ao cliente.
// Isso é imune a reordenação/reescrita do array e não depende de contar deltas.
// ─────────────────────────────────────────────────────────────────────────────

import { chatCompletion } from "./ai-helper.ts";

export interface MovimentoPendente {
  id: string;
  data_movimento: string | null;
  movimento_titulo: string | null;
  movimento_descricao: string | null;
}

export interface ClassificacaoRelevancia {
  relevantes: MovimentoPendente[];
  explicacaoRelevantes: string | null;
}

/**
 * Busca movimentações do processo ainda não avaliadas para notificação ao
 * cliente (notificado_em IS NULL), mais recentes primeiro.
 */
export async function buscarMovimentosPendentes(
  supabase: any,
  processoId: string,
  limit = 15,
): Promise<MovimentoPendente[]> {
  const { data, error } = await supabase
    .from("processo_movimentacoes")
    .select("id, data_movimento, movimento_titulo, movimento_descricao")
    .eq("processo_id", processoId)
    .is("notificado_em", null)
    .order("data_movimento", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[movimento-relevancia] Erro ao buscar pendentes:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Marca movimentações como avaliadas (comunicadas ou descartadas por
 * irrelevância — ambos os casos encerram o ciclo de avaliação delas).
 * Chamar SÓ depois que a decisão (enviar ou pular) já foi tomada com sucesso —
 * nunca antes de uma tentativa de envio que ainda pode falhar.
 */
export async function marcarMovimentosNotificados(
  supabase: any,
  pendentes: MovimentoPendente[],
  relevantes: MovimentoPendente[],
): Promise<void> {
  if (pendentes.length === 0) return;
  const relevantesIds = new Set(relevantes.map((m) => m.id));
  const naoRelevantesIds = pendentes.map((m) => m.id).filter((id) => !relevantesIds.has(id));
  const agora = new Date().toISOString();

  const updates: Promise<any>[] = [];
  if (relevantesIds.size > 0) {
    updates.push(
      supabase
        .from("processo_movimentacoes")
        .update({ notificado_em: agora, relevante: true })
        .in("id", Array.from(relevantesIds)),
    );
  }
  if (naoRelevantesIds.length > 0) {
    updates.push(
      supabase
        .from("processo_movimentacoes")
        .update({ notificado_em: agora, relevante: false })
        .in("id", naoRelevantesIds),
    );
  }
  await Promise.all(updates);
}

const SYSTEM_PROMPT =
  "Você é a Isa, assistente jurídica do escritório Bentes Ramos Advogados. " +
  "Você recebe uma lista de movimentações processuais NOVAS (ainda não comunicadas ao cliente) e decide quais " +
  "merecem virar um aviso para um cliente leigo. " +
  "RELEVANTE: decisões, sentenças, despachos com conteúdo, intimações, citações, audiências marcadas/realizadas, " +
  "acordos, homologações, penhoras, alvarás, perícias, recursos, mudança de status do processo, trânsito em julgado. " +
  "NÃO RELEVANTE (mero expediente/trâmite interno): conclusão para análise sem decisão ainda, juntada de petição/documento " +
  "sem conteúdo relevante, certidão cartorária, vista às partes sem prazo com ação exigida, remessa/distribuição interna, " +
  "autuação, publicação que apenas replica algo já intimado. " +
  "Responda APENAS com um objeto JSON, sem texto antes ou depois, no formato: " +
  '{"relevantes": [indices 0-based dos itens relevantes], "explicacao": "texto amigável cobrindo SOMENTE os itens relevantes, ' +
  'cada um começando com ▸, no máximo 3 linhas por item, sem jargão técnico, dizendo o que aconteceu e se o cliente precisa fazer algo"}. ' +
  'Se nenhum item for relevante, responda {"relevantes": [], "explicacao": ""}.';

/**
 * Classifica quais movimentações pendentes são relevantes o suficiente para
 * avisar o cliente. Se não houver IA configurada ou a chamada falhar, trata
 * TODAS como relevantes (degrada para o comportamento anterior — mostrar tudo
 * — em vez de silenciar avisos por causa de uma falha de infraestrutura).
 */
export async function classificarRelevanciaMovimentos(
  pendentes: MovimentoPendente[],
  numProcesso: string,
  nomeCliente: string,
): Promise<ClassificacaoRelevancia> {
  if (pendentes.length === 0) return { relevantes: [], explicacaoRelevantes: null };

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!openaiKey && !anthropicKey) {
    return { relevantes: pendentes, explicacaoRelevantes: null };
  }

  const movsCtx = pendentes
    .map((m, i) => {
      const data = m.data_movimento || "data não informada";
      const detalhe = (m.movimento_descricao || "").trim();
      return `Movimentação ${i} (${data}):\n  Tipo: ${m.movimento_titulo || "Movimentação"}\n  Conteúdo: ${detalhe || "sem detalhes adicionais"}`;
    })
    .join("\n\n");

  try {
    const raw = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Processo: ${numProcesso}\nCliente: ${nomeCliente}\n\nClassifique estas movimentações:\n\n${movsCtx}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 600,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { relevantes: pendentes, explicacaoRelevantes: null };

    const parsed = JSON.parse(match[0]);
    const indices: number[] = Array.isArray(parsed.relevantes)
      ? parsed.relevantes.filter((i: any) => Number.isInteger(i) && i >= 0 && i < pendentes.length)
      : pendentes.map((_, i) => i);
    const explicacao = typeof parsed.explicacao === "string" && parsed.explicacao.trim()
      ? parsed.explicacao.trim()
      : null;

    return { relevantes: indices.map((i) => pendentes[i]), explicacaoRelevantes: explicacao };
  } catch (e) {
    console.error("[movimento-relevancia] Falha na classificação IA, tratando tudo como relevante:", (e as Error).message);
    return { relevantes: pendentes, explicacaoRelevantes: null };
  }
}
