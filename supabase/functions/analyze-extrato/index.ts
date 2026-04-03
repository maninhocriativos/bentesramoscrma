const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Extrai TEXTO BRUTO do PDF sem interpretação ───────────────────
async function extrairTextoBruto(base64: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `Transcreva LITERALMENTE todas as linhas deste extrato bancário que contenham estas palavras:
TARIFA, CESTA, SEGURO, SEG.VIDA, VIDA PREV, BRADESCO VIDA, PRESTAMISTA, HAP VIDA, HP VIDA, CAPITALIZ, TAC, TEC, CLUBE, BENEFICIO

Para cada linha encontrada, copie EXATAMENTE como aparece no extrato:
- A data (ex: 06/01/2017)
- A descrição completa
- O valor do débito daquela linha específica

Formato de saída — uma linha por lançamento:
06/01/2017 | TARIFA BANCARIA CESTA CELULAR | 32,00
07/02/2017 | TARIFA BANCARIA CESTA CELULAR | 32,00
30/01/2017 | PAGTO ELETRON COBRANCA BRADESCO VIDA PREV-SEG.VIDA | 13,90

REGRAS:
- Copie o valor EXATO da coluna débito de cada linha individual
- NÃO calcule, NÃO some, NÃO interprete
- Se uma cobrança aparece em 12 meses = 12 linhas separadas
- Inclua TODAS as páginas do documento`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Erro extração:", response.status, await response.text());
    return "";
  }
  const result = await response.json();
  const texto = result.content?.[0]?.text || "";
  console.log("Texto bruto extraído:\n", texto);
  return texto;
}

// ─── Parseia texto bruto linha por linha ───────────────────────────
interface Lancamento {
  data: string;
  descricao: string;
  valor: number;
}

function parsearTextoBruto(texto: string): Lancamento[] {
  const lancamentos: Lancamento[] = [];
  const linhas = texto.split("\n");

  for (const linha of linhas) {
    const trimmed = linha.trim();
    if (!trimmed || !trimmed.includes("|")) continue;

    const partes = trimmed.split("|").map((p) => p.trim());
    if (partes.length < 3) continue;

    const data = partes[0].trim();
    const descricao = partes[1].trim();
    const valorStr = partes[2]
      .trim()
      .replace(/[^\d,\.]/g, "")
      .replace(",", ".");
    const valor = parseFloat(valorStr);

    if (!data || !descricao || isNaN(valor) || valor <= 0) continue;
    if (!data.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/)) continue;

    const descUpper = descricao.toUpperCase();

    // Rejeita lançamentos que não são cobranças indevidas
    if (
      descUpper.includes("IOF") ||
      descUpper.includes("ENCARGO") ||
      descUpper.includes("SAQUE") ||
      descUpper.includes("DEPOSITO") ||
      descUpper.includes("DEPÓSITO") ||
      descUpper.includes("TRANSFERENCIA") ||
      descUpper.includes("COMPRA") ||
      descUpper.includes("SALARIO") ||
      descUpper.includes("SALÁRIO")
    )
      continue;

    // Rejeita valores claramente somados
    const isSeguro =
      descUpper.includes("SEGURO") ||
      descUpper.includes("VIDA") ||
      descUpper.includes("PREV") ||
      descUpper.includes("HAP") ||
      descUpper.includes(" HP ");
    const isTarifa = descUpper.includes("CESTA") || descUpper.includes("TARIFA BANCARIA");

    if (isSeguro && valor > 200) {
      console.warn(`Seguro rejeitado (valor alto): ${data} | ${descricao} | ${valor}`);
      continue;
    }
    if (isTarifa && valor > 150) {
      console.warn(`Tarifa rejeitada (valor alto): ${data} | ${descricao} | ${valor}`);
      continue;
    }

    lancamentos.push({ data, descricao, valor });
  }

  console.log(`\nLançamentos válidos: ${lancamentos.length}`);
  lancamentos.forEach((l) => console.log(`  ✓ ${l.data} | ${l.descricao} | R$${l.valor}`));
  return lancamentos;
}

// ─── Agrupa por descrição + valor ─────────────────────────────────
interface GrupoCobranca {
  data: string;
  descricao: string;
  valorUnitario: number;
  ocorrencias: number;
  valorTotal: number;
}

