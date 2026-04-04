const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Analisa texto puro extraído pelo pdf.js
async function analisarTextoPuro(texto: string, apiKey: string): Promise<string> {
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
      messages: [{
        role: "user",
        content: `Você é um copista de dados bancários. Analise o texto abaixo e copie CADA lançamento das categorias indicadas, UM POR LINHA.

CATEGORIAS:
- Tarifas: TARIFA, TAXA, CESTA, PACOTE, MANUTENÇÃO, MENSALIDADE CONTA
- Seguros: SEGURO, SEG., PRESTAMISTA, VIDA, PREV, PROTEÇÃO, PREVIDENCIA
- Capitalização: CAPITALIZ, TITULO CAP, CAP MENSAL
- Anuidades: ANUIDADE, ADM CARTÃO, ADMINISTRAÇÃO CARTÃO
- Vedadas: TAC, TEC, ABERTURA CRÉDITO, EMISSÃO CARNÊ
- Serviços: CLUBE, BENEFICIO, ASSISTÊNCIA, ASSINATURA, CONSÓRCIO

FORMATO — uma linha por lançamento:
DD/MM/AAAA | DESCRIÇÃO | VALOR

REGRAS:
- VALOR = valor EXATO daquela linha individual
- NUNCA some ou multiplique valores
- Mesma cobrança em vários meses = várias linhas separadas
- Use ponto decimal: 32.00
- NÃO inclua: IOF, saques, depósitos, transferências, compras, salário

TEXTO:
${texto.substring(0, 50000)}

Responda APENAS as linhas DATA | DESCRIÇÃO | VALOR:`,
      }],
    }),
  });

  if (!response.ok) {
    console.error("Erro analisarTextoPuro:", response.status, await response.text());
    return "";
  }
  const result = await response.json();
  return result.content?.[0]?.text || "";
}

// Extrai lançamentos diretamente do PDF via base64
async function extrairDoPdf(base64: string, apiKey: string): Promise<string> {
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
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: `Você é um copista de dados bancários. Leia TODAS as páginas deste extrato e copie CADA lançamento das categorias abaixo, UM POR LINHA.

CATEGORIAS:
- Tarifas: TARIFA, TAXA, CESTA, PACOTE, MANUTENÇÃO
- Seguros: SEGURO, SEG., PRESTAMISTA, VIDA, PREV, PROTEÇÃO
- Capitalização: CAPITALIZ, TITULO CAP
- Anuidades: ANUIDADE, ADM CARTÃO
- Vedadas: TAC, TEC, ABERTURA CRÉDITO
- Serviços: CLUBE, BENEFICIO, ASSISTÊNCIA, ASSINATURA

FORMATO — uma linha por lançamento:
DD/MM/AAAA | DESCRIÇÃO EXATA | VALOR

REGRAS ABSOLUTAS:
- VALOR = valor EXATO da coluna débito daquela linha
- NUNCA some ou multiplique
- Mesma cobrança em 12 meses = 12 linhas separadas
- NÃO inclua: IOF, saques, depósitos, transferências, compras, salário

Responda APENAS as linhas DATA | DESCRIÇÃO | VALOR:`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    console.error("Erro extrairDoPdf:", response.status, await response.text());
    return "";
  }
  const result = await response.json();
  return result.content?.[0]?.text || "";
}

function parsearLinhas(texto: string): Lancamento[] {
  const lancamentos: Lancamento[] = [];

  for (const linha of texto.split("\n")) {
    const trimmed = linha.trim();
    if (!trimmed || !trimmed.includes("|")) continue;

    const partes = trimmed.split("|").map(p => p.trim());
    if (partes.length < 3) continue;

    const data = partes[0].trim();
    const descricao = partes[1].trim();
    const valorStr = partes[2].trim().replace(/[^\d,\.]/g, "").replace(",", ".");
    const valor = parseFloat(valorStr);

    if (!data || !descricao || isNaN(valor) || valor <= 0) continue;
    if (!data.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/)) continue;

    const d = descricao.toUpperCase();
    if (
      d.includes("IOF") ||
      (d.includes("ENCARGO") && d.includes("LIMITE")) ||
      d.includes("SAQUE") || d.includes("DEPOSITO") || d.includes("DEPÓSITO") ||
      d.includes("TRANSFERENCIA") || d.includes("TRANSFERÊNCIA") ||
      d.includes("COMPRA") || d.includes("SALARIO") || d.includes("SALÁRIO") ||
      d.includes("CONTA DE LUZ") || d.includes("CONTA DE AGUA") ||
      d.includes("CONTA DE TELEFONE") || d.includes("RENDIMENTO")
    ) continue;

    const { indevido, categoria } = classificar(descricao);
    if (!indevido) continue;

    const limites: Record<string, number> = {
      "Tarifas Bancárias": 200, "Seguros": 250, "Capitalização": 300,
      "Anuidade Cartão": 300, "TAC — Vedada": 2000, "TEC — Vedada": 500,
      "Serviços Não Solicitados": 300,
    };

    if (valor > (limites[categoria] || 500)) {
      console.warn(`Rejeitado (possível soma): ${data} | ${descricao} | ${valor}`);
      continue;
    }

    lancamentos.push({ data, descricao, valor });
  }

  console.log(`Lançamentos válidos: ${lancamentos.length}`);
  lancamentos.forEach(l => console.log(`  ✓ ${l.data} | ${l.descricao} | R$${l.valor}`));
  return lancamentos;
}

