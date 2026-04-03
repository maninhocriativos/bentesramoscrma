const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── PASSO 1: Extrai lançamentos — retorna JSON estruturado ────────
async function extrairLancamentos(base64: string, apiKey: string): Promise<Array<{data: string, descricao: string, valor: number}>> {
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
              text: `Você é um extrator de dados bancários de alta precisão. Leia este extrato bancário página por página, da primeira à última página, sem pular nenhuma.

TAREFA: Encontre todos os lançamentos das categorias abaixo e retorne um array JSON.

CATEGORIAS A BUSCAR:
- TARIFA BANCARIA (CESTA CELULAR, CESTA CLASSIC, CESTA PREMIUM, manutenção de conta)
- SEGURO (VIDA, PRESTAMISTA, BRADESCO VIDA PREV, SEG.VIDA, proteção financeira, HAP VIDA, HP VIDA)
- CAPITALIZAÇÃO
- TAC (Tarifa de Abertura de Crédito)  
- TEC (Taxa de Emissão de Carnê)
- CLUBE DE BENEFICIOS

REGRAS CRÍTICAS:
1. Cada lançamento = um objeto separado no array
2. O campo "valor" deve ser EXATAMENTE o valor que aparece na coluna DÉBITO do extrato para aquele lançamento específico
3. NUNCA some valores de meses diferentes
4. NUNCA multiplique valores
5. Se BRADESCO VIDA aparece em janeiro com 13.90 e em fevereiro com 14.84, são DOIS objetos com valores diferentes
6. NÃO inclua: IOF, ENCARGOS LIMITE DE CRED, saques, depósitos, transferências, compras, salário

FORMATO DE RETORNO — apenas o JSON, sem texto:
[
  {"data": "06/01/2017", "descricao": "TARIFA BANCARIA CESTA CELULAR", "valor": 32.00},
  {"data": "07/02/2017", "descricao": "TARIFA BANCARIA CESTA CELULAR", "valor": 32.00},
  {"data": "30/01/2017", "descricao": "BRADESCO VIDA PREV-SEG.VIDA", "valor": 13.90},
  {"data": "01/03/2017", "descricao": "BRADESCO VIDA PREV-SEG.VIDA", "valor": 14.84}
]

Retorne APENAS o array JSON, sem explicações:`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Erro extração PDF status:", response.status, err.substring(0, 300));
    return [];
  }

  const result = await response.json();
  const texto = result.content?.[0]?.text || "";
  console.log("Resposta bruta extração:\n", texto.substring(0, 1000));

  // Parseia o JSON retornado
  try {
    const jsonMatch = texto.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Nenhum array JSON encontrado na resposta");
      return [];
    }
    const items = JSON.parse(jsonMatch[0]);
    console.log(`Items extraídos: ${items.length}`);
    items.forEach((item: any) => console.log(`  ${item.data} | ${item.descricao} | ${item.valor}`));
    return items;
  } catch (e) {
    console.error("Falha ao parsear JSON da extração:", texto.substring(0, 500));
    return [];
  }
}

// ─── Interfaces ────────────────────────────────────────────────────
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

// ─── Valida e filtra lançamentos ───────────────────────────────────
function validarLancamentos(items: any[]): Lancamento[] {
  const lancamentos: Lancamento[] = [];

  for (const item of items) {
    if (!item.data || !item.descricao || item.valor === undefined) continue;

    const valor = parseFloat(String(item.valor).replace(",", "."));
    if (isNaN(valor) || valor <= 0) continue;

    // Sanity check: rejeita valores que parecem somas (acima de R$200 para tarifas/seguros)
    const descUpper = String(item.descricao).toUpperCase();
    const isSeguro = descUpper.includes("SEGURO") || descUpper.includes("VIDA") || descUpper.includes("PREV");
    const isTarifa = descUpper.includes("CESTA") || descUpper.includes("TARIFA BANCARIA");

    if ((isSeguro || isTarifa) && valor > 200) {
      console.warn(`REJEITADO (valor suspeito - possível soma): ${item.data} | ${item.descricao} | ${valor}`);
      continue;
    }

    // Filtra itens indevidos
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
    ) {
      console.warn(`REJEITADO (categoria indevida): ${item.descricao}`);
      continue;
    }

    lancamentos.push({
      data: String(item.data).trim(),
      descricao: String(item.descricao).trim(),
      valor,
    });
  }

  console.log(`Lançamentos válidos: ${lancamentos.length}`);
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
      baseLegal: "Resolução CMN nº 3.919/2010 — tarifas bancárias só são permitidas mediante contratação expressa e documentada",
      justificativa: "Tarifa de pacote de serviços cobrada mensalmente sem evidência de contratação expressa. A Resolução CMN 3.919/2010 exige autorização formal do cliente para cobrança de qualquer tarifa bancária.",
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
      baseLegal: "CDC Art. 39, III e IV — venda casada proibida; Resolução CNSP 382/2020 — seguro exige contratação expressa",
      justificativa: "Seguro cobrado mensalmente sem apresentação de contrato assinado pelo cliente. Caracteriza venda casada proibida pelo CDC art. 39, III, quando vinculado à conta corrente ou empréstimo.",
    };
  }

  if (d.includes("CAPITALIZ")) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida; Circular SUSEP 462/2013",
      justificativa: "Título de capitalização contratado sem autorização expressa do cliente.",
    };
  }

  if (d.includes("TAC") || d.includes("ABERTURA DE CREDITO") || d.includes("ABERTURA DE CRÉDITO")) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 30/04/2008",
      justificativa: "Tarifa de Abertura de Crédito expressamente proibida pelo Banco Central desde abril de 2008.",
    };
  }

  if (d.includes("TEC") || d.includes("EMISSAO DE CARNE") || d.includes("EMISSÃO DE CARNÊ")) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 30/04/2008",
      justificativa: "Taxa de Emissão de Carnê expressamente proibida pelo Banco Central desde abril de 2008.",
    };
  }

  if (d.includes("CLUBE") || d.includes("BENEFICIO") || d.includes("BENEFÍCIO")) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — fornecimento de serviço sem solicitação prévia é prática abusiva",
      justificativa: "Serviço contratado e cobrado sem autorização expressa do cliente.",
    };
  }

  return {
    categoria: "Cobranças Indevidas",
    baseLegal: "CDC Art. 39 — práticas abusivas proibidas",
    justificativa: "Cobrança sem evidência de contratação expressa pelo cliente.",
  };
}

