const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Extrai texto bruto do PDF ─────────────────────────────────────
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
              text: `Você é um copista de dados bancários. Sua única função é transcrever literalmente linhas de extratos bancários.

Percorra TODAS as páginas deste extrato bancário e copie EXATAMENTE cada linha que contenha qualquer uma destas palavras ou similares:

PALAVRAS-CHAVE A BUSCAR (de qualquer banco):
TARIFA, TAXA, CESTA, PACOTE, MANUTENÇÃO, MANUTENCAO,
SEGURO, SEG., PROTEÇÃO, PROTECAO, PRESTAMISTA, VIDA, PREV, PREVIDENCIA,
CAPITALIZAÇÃO, CAPITALIZACAO, TITULO CAP,
TAC, TEC, ABERTURA, EMISSÃO CARNÊ,
CLUBE, BENEFICIO, ASSISTÊNCIA, ASSISTENCIA,
ANUIDADE, ADMINISTRAÇÃO CARTÃO, ADM CARTÃO,
COBRANÇA INDEVIDA, DEBITO INDEVIDO,
SERVIÇO, SERVICO, ASSINATURA, MENSALIDADE

FORMATO OBRIGATÓRIO — uma linha por lançamento:
DD/MM/AAAA | DESCRIÇÃO EXATA DO EXTRATO | VALOR_DÉBITO

REGRAS ABSOLUTAS:
- Copie o valor EXATO da coluna débito daquela linha individual
- NÃO calcule, NÃO some, NÃO interprete nada
- Se a mesma cobrança aparece em 12 meses = 12 linhas separadas
- Inclua TODAS as páginas do documento
- NÃO inclua: IOF, ENCARGOS LIMITE, saques, depósitos, transferências, compras, salário, pagamento de conta (luz, água, telefone)
- Se não tiver certeza se é cobrança indevida, inclua assim mesmo — melhor sobrar do que faltar

Exemplo de saída correta:
06/01/2024 | TARIFA PACOTE SERVICOS ESSENCIAL | 32,90
06/02/2024 | TARIFA PACOTE SERVICOS ESSENCIAL | 32,90
15/01/2024 | SEGURO PRESTAMISTA MENSAL | 28,50
15/02/2024 | SEGURO PRESTAMISTA MENSAL | 28,50

Comece a transcrição agora, sem preâmbulo:`,
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
  console.log("=== TEXTO BRUTO EXTRAÍDO ===\n", texto);
  return texto;
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

interface Classificacao {
  categoria: string;
  baseLegal: string;
  justificativa: string;
  indevido: boolean;
}

// ─── Parseia texto bruto ───────────────────────────────────────────
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
    if (descricao.length < 3) continue;

    const descUpper = descricao.toUpperCase();

    // Exclui categorias claramente não indevidas
    if (
      descUpper.includes("IOF") ||
      (descUpper.includes("ENCARGO") && descUpper.includes("LIMITE")) ||
      descUpper.includes("SAQUE") ||
      descUpper.includes("DEPOSITO") ||
      descUpper.includes("DEPÓSITO") ||
      descUpper.includes("TRANSFERENCIA") ||
      descUpper.includes("TRANSFERÊNCIA") ||
      descUpper.includes("TED ") ||
      descUpper.includes("DOC ") ||
      descUpper.includes("COMPRA ") ||
      descUpper.includes("SALARIO") ||
      descUpper.includes("SALÁRIO") ||
      descUpper.includes("CONTA DE LUZ") ||
      descUpper.includes("CONTA DE AGUA") ||
      descUpper.includes("CONTA DE ÁGUA") ||
      descUpper.includes("CONTA DE TELEFONE") ||
      descUpper.includes("CONTA DE ESGOTO") ||
      descUpper.includes("PAGTO FATURA") ||
      descUpper.includes("PAGTO CARTAO") ||
      descUpper.includes("PAGTO CARTÃO") ||
      descUpper.includes("PAGTO BOLETO") ||
      descUpper.includes("RENDIMENTO") ||
      descUpper.includes("JUROS CRED")
    ) {
      console.log(`Excluído: ${data} | ${descricao}`);
      continue;
    }

    // Verifica se o valor é suspeito (possível soma)
    // Para tarifas e seguros individuais, raramente passam de R$150
    const { indevido } = classificar(descricao);
    if (!indevido) {
      console.log(`Não classificado como indevido: ${descricao}`);
      continue;
    }

    // Limite de valor por categoria para detectar somas acidentais
    const cat = classificar(descricao).categoria;
    const limites: Record<string, number> = {
      "Tarifas Bancárias": 200,
      Seguros: 250,
      Capitalização: 300,
      "Anuidade Cartão": 200,
      "Serviços Não Solicitados": 200,
      "TAC — Vedada": 1000,
      "TEC — Vedada": 500,
      "Cobranças Indevidas": 500,
    };

    const limite = limites[cat] || 500;
    if (valor > limite) {
      console.warn(`REJEITADO (valor ${valor} > limite ${limite} para ${cat}): ${data} | ${descricao}`);
      continue;
    }

    lancamentos.push({ data, descricao, valor });
  }

  console.log(`\n=== LANÇAMENTOS VÁLIDOS: ${lancamentos.length} ===`);
  lancamentos.forEach((l) => console.log(`  ✓ ${l.data} | ${l.descricao} | R$${l.valor}`));
  return lancamentos;
}