function classificar(descricao: string): Classificacao {
  const d = descricao.toUpperCase();

  if (
    d.match(/TARIFA\s*(DE\s*)?(MANUT|PACOTE|CESTA|SERV|ADM)/) ||
    d.includes("CESTA") || d.includes("PACOTE DE SERV") ||
    d.includes("MANUTENÇÃO DE CONTA") || d.includes("MANUTENCAO DE CONTA") ||
    d.includes("TAXA DE MANUT") || d.includes("TAXA MANUT") ||
    d.includes("MENSALIDADE CONTA") || d.includes("TARIFA BANCARIA") ||
    d.includes("TARIFA BANCÁRIA") || d.includes("TAXA DE SERVICO") ||
    d.includes("TAXA DE SERVIÇO")
  ) {
    return {
      categoria: "Tarifas Bancárias",
      baseLegal: "Resolução CMN nº 3.919/2010 — tarifas só permitidas com contratação expressa",
      justificativa: "Tarifa bancária cobrada sem evidência de contratação expressa documentada pelo cliente.",
      indevido: true,
    };
  }

  if (
    d.includes("SEGURO") || d.includes("SEG.") || d.includes("PRESTAMISTA") ||
    d.includes("PROTEÇÃO") || d.includes("PROTECAO") ||
    d.includes("VIDA PREV") || d.includes("BRADESCO VIDA") ||
    d.includes("HAP VIDA") || d.includes("HP VIDA") ||
    d.includes("ITAUSEG") || d.includes("SANT SEG") || d.includes("BB SEG") ||
    d.includes("BRASILSEG") || d.includes("CAIXA SEG") || d.includes("BMG SEG") ||
    d.includes("SEGURO VIDA") || d.includes("SEG VIDA") || d.includes("SEG.VIDA")
  ) {
    return {
      categoria: "Seguros",
      baseLegal: "CDC Art. 39, III e IV — venda casada proibida; Resolução CNSP 382/2020",
      justificativa: "Seguro cobrado sem contrato assinado — caracteriza venda casada proibida pelo CDC Art. 39, III.",
      indevido: true,
    };
  }

  if (d.includes("CAPITALIZ") || d.includes("TITULO CAP") || d.includes("CAP MENSAL")) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida; Circular SUSEP 462/2013",
      justificativa: "Capitalização contratada sem autorização expressa do cliente.",
      indevido: true,
    };
  }

  if (
    d.includes("ANUIDADE") || d.includes("ADM CARTAO") || d.includes("ADM CARTÃO") ||
    d.includes("ADMINISTRAÇÃO CARTÃO") || d.includes("MENSALIDADE CARTAO") ||
    d.includes("MENSALIDADE CARTÃO")
  ) {
    return {
      categoria: "Anuidade Cartão",
      baseLegal: "Resolução CMN nº 3.919/2010 — anuidade só permitida com contratação expressa",
      justificativa: "Anuidade ou mensalidade de cartão cobrada sem autorização expressa do cliente.",
      indevido: true,
    };
  }

  if (
    d.includes("TAC") || d.includes("ABERTURA DE CREDITO") ||
    d.includes("ABERTURA DE CRÉDITO") || d.includes("ABERTURA CREDITO")
  ) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 30/04/2008",
      justificativa: "Tarifa de Abertura de Crédito proibida pelo Banco Central desde abril de 2008.",
      indevido: true,
    };
  }

  if (d.includes("TEC") || d.includes("EMISSAO DE CARNE") || d.includes("EMISSÃO DE CARNÊ")) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 30/04/2008",
      justificativa: "Taxa de Emissão de Carnê proibida pelo Banco Central desde abril de 2008.",
      indevido: true,
    };
  }

  if (
    d.includes("CLUBE") || d.includes("BENEFICIO") || d.includes("BENEFÍCIO") ||
    d.includes("ASSISTÊNCIA") || d.includes("ASSISTENCIA") || d.includes("ASSINATURA") ||
    d.includes("CONSORCIO") || d.includes("CONSÓRCIO") || d.includes("ODONTOL") ||
    d.includes("PREVIDENCIA PRIV")
  ) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — serviço sem solicitação é prática abusiva",
      justificativa: "Serviço cobrado sem autorização expressa do cliente.",
      indevido: true,
    };
  }

  return {
    categoria: "Cobranças Indevidas",
    baseLegal: "CDC Art. 39 — práticas abusivas proibidas",
    justificativa: "Cobrança sem evidência de contratação expressa.",
    indevido: false,
  };
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
        data: l.data, descricao: l.descricao,
        valorUnitario: l.valor, ocorrencias: 1, valorTotal: l.valor,
      });
    }
  }

  return Array.from(mapa.values()).sort((a, b) => {
    const ca = classificar(a.descricao).categoria;
    const cb = classificar(b.descricao).categoria;
    return ca !== cb ? ca.localeCompare(cb) : a.data.localeCompare(b.data);
  });
}

