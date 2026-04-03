const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Converte base64 para Uint8Array ───────────────────────────────
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Divide PDF em blocos de páginas e retorna base64 de cada bloco ─
async function dividirPdfEmBlocos(base64Original: string, tamanhoBlocoPaginas: number = 8): Promise<string[]> {
  // Detecta número de páginas contando ocorrências de /Page\n
  // Como não temos lib PDF no Deno, usamos heurística pelo tamanho
  // e enviamos o PDF completo em múltiplas chamadas com instrução de foco por período

  // Estratégia: dividir por trimestres do ano fiscal
  // Retorna o mesmo base64 para cada bloco, mas com instrução diferente
  const meses = [
    { label: "JANEIRO e FEVEREIRO", meses: ["janeiro", "fevereiro", "jan", "fev", "01/", "02/"] },
    { label: "MARÇO e ABRIL", meses: ["março", "abril", "mar", "abr", "03/", "04/"] },
    { label: "MAIO e JUNHO", meses: ["maio", "junho", "mai", "jun", "05/", "06/"] },
    { label: "JULHO e AGOSTO", meses: ["julho", "agosto", "jul", "ago", "07/", "08/"] },
    { label: "SETEMBRO e OUTUBRO", meses: ["setembro", "outubro", "set", "out", "09/", "10/"] },
    { label: "NOVEMBRO e DEZEMBRO", meses: ["novembro", "dezembro", "nov", "dez", "11/", "12/"] },
  ];

  return meses.map((m) => JSON.stringify({ base64: base64Original, foco: m.label }));
}