// ─── Classificação jurídica universal (multi-banco) ────────────────
function classificar(descricao: string): Classificacao {
  const d = descricao.toUpperCase();

  // ── TARIFAS BANCÁRIAS ─────────────────────────────────────────
  if (
    // Genérico
    d.match(/TARIFA\s*(DE\s*)?(MANUT|PACOTE|CESTA|SERV|ADM|ADMIN)/) ||
    d.includes("CESTA") ||
    d.includes("PACOTE DE SERV") ||
    d.includes("MANUTENÇÃO DE CONTA") ||
    d.includes("MANUTENCAO DE CONTA") ||
    d.includes("TAXA DE MANUT") ||
    d.includes("TAXA MANUT") ||
    // Bradesco
    d.includes("CESTA CELULAR") ||
    d.includes("CESTA CLASSIC") ||
    d.includes("CESTA PREMIUM") ||
    // Itaú
    d.includes("PACOTE ITAU") ||
    d.includes("TARIFA ITAU") ||
    d.includes("MENSALIDADE CONTA") ||
    // Santander
    d.includes("TARIFA SANTANDER") ||
    d.includes("CONTA UNIVERSITÁRIA") ||
    // BB
    d.includes("TARIFA BB") ||
    d.includes("PACOTE BB") ||
    // Caixa
    d.includes("TARIFA CAIXA") ||
    d.includes("PACOTE CAIXA") ||
    // BMG / Consignado
    d.includes("TARIFA BMG") ||
    // Genérico
    d.includes("TAXA DE SERVICO") ||
    d.includes("TAXA DE SERVIÇO") ||
    d.includes("TARIFA SERVICO") ||
    d.includes("TARIFA SERVIÇO")
  ) {
    return {
      categoria: "Tarifas Bancárias",
      baseLegal: "Resolução CMN nº 3.919/2010 — tarifas só permitidas com contratação expressa e documentada",
      justificativa:
        "Tarifa bancária cobrada sem evidência de contratação expressa. A Resolução CMN 3.919/2010 exige autorização formal do cliente para qualquer cobrança de tarifa ou pacote de serviços.",
      indevido: true,
    };
  }

  // ── SEGUROS ───────────────────────────────────────────────────
  if (
    // Genérico
    d.includes("SEGURO") ||
    d.includes("SEG.") ||
    d.includes("PRESTAMISTA") ||
    d.includes("PROTEÇÃO") ||
    d.includes("PROTECAO") ||
    d.includes("SEGURO VIDA") ||
    d.includes("SEG VIDA") ||
    d.includes("SEG.VIDA") ||
    // Bradesco
    d.includes("BRADESCO VIDA") ||
    d.includes("VIDA PREV") ||
    d.includes("HAP VIDA") ||
    d.includes("HP VIDA") ||
    // Itaú
    d.includes("ITAU VIDA") ||
    d.includes("ITAUSEG") ||
    // Santander
    d.includes("SANT SEG") ||
    d.includes("SANTANDER SEG") ||
    // BB
    d.includes("BB SEG") ||
    d.includes("BRASILSEG") ||
    d.includes("BRASILPREV") ||
    // Caixa
    d.includes("CAIXA SEG") ||
    d.includes("CAIXASEG") ||
    // BMG
    d.includes("BMG SEG") ||
    d.includes("SEGURO BMG") ||
    // Genérico
    d.includes("SEGURO PRESTAMISTA") ||
    d.includes("SEGURO DESEMPREGO") ||
    d.includes("SEGURO ACIDENTES") ||
    d.includes("SEGURO RESIDENCIAL") ||
    d.includes("SEGURO AUTO") ||
    d.includes("SEGURO CARTAO") ||
    d.includes("SEGURO CARTÃO")
  ) {
    return {
      categoria: "Seguros",
      baseLegal:
        "CDC Art. 39, III e IV — venda casada proibida; Resolução CNSP 382/2020 — seguro exige contratação expressa e independente",
      justificativa:
        "Seguro cobrado mensalmente sem apresentação de contrato assinado pelo cliente. Caracteriza venda casada proibida pelo CDC Art. 39, III.",
      indevido: true,
    };
  }

  // ── CAPITALIZAÇÃO ─────────────────────────────────────────────
  if (
    d.includes("CAPITALIZ") ||
    d.includes("TITULO CAP") ||
    d.includes("TÍTULO CAP") ||
    d.includes("CAP MENSAL") ||
    d.includes("POUPANÇA PREMIADA")
  ) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida; Circular SUSEP 462/2013",
      justificativa:
        "Título de capitalização contratado sem autorização expressa do cliente. Prática de venda casada vedada pelo CDC.",
      indevido: true,
    };
  }

  // ── ANUIDADE CARTÃO ───────────────────────────────────────────
  if (
    d.includes("ANUIDADE") ||
    d.includes("ANUIDADE CARTAO") ||
    d.includes("ANUIDADE CARTÃO") ||
    d.includes("MENSALIDADE CARTAO") ||
    d.includes("MENSALIDADE CARTÃO") ||
    d.includes("ADM CARTAO") ||
    d.includes("ADM CARTÃO") ||
    d.includes("ADMINISTRAÇÃO CARTÃO")
  ) {
    return {
      categoria: "Anuidade Cartão",
      baseLegal: "Resolução CMN nº 3.919/2010 — anuidade só é permitida com contratação expressa documentada",
      justificativa: "Anuidade ou mensalidade de cartão cobrada sem autorização expressa do cliente.",
      indevido: true,
    };
  }

  // ── TAC ───────────────────────────────────────────────────────
  if (
    d.includes("TAC") ||
    d.includes("TARIFA ABERTURA") ||
    d.includes("ABERTURA DE CREDITO") ||
    d.includes("ABERTURA DE CRÉDITO") ||
    d.includes("ABERTURA CRÉDITO") ||
    d.includes("ABERTURA CREDITO")
  ) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 30/04/2008",
      justificativa:
        "Tarifa de Abertura de Crédito expressamente proibida pelo Banco Central desde abril de 2008. Cobrança totalmente ilegal.",
      indevido: true,
    };
  }

  // ── TEC ───────────────────────────────────────────────────────
  if (
    d.includes("TEC") ||
    d.includes("EMISSAO DE CARNE") ||
    d.includes("EMISSÃO DE CARNÊ") ||
    d.includes("EMISSÃO CARNE") ||
    d.includes("EMISSÃO CARNÊ")
  ) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 30/04/2008",
      justificativa: "Taxa de Emissão de Carnê expressamente proibida pelo Banco Central desde abril de 2008.",
      indevido: true,
    };
  }

  // ── SERVIÇOS NÃO SOLICITADOS ──────────────────────────────────
  if (
    d.includes("CLUBE") ||
    d.includes("BENEFICIO") ||
    d.includes("BENEFÍCIO") ||
    d.includes("ASSISTÊNCIA") ||
    d.includes("ASSISTENCIA") ||
    d.includes("ASSINATURA") ||
    d.includes("MENSALIDADE SERV") ||
    d.includes("SERVIÇO DIGITAL") ||
    d.includes("PLANO ") ||
    d.includes("COBERTURA ") ||
    d.includes("ODONTOL") ||
    d.includes("RESIDENCIAL PROT") ||
    d.includes("PREVIDENCIA PRIV") ||
    d.includes("PREVIDÊNCIA PRIV") ||
    d.includes("CONSORCIO") ||
    d.includes("CONSÓRCIO")
  ) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — fornecimento de serviço sem solicitação prévia é prática abusiva",
      justificativa:
        "Serviço contratado e cobrado sem autorização expressa do cliente. Prática abusiva vedada pelo Código de Defesa do Consumidor.",
      indevido: true,
    };
  }

  return {
    categoria: "Cobranças Indevidas",
    baseLegal: "CDC Art. 39 — práticas abusivas proibidas",
    justificativa: "Cobrança sem evidência de contratação expressa pelo cliente.",
    indevido: false,
  };
}