function agrupar(lancamentos: Lancamento[]): GrupoCobranca[] {
  const mapa = new Map<string, GrupoCobranca>();

  for (const l of lancamentos) {
    const chave = `${l.descricao.toUpperCase().trim()}__${l.valor.toFixed(2)}`;
    if (mapa.has(chave)) {
      const g = mapa.get(chave)!;
      g.ocorrencias++;
      g.valorTotal = parseFloat((g.valorTotal + l.valor).toFixed(2));
    } else {
      mapa.set(chave, {
        data: l.data,
        descricao: l.descricao,
        valorUnitario: l.valor,
        ocorrencias: 1,
        valorTotal: l.valor,
      });
    }
  }

  return Array.from(mapa.values()).sort((a, b) => {
    const ca = classificar(a.descricao).categoria;
    const cb = classificar(b.descricao).categoria;
    return ca !== cb ? ca.localeCompare(cb) : a.data.localeCompare(b.data);
  });
}

// ─── Classificação jurídica ────────────────────────────────────────
function classificar(descricao: string) {
  const d = descricao.toUpperCase();

  if (
    d.includes("CESTA") ||
    d.includes("TARIFA BANCARIA") ||
    d.includes("TARIFA BANCÁRIA") ||
    d.includes("MANUTENCAO DE CONTA")
  ) {
    return {
      categoria: "Tarifas Bancárias",
      baseLegal: "Resolução CMN nº 3.919/2010 — tarifas só permitidas com contratação expressa",
      justificativa: "Tarifa cobrada mensalmente sem contratação expressa documentada pelo cliente.",
    };
  }
  if (
    d.includes("SEGURO") ||
    d.includes("SEG.VIDA") ||
    d.includes("VIDA PREV") ||
    d.includes("BRADESCO VIDA") ||
    d.includes("PRESTAMISTA") ||
    d.includes("HAP VIDA") ||
    d.includes("HP VIDA") ||
    d.includes("PROTECAO FINANCEIRA")
  ) {
    return {
      categoria: "Seguros",
      baseLegal: "CDC Art. 39, III e IV — venda casada proibida; Resolução CNSP 382/2020",
      justificativa: "Seguro cobrado sem contrato assinado — caracteriza venda casada proibida pelo CDC.",
    };
  }
  if (d.includes("CAPITALIZ")) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida",
      justificativa: "Capitalização contratada sem autorização expressa.",
    };
  }
  if (d.includes("TAC") || d.includes("ABERTURA DE CREDITO")) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 2008",
      justificativa: "TAC proibida pelo Banco Central desde abril de 2008.",
    };
  }
  if (d.includes("TEC") || d.includes("EMISSAO DE CARNE")) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 2008",
      justificativa: "TEC proibida pelo Banco Central desde abril de 2008.",
    };
  }
  if (d.includes("CLUBE") || d.includes("BENEFICIO")) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — serviço sem solicitação é prática abusiva",
      justificativa: "Serviço cobrado sem autorização expressa do cliente.",
    };
  }
  return {
    categoria: "Cobranças Indevidas",
    baseLegal: "CDC Art. 39 — práticas abusivas proibidas",
    justificativa: "Cobrança sem contratação expressa.",
  };
}