// ─── Extrai lançamentos de um bloco específico ─────────────────────
async function extrairBlocoLancamentos(
  base64: string,
  focoMeses: string,
  apiKey: string,
  tentativa: number = 1,
): Promise<Array<{ data: string; descricao: string; valor: number }>> {
  const prompt = `Você é um extrator de dados bancários de alta precisão.

FOCO: Leia APENAS os lançamentos dos meses ${focoMeses} neste extrato bancário.

CATEGORIAS A BUSCAR:
- TARIFA BANCARIA (CESTA CELULAR, CESTA CLASSIC, CESTA PREMIUM, manutenção de conta)
- SEGURO (VIDA, BRADESCO VIDA PREV, SEG.VIDA, PRESTAMISTA, proteção financeira, HAP VIDA, HP VIDA)
- CAPITALIZAÇÃO
- TAC (Tarifa de Abertura de Crédito)
- TEC (Taxa de Emissão de Carnê)
- CLUBE DE BENEFICIOS

REGRAS ABSOLUTAS:
1. Cada lançamento = UM objeto JSON separado
2. O campo "valor" = valor EXATO da coluna DÉBITO daquele lançamento específico
3. NUNCA some valores de diferentes datas
4. NUNCA multiplique valores
5. Se o mesmo tipo aparece em dois dias diferentes = dois objetos separados
6. NÃO inclua: IOF, ENCARGOS LIMITE, saques, depósitos, transferências, compras, salário, luz, água, telefone

EXEMPLO CORRETO para os meses ${focoMeses}:
Se encontrar CESTA CELULAR em dois meses com valor 32.00 cada:
[
  {"data": "06/01/2017", "descricao": "TARIFA BANCARIA CESTA CELULAR", "valor": 32.00},
  {"data": "07/02/2017", "descricao": "TARIFA BANCARIA CESTA CELULAR", "valor": 32.00}
]

EXEMPLO ERRADO — NUNCA FAÇA:
[{"data": "06/01/2017", "descricao": "TARIFA BANCARIA CESTA CELULAR", "valor": 64.00}]

Se não encontrar nenhum lançamento nos meses ${focoMeses}, retorne: []

Retorne APENAS o array JSON, sem texto antes ou depois:`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Erro bloco ${focoMeses} (tentativa ${tentativa}):`, response.status, err.substring(0, 200));

      // Retry automático em caso de rate limit
      if (response.status === 429 && tentativa < 3) {
        await new Promise((r) => setTimeout(r, 5000 * tentativa));
        return extrairBlocoLancamentos(base64, focoMeses, apiKey, tentativa + 1);
      }
      return [];
    }

    const result = await response.json();
    const texto = result.content?.[0]?.text || "";
    console.log(`Bloco [${focoMeses}] resposta:`, texto.substring(0, 400));

    const match = texto.match(/\[[\s\S]*?\]/);
    if (!match) {
      console.log(`Bloco [${focoMeses}]: nenhum array encontrado`);
      return [];
    }

    const items = JSON.parse(match[0]);
    console.log(`Bloco [${focoMeses}]: ${items.length} lançamentos`);
    items.forEach((item: any) => console.log(`  ${item.data} | ${item.descricao} | R$${item.valor}`));
    return items;
  } catch (e: any) {
    console.error(`Erro no bloco ${focoMeses}:`, e.message);
    return [];
  }
}

// ─── Orquestrador — processa todos os blocos em paralelo ───────────
async function extrairTodosLancamentos(
  base64: string,
  apiKey: string,
): Promise<Array<{ data: string; descricao: string; valor: number }>> {
  // Define os blocos bimestrais — cobre todo o ano independente do período
  const blocos = [
    "JANEIRO e FEVEREIRO",
    "MARÇO e ABRIL",
    "MAIO e JUNHO",
    "JULHO e AGOSTO",
    "SETEMBRO e OUTUBRO",
    "NOVEMBRO e DEZEMBRO",
  ];

  console.log(`\nProcessando ${blocos.length} blocos em paralelo...`);

  // Processa todos os blocos em paralelo (mais rápido)
  // Com delay escalonado para evitar rate limit
  const promessas = blocos.map(
    (bloco, index) =>
      new Promise<Array<{ data: string; descricao: string; valor: number }>>(async (resolve) => {
        // Delay escalonado: 0ms, 1s, 2s, 3s, 4s, 5s
        if (index > 0) await new Promise((r) => setTimeout(r, index * 1000));
        const resultado = await extrairBlocoLancamentos(base64, bloco, apiKey);
        resolve(resultado);
      }),
  );

  const resultados = await Promise.all(promessas);

  // Combina todos os resultados
  const todos = resultados.flat();
  console.log(`\nTotal bruto antes de deduplicar: ${todos.length} lançamentos`);

  // Deduplica por data + descrição + valor (evita duplicatas entre blocos)
  const vistos = new Set<string>();
  const deduplicados = todos.filter((item) => {
    if (!item.data || !item.descricao || item.valor === undefined) return false;
    const chave = `${item.data}__${String(item.descricao).toUpperCase().trim()}__${item.valor}`;
    if (vistos.has(chave)) {
      console.log(`Duplicata removida: ${item.data} | ${item.descricao} | ${item.valor}`);
      return false;
    }
    vistos.add(chave);
    return true;
  });

  console.log(`\nTotal após deduplicação: ${deduplicados.length} lançamentos`);
  return deduplicados;
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

    const descUpper = String(item.descricao).toUpperCase();

    // Rejeita valores suspeitos (possíveis somas)
    const isSeguro =
      descUpper.includes("SEGURO") ||
      descUpper.includes("VIDA") ||
      descUpper.includes("PREV") ||
      descUpper.includes("HAP") ||
      descUpper.includes(" HP ");
    const isTarifa =
      descUpper.includes("CESTA") || descUpper.includes("TARIFA BANCARIA") || descUpper.includes("TARIFA BANCÁRIA");
    const limiteMax = isSeguro ? 200 : isTarifa ? 150 : 500;

    if (valor > limiteMax) {
      console.warn(`REJEITADO (valor ${valor} > limite ${limiteMax}): ${item.data} | ${item.descricao}`);
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
      descUpper.includes("TRANSFERÊNCIA") ||
      descUpper.includes("COMPRA") ||
      descUpper.includes("SALARIO") ||
      descUpper.includes("SALÁRIO") ||
      descUpper.includes("CONTA DE LUZ") ||
      descUpper.includes("CONTA DE AGUA") ||
      descUpper.includes("CONTA DE TELEFONE")
    )
      continue;

    // Valida formato de data
    if (!String(item.data).match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/)) {
      console.warn(`Data inválida: ${item.data}`);
      continue;
    }

    lancamentos.push({
      data: String(item.data).trim(),
      descricao: String(item.descricao).trim(),
      valor,
    });
  }

  console.log(`\nLançamentos válidos: ${lancamentos.length}`);
  lancamentos.forEach((l) => console.log(`  ✓ ${l.data} | ${l.descricao} | R$${l.valor}`));
  return lancamentos;
}

// ─── Agrupa por descrição + valor ─────────────────────────────────
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
        "Seguro cobrado mensalmente sem apresentação de contrato assinado pelo cliente. Caracteriza venda casada proibida pelo CDC art. 39, III, quando vinculado à conta corrente ou empréstimo.",
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
  const temTarifa = grupos.some((g) => classificar(g.descricao).categoria === "Tarifas Bancárias");
  const temSeguro = grupos.some((g) => classificar(g.descricao).categoria === "Seguros");
  const temTac = grupos.some((g) => classificar(g.descricao).categoria === "TAC — Vedada");
  const temTec = grupos.some((g) => classificar(g.descricao).categoria === "TEC — Vedada");

  const valorFmt = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dobroFmt = (valorTotal * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let texto = `Foram identificadas cobranças indevidas no extrato bancário do ${banco}, totalizando ${valorFmt}.`;

  if (temTarifa)
    texto += ` As tarifas bancárias (cestas de serviços) foram cobradas sem evidência de contratação expressa, violando a Resolução CMN nº 3.919/2010, que exige autorização formal e documentada do cliente.`;
  if (temSeguro)
    texto += ` Os seguros foram cobrados mensalmente sem apresentação de contrato assinado, caracterizando venda casada expressamente proibida pelo CDC Art. 39, III e pela Resolução CNSP 382/2020.`;
  if (temTac)
    texto += ` A TAC cobrada é expressamente vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  if (temTec)
    texto += ` A TEC cobrada é expressamente vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;

  texto += ` O consumidor tem direito à devolução em dobro totalizando ${dobroFmt}, conforme CDC Art. 42, parágrafo único. Recomenda-se: (1) notificação extrajudicial ao banco com prazo de 15 dias para devolução voluntária; (2) caso não atendido, ajuizamento de ação de repetição de indébito no Juizado Especial Cível com pedido de dano moral por prática abusiva. O prazo prescricional é de 5 anos para tarifas (Art. 27 do CDC) e 10 anos para seguros (Art. 205 do Código Civil).`;

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
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const periodoAnalisado = dataInicial && dataFinal ? `${dataInicial} a ${dataFinal}` : "Período não informado";

    // PASSO 1: Processa cada PDF em blocos bimestrais
    let todosItems: any[] = [];

    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        console.log(`\n📄 Processando: ${file.name} (${Math.round(file.base64?.length / 1024)}KB base64)`);
        const items = await extrairTodosLancamentos(file.base64, ANTHROPIC_API_KEY);
        todosItems = todosItems.concat(items);
      } else {
        console.log(`Arquivo ignorado (não PDF): ${file.name}`);
      }
    }

    console.log(`\nTotal items extraídos de todos os arquivos: ${todosItems.length}`);

    if (todosItems.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível extrair lançamentos. Verifique se o arquivo é um extrato bancário válido em PDF.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PASSO 3: Agrupa com matemática 100% no código
    const grupos = agruparPorDescricaoEValor(lancamentos);

    console.log(`\n=== GRUPOS FINAIS ===`);
    grupos.forEach((g) => console.log(`  [${g.ocorrencias}x R$${g.valorUnitario}] ${g.descricao} = R$${g.valorTotal}`));

    // PASSO 4: Monta resultado final
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
        prazo_prescricional:
          "5 anos para tarifas bancárias (Art. 27 do CDC) e 10 anos para seguros (Art. 205 do Código Civil)",
        prioridade: valor_total_indevido > 300 ? "alta" : "media",
      },
    };

    console.log("\n=== RESULTADO FINAL ===");
    console.log("Lançamentos individuais:", resultado.resumo.total_lancamentos);
    console.log("Grupos de cobranças:", resultado.resumo.irregularidades_encontradas);
    console.log("Total indevido: R$", resultado.resumo.valor_total_indevido);
    console.log("Estimativa 2x: R$", resultado.recomendacao.estimativa_recuperacao);
    console.log("Período:", resultado.resumo.periodo_analisado);

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
