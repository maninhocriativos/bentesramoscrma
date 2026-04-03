const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── PASSO 1: Extrai lançamentos do PDF ───────────────────────────
async function extrairLancamentos(base64: string, apiKey: string): Promise<string> {
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
              text: `Leia ABSOLUTAMENTE TODAS as páginas deste extrato bancário, da primeira à última, sem pular nenhuma.

Sua única tarefa: listar cada lançamento das categorias abaixo, UM POR LINHA, no formato exato:
DATA|DESCRIÇÃO COMPLETA|VALOR

CATEGORIAS A BUSCAR (procure em TODAS as páginas):
1. TARIFA BANCARIA — inclui: CESTA CELULAR, CESTA CLASSIC, CESTA PREMIUM, manutenção de conta
2. SEGURO — inclui: SEGURO VIDA, BRADESCO VIDA PREV, SEGURO PRESTAMISTA, proteção financeira, SEG.VIDA
3. CAPITALIZAÇÃO
4. TAC (Tarifa de Abertura de Crédito)
5. TEC (Taxa de Emissão de Carnê)
6. CLUBE DE BENEFICIOS

REGRAS ABSOLUTAS:
- CADA ocorrência = UMA linha separada, mesmo que seja a mesma cobrança em meses diferentes
- NUNCA agrupe, NUNCA some, NUNCA resuma
- Verifique cada mês individualmente: jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez
- Valor com ponto decimal: 32.00 (não vírgula)
- NÃO inclua: IOF, ENCARGOS LIMITE DE CRED, saques, depósitos, transferências, compras, contas de luz/água/telefone

FORMATO OBRIGATÓRIO (apenas estas linhas, sem texto adicional):
06/01/2017|TARIFA BANCARIA CESTA CELULAR|32.00
07/02/2017|TARIFA BANCARIA CESTA CELULAR|32.00
30/01/2017|PAGTO ELETRON COBRANCA BRADESCO VIDA PREV-SEG.VIDA|13.90
28/03/2017|PAGTO ELETRON COBRANCA BRADESCO VIDA PREV-SEG.VIDA|14.84

Comece listando agora, sem preâmbulo:`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Erro extração PDF status:", response.status);
    console.error("Erro extração PDF body:", err.substring(0, 500));
    return "";
  }
  const result = await response.json();
  const texto = result.content?.[0]?.text || "";
  console.log("Extração concluída. Chars:", texto.length);
  console.log("Primeiros 800 chars:\n", texto.substring(0, 800));
  return texto;
}

// ─── Parseia lançamentos do texto extraído ─────────────────────────
interface Lancamento {
  data: string;
  descricao: string;
  valor: number;
}

interface GrupoCobranca {
  data: string;
  descricao: string;
  valorUnitario: number;
  ocorrencias: number;
  valorTotal: number;
}

function parsearLancamentos(texto: string): Lancamento[] {
  const lancamentos: Lancamento[] = [];
  const linhas = texto.split("\n");

  for (const linha of linhas) {
    const trimmed = linha.trim();
    if (!trimmed || !trimmed.includes("|")) continue;

    const partes = trimmed.split("|");
    if (partes.length < 3) continue;

    const data = partes[0].trim();
    const descricao = partes[1].trim();
    const valorStr = partes[2]
      .trim()
      .replace(/[^0-9.,]/g, "")
      .replace(",", ".");
    const valor = parseFloat(valorStr);

    if (!data || !descricao || isNaN(valor) || valor <= 0) continue;

    const descUpper = descricao.toUpperCase();
    // Filtra itens que não devem entrar
    if (
      descUpper.includes("IOF") ||
      descUpper.includes("ENCARGO") ||
      descUpper.includes("SAQUE") ||
      descUpper.includes("DEPOSITO") ||
      descUpper.includes("DEPÓSITO") ||
      descUpper.includes("TRANSFERENCIA") ||
      descUpper.includes("TRANSFERÊNCIA") ||
      descUpper.includes("COMPRA") ||
      descUpper.includes("CREDITO DE SALARIO") ||
      descUpper.includes("CRÉDITO DE SALÁRIO") ||
      descUpper.includes("CONTA DE LUZ") ||
      descUpper.includes("CONTA DE AGUA") ||
      descUpper.includes("CONTA DE TELEFONE")
    )
      continue;

    lancamentos.push({ data, descricao, valor });
  }

  console.log(`Total lançamentos parseados: ${lancamentos.length}`);
  lancamentos.forEach((l) => console.log(`  ${l.data} | ${l.descricao} | ${l.valor}`));
  return lancamentos;
}

// ─── Agrupa por descrição + valor (100% preciso no código) ─────────
function agruparPorDescricaoEValor(lancamentos: Lancamento[]): GrupoCobranca[] {
  const mapa = new Map<string, GrupoCobranca>();

  for (const l of lancamentos) {
    const descNorm = l.descricao.toUpperCase().replace(/\s+/g, " ").trim();
    const chave = `${descNorm}__${l.valor.toFixed(2)}`;

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
    const catA = classificar(a.descricao).categoria;
    const catB = classificar(b.descricao).categoria;
    if (catA !== catB) return catA.localeCompare(catB);
    return a.data.localeCompare(b.data);
  });
}