// ─── Gera fundamentação jurídica ──────────────────────────────────
function gerarFundamentacao(grupos: GrupoCobranca[], banco: string, valorTotal: number): string {
  const temTarifa = grupos.some(g => classificar(g.descricao).categoria === "Tarifas Bancárias");
  const temSeguro = grupos.some(g => classificar(g.descricao).categoria === "Seguros");
  const temTac    = grupos.some(g => classificar(g.descricao).categoria === "TAC — Vedada");
  const temTec    = grupos.some(g => classificar(g.descricao).categoria === "TEC — Vedada");

  const valorFmt = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dobroFmt = (valorTotal * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let texto = `Foram identificadas cobranças indevidas no extrato bancário do ${banco}, totalizando ${valorFmt}.`;

  if (temTarifa) texto += ` As tarifas bancárias (cestas de serviços) foram cobradas sem evidência de contratação expressa, violando a Resolução CMN nº 3.919/2010.`;
  if (temSeguro) texto += ` Os seguros foram cobrados mensalmente sem apresentação de contrato assinado, caracterizando venda casada proibida pelo CDC Art. 39, III e pela Resolução CNSP 382/2020.`;
  if (temTac)    texto += ` A TAC cobrada é vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  if (temTec)    texto += ` A TEC cobrada é vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;

  texto += ` O consumidor tem direito à devolução em dobro totalizando ${dobroFmt}, conforme CDC Art. 42, parágrafo único. Recomenda-se notificação extrajudicial ao banco com prazo de 15 dias e, se não atendido, ajuizamento de ação de repetição de indébito no Juizado Especial Cível com pedido de dano moral.`;

  return texto;
}

// ─── SERVIDOR PRINCIPAL ───────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { banco, dataInicial, dataFinal, nomeCliente, cpf, numeroContrato, arquivosBase64 } = body;

    console.log("=== NOVA ANÁLISE ===");
    console.log("Banco:", banco, "| Período:", dataInicial, "a", dataFinal);
    console.log("Cliente:", nomeCliente, "| Arquivos:", arquivosBase64?.length);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 1: Extrai JSON estruturado de cada PDF
    let todosItems: any[] = [];
    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        console.log(`\nExtraindo: ${file.name}`);
        const items = await extrairLancamentos(file.base64, ANTHROPIC_API_KEY);
        todosItems = todosItems.concat(items);
      }
    }

    console.log(`\nTotal items extraídos: ${todosItems.length}`);

    const periodoAnalisado = dataInicial && dataFinal
      ? `${dataInicial} a ${dataFinal}`
      : "Período não informado";

    if (todosItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair lançamentos. Verifique se o arquivo é um extrato bancário válido em PDF." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 2: Valida e filtra
    const lancamentos = validarLancamentos(todosItems);

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
            fundamentacao: "Não foram encontradas cobranças indevidas no período analisado.",
            estimativa_recuperacao: 0,
            prazo_prescricional: "N/A",
            prioridade: "baixa",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 3: Agrupa com matemática no código
    const grupos = agruparPorDescricaoEValor(lancamentos);
    console.log(`\nGrupos: ${grupos.length}`);
    grupos.forEach(g => console.log(`  [${g.ocorrencias}x R$${g.valorUnitario}] ${g.descricao} = R$${g.valorTotal}`));

    // PASSO 4: Monta resultado
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

    const valor_total_indevido = parseFloat(
      cobrancas_indevidas.reduce((s, c) => s + c.valor_total, 0).toFixed(2)
    );
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