// ─── Agrupa por descrição + valor ─────────────────────────────────
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

// ─── Fundamentação jurídica ────────────────────────────────────────
function gerarFundamentacao(grupos: GrupoCobranca[], banco: string, valorTotal: number): string {
  const categorias = new Set(grupos.map((g) => classificar(g.descricao).categoria));

  const vFmt = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dFmt = (valorTotal * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let t = `Foram identificadas cobranças indevidas no extrato bancário do ${banco}, totalizando ${vFmt}.`;

  if (categorias.has("Tarifas Bancárias")) {
    t += ` Tarifas bancárias/pacotes de serviços cobrados sem contratação expressa violam a Resolução CMN nº 3.919/2010.`;
  }
  if (categorias.has("Seguros")) {
    t += ` Seguros cobrados sem contrato assinado caracterizam venda casada proibida pelo CDC Art. 39, III e Resolução CNSP 382/2020.`;
  }
  if (categorias.has("Capitalização")) {
    t += ` Capitalização contratada sem autorização expressa configura venda casada (CDC Art. 39, III).`;
  }
  if (categorias.has("Anuidade Cartão")) {
    t += ` Anuidades de cartão sem contratação expressa violam a Resolução CMN nº 3.919/2010.`;
  }
  if (categorias.has("TAC — Vedada")) {
    t += ` TAC cobrada é vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  }
  if (categorias.has("TEC — Vedada")) {
    t += ` TEC cobrada é vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  }
  if (categorias.has("Serviços Não Solicitados")) {
    t += ` Serviços não solicitados cobrados configuram prática abusiva vedada pelo CDC Art. 39, III.`;
  }

  t += ` O consumidor tem direito à devolução em dobro totalizando ${dFmt} (CDC Art. 42, parágrafo único). Recomenda-se notificação extrajudicial ao banco com prazo de 15 dias e, se não atendido, ajuizamento de ação de repetição de indébito no Juizado Especial Cível com pedido de dano moral. Prazo prescricional: 5 anos para tarifas e anuidades (CDC Art. 27) e 10 anos para seguros e capitalização (CC Art. 205).`;

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
    console.log("Cliente:", nomeCliente, "| Arquivos:", arquivosBase64?.length);

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
      } else {
        console.log(`Ignorado (não PDF): ${file.name}`);
      }
    }

    if (!textoBrutoTotal.trim()) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível extrair lançamentos do PDF. Verifique se é um extrato bancário válido.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PASSO 2: Parseia localmente
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
            fundamentacao: "Não foram encontradas cobranças indevidas no período analisado.",
            estimativa_recuperacao: 0,
            prazo_prescricional: "N/A",
            prioridade: "baixa",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PASSO 3: Agrupa e calcula no código
    const grupos = agrupar(lancamentos);

    console.log(`\n=== GRUPOS FINAIS ===`);
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
        prazo_prescricional:
          "5 anos para tarifas e anuidades (CDC Art. 27) e 10 anos para seguros e capitalização (CC Art. 205)",
        prioridade: valor_total_indevido > 300 ? "alta" : "media",
      },
    };

    console.log("\n=== RESULTADO FINAL ===");
    console.log("Lançamentos:", resultado.resumo.total_lancamentos);
    console.log("Grupos:", resultado.resumo.irregularidades_encontradas);
    console.log("Total indevido: R$", resultado.resumo.valor_total_indevido);
    console.log("Estimativa 2x: R$", resultado.recomendacao.estimativa_recuperacao);

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