// ─── Classificação jurídica ────────────────────────────────────────
function classificar(descricao: string): {
  categoria: string;
  baseLegal: string;
  justificativa: string;
} {
  const d = descricao.toUpperCase();

  if (
    d.includes("CESTA CELULAR") ||
    d.includes("CESTA CLASSIC") ||
    d.includes("CESTA PREMIUM") ||
    d.includes("TARIFA BANCARIA") ||
    d.includes("TARIFA BANCÁRIA") ||
    d.includes("MANUTENCAO DE CONTA") ||
    d.includes("MANUTENÇÃO DE CONTA")
  ) {
    return {
      categoria: "Tarifas Bancárias",
      baseLegal:
        "Resolução CMN nº 3.919/2010 — tarifas bancárias só são permitidas mediante contratação expressa e documentada",
      justificativa:
        "Tarifa de pacote de serviços cobrada mensalmente sem evidência de contratação expressa. A Resolução CMN 3.919/2010 exige autorização formal do cliente para cobrança de qualquer tarifa bancária.",
    };
  }

  if (
    d.includes("SEGURO") ||
    d.includes("SEG.VIDA") ||
    d.includes("VIDA PREV") ||
    d.includes("BRADESCO VIDA") ||
    d.includes("PRESTAMISTA") ||
    d.includes("PROTECAO FINANCEIRA") ||
    d.includes("PROTEÇÃO FINANCEIRA") ||
    d.includes("HAP VIDA") ||
    d.includes("HP VIDA")
  ) {
    return {
      categoria: "Seguros",
      baseLegal:
        "CDC Art. 39, III e IV — venda casada proibida; Resolução CNSP 382/2020 — seguro exige contratação expressa",
      justificativa:
        "Seguro cobrado mensalmente sem apresentação de contrato de seguro assinado pelo cliente. Caracteriza venda casada proibida pelo CDC art. 39, III, quando vinculado à conta corrente ou empréstimo.",
    };
  }

  if (d.includes("CAPITALIZ")) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida; Circular SUSEP 462/2013",
      justificativa:
        "Título de capitalização contratado sem autorização expressa do cliente. Prática de venda casada vedada pelo CDC.",
    };
  }

  if (d.includes("TAC") || d.includes("ABERTURA DE CREDITO") || d.includes("ABERTURA DE CRÉDITO")) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 30/04/2008",
      justificativa:
        "Tarifa de Abertura de Crédito expressamente proibida pelo Banco Central desde abril de 2008. Cobrança totalmente ilegal.",
    };
  }

  if (d.includes("TEC") || d.includes("EMISSAO DE CARNE") || d.includes("EMISSÃO DE CARNÊ")) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 30/04/2008",
      justificativa:
        "Taxa de Emissão de Carnê expressamente proibida pelo Banco Central desde abril de 2008. Cobrança totalmente ilegal.",
    };
  }

  if (d.includes("CLUBE") || d.includes("BENEFICIO") || d.includes("BENEFÍCIO")) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — fornecimento de serviço sem solicitação prévia é prática abusiva",
      justificativa:
        "Serviço contratado e cobrado sem autorização expressa do cliente. Prática abusiva vedada pelo Código de Defesa do Consumidor.",
    };
  }

  return {
    categoria: "Cobranças Indevidas",
    baseLegal: "CDC Art. 39 — práticas abusivas proibidas",
    justificativa: "Cobrança sem evidência de contratação expressa pelo cliente.",
  };
}