function gerarFundamentacao(grupos: GrupoCobranca[], banco: string, valorTotal: number): string {
  const cats = new Set(grupos.map(g => classificar(g.descricao).categoria));
  const vFmt = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dFmt = (valorTotal * 2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let t = `Foram identificadas cobranças indevidas no extrato bancário do ${banco}, totalizando ${vFmt}.`;
  if (cats.has("Tarifas Bancárias")) t += ` Tarifas cobradas sem contratação expressa violam a Resolução CMN nº 3.919/2010.`;
  if (cats.has("Seguros")) t += ` Seguros cobrados sem contrato assinado caracterizam venda casada proibida pelo CDC Art. 39, III e Resolução CNSP 382/2020.`;
  if (cats.has("Capitalização")) t += ` Capitalização sem autorização expressa configura venda casada (CDC Art. 39, III).`;
  if (cats.has("Anuidade Cartão")) t += ` Anuidades sem contratação expressa violam a Resolução CMN nº 3.919/2010.`;
  if (cats.has("TAC — Vedada")) t += ` TAC vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  if (cats.has("TEC — Vedada")) t += ` TEC vedada pelo Banco Central desde 30/04/2008 (Resolução BACEN 3.518/2007).`;
  if (cats.has("Serviços Não Solicitados")) t += ` Serviços não solicitados configuram prática abusiva (CDC Art. 39, III).`;
  t += ` Direito à devolução em dobro: ${dFmt} (CDC Art. 42, parágrafo único). Recomenda-se notificação extrajudicial com prazo de 15 dias e, se não atendido, ação de repetição de indébito no Juizado Especial Cível com pedido de dano moral. Prazo: 5 anos para tarifas (CDC Art. 27) e 10 anos para seguros (CC Art. 205).`;
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      banco, dataInicial, dataFinal, nomeCliente, cpf, numeroContrato,
      textoExtraido, imagensBase64, arquivosBase64,
    } = body;

    console.log("=== NOVA ANÁLISE ===");
    console.log("Banco:", banco, "| Período:", dataInicial, "a", dataFinal);
    console.log("textoExtraido:", textoExtraido?.length || 0, "chars");
    console.log("imagensBase64:", imagensBase64?.length || 0);
    console.log("arquivosBase64:", arquivosBase64?.length || 0);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const periodoAnalisado = dataInicial && dataFinal
      ? `${dataInicial} a ${dataFinal}` : "Período não informado";

    let linhasAnalisadas = "";

    // CAMINHO 1: Texto extraído pelo pdf.js no frontend (mais preciso)
    if (textoExtraido?.trim()) {
      console.log("CAMINHO 1: Analisando texto do pdf.js...");
      linhasAnalisadas = await analisarTextoPuro(textoExtraido, ANTHROPIC_API_KEY);
      console.log("Linhas extraídas via texto:", linhasAnalisadas.split("\n").filter(l => l.includes("|")).length);
    }

    // CAMINHO 2: PDFs via base64 (fallback quando pdf.js falha)
    if (!linhasAnalisadas.trim()) {
      const todosPdfs = [
        ...(arquivosBase64 || []),
        ...(imagensBase64 || []),
      ].filter((f: any) => f.mimeType === "application/pdf");

      if (todosPdfs.length > 0) {
        console.log(`CAMINHO 2: Extraindo de ${todosPdfs.length} PDF(s) via base64...`);
        for (const file of todosPdfs) {
          const resultado = await extrairDoPdf(file.base64, ANTHROPIC_API_KEY);
          linhasAnalisadas += resultado + "\n";
          console.log("Linhas extraídas do PDF:", resultado.split("\n").filter(l => l.includes("|")).length);
        }
      }
    }

    // CAMINHO 3: Imagens (fallback final)
    if (!linhasAnalisadas.trim()) {
      const imagens = [
        ...(arquivosBase64 || []),
        ...(imagensBase64 || []),
      ].filter((f: any) => f.mimeType !== "application/pdf");

      if (imagens.length > 0) {
        console.log(`CAMINHO 3: Analisando ${imagens.length} imagem(ns)...`);
        for (const img of imagens) {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-opus-4-6",
              max_tokens: 8000,
              messages: [{
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: img.mimeType, data: img.base64 } },
                  { type: "text", text: "Copie cada cobrança (TARIFA, SEGURO, CESTA) no formato: DATA | DESCRIÇÃO | VALOR. Uma linha por lançamento, valor individual." },
                ],
              }],
            }),
          });
          if (response.ok) {
            const r = await response.json();
            linhasAnalisadas += (r.content?.[0]?.text || "") + "\n";
          }
        }
      }
    }

    console.log("Total linhas brutas:", linhasAnalisadas.split("\n").filter(l => l.includes("|")).length);

    if (!linhasAnalisadas.trim()) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair lançamentos. Verifique se o arquivo é um extrato bancário válido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lancamentos = parsearLinhas(linhasAnalisadas);

    if (lancamentos.length === 0) {
      return new Response(JSON.stringify({
        resumo: { total_lancamentos: 0, irregularidades_encontradas: 0, valor_total_indevido: 0, periodo_analisado: periodoAnalisado, banco: banco || "Não informado" },
        cobrancas_indevidas: [], por_categoria: [],
        recomendacao: { tipo_acao: "Nenhuma irregularidade identificada", fundamentacao: "Não foram encontradas cobranças indevidas.", estimativa_recuperacao: 0, prazo_prescricional: "N/A", prioridade: "baixa" },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const grupos = agrupar(lancamentos);
    console.log("=== GRUPOS FINAIS ===");
    grupos.forEach(g => console.log(`  [${g.ocorrencias}x R$${g.valorUnitario}] ${g.descricao} = R$${g.valorTotal}`));

    const cobrancas_indevidas = grupos.map(g => {
      const { categoria, baseLegal, justificativa } = classificar(g.descricao);
      return {
        data: g.data, descricao: g.descricao,
        valor_unitario: g.valorUnitario, quantidade_ocorrencias: g.ocorrencias,
        valor_total: g.valorTotal, categoria, status: "confirmado",
        base_legal: baseLegal, justificativa, recorrente: g.ocorrencias > 1,
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
      categoria, total: v.total, ocorrencias: v.ocorrencias,
    }));

    const resultado = {
      resumo: {
        total_lancamentos: lancamentos.length,
        irregularidades_encontradas: cobrancas_indevidas.length,
        valor_total_indevido, periodo_analisado: periodoAnalisado,
        banco: banco || "Não informado",
      },
      cobrancas_indevidas, por_categoria,
      recomendacao: {
        tipo_acao: "Requerimento administrativo e/ou Ação Judicial de repetição de indébito",
        fundamentacao: gerarFundamentacao(grupos, banco || "banco", valor_total_indevido),
        estimativa_recuperacao,
        prazo_prescricional: "5 anos para tarifas (CDC Art. 27) e 10 anos para seguros (CC Art. 205)",
        prioridade: valor_total_indevido > 300 ? "alta" : "media",
      },
    };

    console.log("=== RESULTADO ===");
    console.log("Lançamentos:", resultado.resumo.total_lancamentos);
    console.log("Grupos:", resultado.resumo.irregularidades_encontradas);
    console.log("Total: R$", resultado.resumo.valor_total_indevido);
    console.log("2x: R$", resultado.recomendacao.estimativa_recuperacao);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("Erro geral:", e.message, e.stack);
    return new Response(
      JSON.stringify({ error: e.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