// ─── Fundamentação jurídica ────────────────────────────────────────
function gerarFundamentacao(grupos: GrupoCobranca[], banco: string, valorTotal: number): string {
  const temTarifa = grupos.some((g) => classificar(g.descricao).categoria === "Tarifas Bancárias");
  const temSeguro = grupos.some((g) => classificar(g.descricao).categoria === "Seguros");
  const temTac = grupos.some((g) => classificar(g.descricao).categoria === "TAC — Vedada");
  const temTec = grupos.some((g) => classificar(g.descricao).categoria === "TEC — Vedada");

  const vFmt = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dFmt = (valorTotal * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let t = `Foram identificadas cobranças indevidas no extrato do ${banco}, totalizando ${vFmt}.`;
  if (temTarifa) t += ` Tarifas bancárias cobradas sem contratação expressa violam a Resolução CMN nº 3.919/2010.`;
  if (temSeguro)
    t += ` Seguros cobrados sem contrato assinado caracterizam venda casada proibida pelo CDC Art. 39, III e Resolução CNSP 382/2020.`;
  if (temTac) t += ` TAC vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  if (temTec) t += ` TEC vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  t += ` Direito à devolução em dobro: ${dFmt} (CDC Art. 42, parágrafo único). Recomenda-se notificação extrajudicial ao banco e, se não atendido, ação de repetição de indébito no Juizado Especial Cível com pedido de dano moral. Prazo prescricional: 5 anos para tarifas (CDC Art. 27) e 10 anos para seguros (CC Art. 205).`;
  return t;
}

// ─── SERVIDOR PRINCIPAL ───────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { banco, dataInicial, dataFinal, nomeCliente, cpf, numeroContrato, arquivosBase64 } = body;

    console.log("=== NOVA ANÁLISE ===");
    console.log("Banco:", banco, "| Período:", dataInicial, "a", dataFinal);
    console.log("Arquivos:", arquivosBase64?.length);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const periodoAnalisado = dataInicial && dataFinal ? `${dataInicial} a ${dataFinal}` : "Período não informado";

    // PASSO 1: Extrai texto bruto de cada PDF
    let textoBrutoTotal = "";
    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        console.log(`\nExtraindo: ${file.name}`);
        const texto = await extrairTextoBruto(file.base64, ANTHROPIC_API_KEY);
        if (texto.trim()) textoBrutoTotal += texto + "\n";
      }
    }

    if (!textoBrutoTotal.trim()) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair lançamentos do PDF." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 2: Parseia localmente — sem IA para cálculos
    const lancamentos = parsearTextoBruto(textoBrutoTotal);

    if (lancamentos.length === 0) {
      return new Response(
        JSON.stringify({
          resumo: {
            total_lancamentos: 0,
            irregularidades_encontradas: 0,
            valor_total_indevido: 0,
            periodo_analisado: periodoAnalisado,
            banco: banco || "Não informado",
          },
          cobrancas_indevidas: [],
          por_categoria: [],
          recomendacao: {
            tipo_acao: "Nenhuma irregularidade identificada",
            fundamentacao: "Não foram encontradas cobranças indevidas.",
            estimativa_recuperacao: 0,
            prazo_prescricional: "N/A",
            prioridade: "baixa",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PASSO 3: Agrupa e calcula — 100% no código
    const grupos = agrupar(lancamentos);
    console.log(`\n=== GRUPOS ===`);
    grupos.forEach((g) => console.log(`  [${g.ocorrencias}x R$${g.valorUnitario}] ${g.descricao} = R$${g.valorTotal}`));

    const cobrancas_indevidas = grupos.map((g) => {
      const { categoria, baseLegal, justificativa } = classificar(g.descricao);
      return {
        data: g.data,
        descricao: g.descricao,
        valor_unitario: g.valorUnitario,
        quantidade_ocorrencias: g.ocorrencias,
        valor_total: g.valorTotal,
        categoria,
        status: "confirmado",
        base_legal: baseLegal,
        justificativa,
        recorrente: g.ocorrencias > 1,
      };
    });

    const valor_total_indevido = parseFloat(cobrancas_indevidas.reduce((s, c) => s + c.valor_total, 0).toFixed(2));
    const estimativa_recuperacao = parseFloat((valor_total_indevido * 2).toFixed(2));

    const catMap = new Map<string, { total: number; ocorrencias: number }>();
    for (const c of cobrancas_indevidas) {
      const ex = catMap.get(c.categoria) ?? { total: 0, ocorrencias: 0 };
      catMap.set(c.categoria, {
        total: parseFloat((ex.total + c.valor_total).toFixed(2)),
        ocorrencias: ex.ocorrencias + c.quantidade_ocorrencias,
      });
    }
    const por_categoria = Array.from(catMap.entries()).map(([categoria, v]) => ({
      categoria,
      total: v.total,
      ocorrencias: v.ocorrencias,
    }));

    const resultado = {
      resumo: {
        total_lancamentos: lancamentos.length,
        irregularidades_encontradas: cobrancas_indevidas.length,
        valor_total_indevido,
        periodo_analisado: periodoAnalisado,
        banco: banco || "Não informado",
      },
      cobrancas_indevidas,
      por_categoria,
      recomendacao: {
        tipo_acao: "Requerimento administrativo e/ou Ação Judicial de repetição de indébito",
        fundamentacao: gerarFundamentacao(grupos, banco || "banco", valor_total_indevido),
        estimativa_recuperacao,
        prazo_prescricional: "5 anos para tarifas (CDC Art. 27) e 10 anos para seguros (CC Art. 205)",
        prioridade: valor_total_indevido > 300 ? "alta" : "media",
      },
    };

    console.log("\n=== RESULTADO FINAL ===");
    console.log("Lançamentos:", resultado.resumo.total_lancamentos);
    console.log("Grupos:", resultado.resumo.irregularidades_encontradas);
    console.log("Total: R$", resultado.resumo.valor_total_indevido);
    console.log("2x: R$", resultado.recomendacao.estimativa_recuperacao);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro geral:", e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