// ─── Gera fundamentação jurídica detalhada ────────────────────────
function gerarFundamentacao(grupos: GrupoCobranca[], banco: string, valorTotal: number): string {
  const temTarifa = grupos.some((g) => classificar(g.descricao).categoria === "Tarifas Bancárias");
  const temSeguro = grupos.some((g) => classificar(g.descricao).categoria === "Seguros");
  const temTac = grupos.some((g) => classificar(g.descricao).categoria === "TAC — Vedada");
  const temTec = grupos.some((g) => classificar(g.descricao).categoria === "TEC — Vedada");

  const valorFmt = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dobroFmt = (valorTotal * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let texto = `Foram identificadas cobranças indevidas no extrato bancário do ${banco}, totalizando ${valorFmt}.`;

  if (temTarifa) {
    texto += ` As tarifas bancárias (cestas de serviços) foram cobradas sem evidência de contratação expressa, violando a Resolução CMN nº 3.919/2010, que exige autorização formal e documentada do cliente para qualquer cobrança de tarifa.`;
  }
  if (temSeguro) {
    texto += ` Os seguros foram cobrados mensalmente sem apresentação de contrato de seguro assinado, caracterizando venda casada expressamente proibida pelo Art. 39, inciso III do Código de Defesa do Consumidor (Lei 8.078/90) e pela Resolução CNSP 382/2020.`;
  }
  if (temTac) {
    texto += ` A TAC (Tarifa de Abertura de Crédito) cobrada é expressamente vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  }
  if (temTec) {
    texto += ` A TEC (Taxa de Emissão de Carnê) cobrada é expressamente vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  }

  texto += ` O consumidor tem direito à devolução em dobro de todos os valores cobrados indevidamente, totalizando ${dobroFmt}, conforme Art. 42, parágrafo único do CDC ("salvo hipótese de engano justificável"). Recomenda-se: (1) envio de notificação extrajudicial ao banco concedendo prazo de 15 dias para devolução voluntária; (2) caso não atendido, ajuizamento de ação de repetição de indébito no Juizado Especial Cível, com pedido de dano moral por prática abusiva. O prazo prescricional é de 5 anos para tarifas (Art. 27 do CDC) e 10 anos para seguros (Art. 205 do Código Civil).`;

  return texto;
}

// ─── SERVIDOR PRINCIPAL ───────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const { banco, dataInicial, dataFinal, nomeCliente, cpf, numeroContrato, arquivosBase64 } = body;

    console.log("=== NOVA ANÁLISE ===");
    console.log("Banco:", banco);
    console.log("Período:", dataInicial, "a", dataFinal);
    console.log("Cliente:", nomeCliente);
    console.log("Arquivos recebidos:", arquivosBase64?.length);
    arquivosBase64?.forEach((f: any, i: number) => {
      console.log(`  Arquivo ${i + 1}: ${f.name} | tipo: ${f.mimeType} | base64: ${f.base64?.length} chars`);
    });

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nas secrets do Supabase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 1: Extrai lançamentos de todos os PDFs
    let todosTextos = "";
    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        console.log(`Extraindo PDF: ${file.name}`);
        const texto = await extrairLancamentos(file.base64, ANTHROPIC_API_KEY);
        if (texto.trim()) {
          todosTextos += texto + "\n";
        } else {
          console.error("Extração vazia para:", file.name);
        }
      } else {
        console.log("Arquivo ignorado (não é PDF):", file.name, file.mimeType);
      }
    }

    console.log("Total texto extraído:", todosTextos.length, "chars");

    if (!todosTextos.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Não foi possível extrair lançamentos do documento. Certifique-se de que o arquivo é um extrato bancário em formato PDF.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PASSO 2: Parseia e agrupa — cálculos feitos no código
    const lancamentos = parsearLancamentos(todosTextos);

    if (lancamentos.length === 0) {
      // Retorna resultado vazio mas válido
      return new Response(
        JSON.stringify({
          resumo: {
            total_lancamentos: 0,
            irregularidades_encontradas: 0,
            valor_total_indevido: 0,
            periodo_analisado: dataInicial && dataFinal ? `${dataInicial} a ${dataFinal}` : "Período não informado",
            banco: banco || "Não informado",
          },
          cobrancas_indevidas: [],
          por_categoria: [],
          recomendacao: {
            tipo_acao: "Nenhuma irregularidade identificada",
            fundamentacao:
              "Não foram encontradas tarifas bancárias, seguros ou outros serviços cobrados indevidamente no período analisado.",
            estimativa_recuperacao: 0,
            prazo_prescricional: "N/A",
            prioridade: "baixa",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const grupos = agruparPorDescricaoEValor(lancamentos);
    console.log(`Grupos finais: ${grupos.length}`);
    grupos.forEach((g) =>
      console.log(`  ${g.descricao} | unit: ${g.valorUnitario} | x${g.ocorrencias} = ${g.valorTotal}`),
    );

    // PASSO 3: Monta resultado com cálculos 100% precisos
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

    // Agrupa por categoria para o resumo
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
        periodo_analisado: dataInicial && dataFinal ? `${dataInicial} a ${dataFinal}` : "Período não informado",
        banco: banco || "Não informado",
      },
      cobrancas_indevidas,
      por_categoria,
      recomendacao: {
        tipo_acao: "Requerimento administrativo e/ou Ação Judicial de repetição de indébito",
        fundamentacao: gerarFundamentacao(grupos, banco || "banco", valor_total_indevido),
        estimativa_recuperacao,
        prazo_prescricional:
          "5 anos para tarifas bancárias (Art. 27 do CDC) e 10 anos para seguros (Art. 205 do Código Civil)",
        prioridade: valor_total_indevido > 300 ? "alta" : "media",
      },
    };

    console.log("=== RESULTADO FINAL ===");
    console.log("Total lançamentos:", resultado.resumo.total_lancamentos);
    console.log("Irregularidades:", resultado.resumo.irregularidades_encontradas);
    console.log("Valor total indevido:", resultado.resumo.valor_total_indevido);
    console.log("Estimativa recuperação:", resultado.recomendacao.estimativa_recuperacao);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("=== ERRO GERAL ===");
    console.error("Mensagem:", e.message);
    console.error("Stack:", e.stack);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
