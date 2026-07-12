const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Modelos de IA. OpenAI é o primário; Claude é o fallback.
// Ajustáveis por env sem alterar código.
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-7";

interface Lancamento {
  data: string;
  descricao: string;
  valor: number;
}

interface Classificacao {
  categoria: string;
  baseLegal: string;
  justificativa: string;
  indevido: boolean;
}

// Gera as instruções do copista, incorporando a lista de tipos selecionados
// pelo usuário (detecção precisa) + orientação inteligente para variações.
function instrucoesCopista(tipos?: string[]): string {
  let alvo = `CATEGORIAS A CAPTURAR (e QUALQUER variação de escrita, abreviação, acento ou nome de seguradora/serviço):
- Tarifas e cestas: TARIFA, TAXA, CESTA, PACOTE, MANUTENÇÃO, MENSALIDADE, ANUIDADE, ADM CARTÃO, 2ª VIA, EMISSÃO EXTRATO
- Seguros: SEGURO, SEG., PRESTAMISTA, VIDA, PREV, PROTEÇÃO, PREVIDÊNCIA, AP, RESIDENCIAL, AUTO
- Capitalização e clubes: CAPITALIZ, TÍTULO CAP, CLUBE, BENEFÍCIO, ASSISTÊNCIA, ASSINATURA, CONSÓRCIO, ODONTO
- Cobranças de seguradora/serviço: PAGTO ELETRON COBRANCA (de seguradora/clube/assistência), nomes como SABEMI, LIBERTY, SOROCRED, SUDAMERICA, ASPECIR
- Vedadas: TAC, TEC, ABERTURA CRÉDITO, EMISSÃO CARNÊ`;

  if (tipos && tipos.length > 0) {
    const lista = tipos.slice(0, 200).map((t) => `• ${t}`).join("\n");
    alvo = `O usuário marcou ESTES tipos de cobrança para procurar. Capture TODAS as ocorrências que correspondam a qualquer um deles — reconhecendo variações de escrita, abreviações, maiúsculas/minúsculas, acentos e nomes de seguradora/serviço (ex.: "SEG PREST" = "SEGURO PRESTAMISTA"):

${lista}

Além desses, capture também qualquer SEGURO, TARIFA, CESTA, CAPITALIZAÇÃO, CLUBE, ASSISTÊNCIA ou ANUIDADE que apareça no extrato, mesmo que não esteja exatamente na lista acima.`;
  }

  return `Você é um AUDITOR especialista em detectar cobranças indevidas de TARIFAS, SEGUROS e SERVIÇOS (venda casada) em extratos bancários. Leia TODO o conteúdo e copie CADA lançamento que se enquadre, UM POR LINHA — sem omitir nenhum.

${alvo}

FORMATO — uma linha por lançamento:
DD/MM/AAAA | DESCRIÇÃO (exatamente como no extrato) | VALOR

REGRAS:
- Capture TODAS as ocorrências: a mesma cobrança repetida em vários meses gera VÁRIAS linhas (uma por mês).
- VALOR = valor EXATO daquela linha individual. NUNCA some, agrupe ou multiplique.
- Use ponto decimal (ex.: 32.00). Não use separador de milhar.
- Preserve a descrição original do extrato (não traduza nem padronize).
- DESCRIÇÃO COMPLETA: se a descrição vier quebrada em duas linhas (ex.: "TARIFA BANCARIA" numa linha e "CESTA FACIL ECONOMICA" ou "VR.PARCIAL CESTA FACIL ECONO" na outra), JUNTE as duas numa só descrição (ex.: "TARIFA BANCARIA CESTA FACIL ECONOMICA"). NUNCA devolva só o cabeçalho genérico "TARIFA BANCARIA" — inclua sempre o tipo específico da tarifa.
- NUNCA inclua (NÃO são tarifa/seguro indevido — são dinheiro do próprio cliente ou a dívida em si):
  • Pagamento, parcela, mora ou amortização de EMPRÉSTIMO / CRÉDITO PESSOAL / CONSIGNADO / OPERAÇÃO DE CRÉDITO (ex.: "MORA CREDITO PESSOAL", "PARCELA CREDITO PESSOAL" — é a quitação da dívida, não uma taxa)
  • Gastos, compras ou fatura de CARTÃO DE CRÉDITO (ex.: "GASTOS CARTAO DE CREDITO" — é o gasto do próprio cliente)
  • PIX, TED, DOC, transferências, estornos, depósitos, saques, aplicações, resgates, poupança
  • IOF, salário, benefício, rendimento, pagamento de contas de consumo (luz/água/telefone)
- Na dúvida entre incluir ou não um SEGURO/TARIFA/SERVIÇO de venda casada, INCLUA (o advogado filtra depois).`;
}

interface AIKeys { openai?: string; anthropic?: string }

// Chamada genérica ao OpenAI Chat Completions (aceita texto ou visão).
async function openaiChat(apiKey: string, messages: unknown[], maxTokens = 16000): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, messages, max_tokens: maxTokens, temperature: 0 }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${(await resp.text()).substring(0, 300)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// Chamada genérica ao Claude (content = string ou array de blocks).
async function claudeMessages(apiKey: string, content: unknown, maxTokens = 16000): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${(await resp.text()).substring(0, 300)}`);
  const data = await resp.json();
  return data.content?.[0]?.text || "";
}

const respostaCopista = "\n\nResponda APENAS as linhas DATA | DESCRIÇÃO | VALOR:";

// Extração a partir de TEXTO (OpenAI primário → Claude fallback).
async function extrairDeTexto(texto: string, keys: AIKeys, tipos?: string[]): Promise<string> {
  const userMsg = `TEXTO DO EXTRATO:\n${texto.substring(0, 50000)}${respostaCopista}`;
  if (keys.openai) {
    try {
      return await openaiChat(keys.openai, [
        { role: "system", content: instrucoesCopista(tipos) },
        { role: "user", content: userMsg },
      ]);
    } catch (e) { console.error("OpenAI texto falhou; fallback Claude:", (e as Error).message); }
  }
  if (keys.anthropic) return await claudeMessages(keys.anthropic, `${instrucoesCopista(tipos)}\n\n${userMsg}`);
  throw new Error("Nenhuma chave de IA disponível para extração de texto");
}

// Extração a partir de IMAGEM (OpenAI Vision → Claude Vision).
async function extrairDeImagem(base64: string, mime: string, keys: AIKeys, tipos?: string[]): Promise<string> {
  const instrucao = `${instrucoesCopista(tipos)}${respostaCopista}`;
  if (keys.openai) {
    try {
      return await openaiChat(keys.openai, [{
        role: "user",
        content: [
          { type: "text", text: instrucao },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      }], 8000);
    } catch (e) { console.error("OpenAI imagem falhou; fallback Claude:", (e as Error).message); }
  }
  if (keys.anthropic) {
    return await claudeMessages(keys.anthropic, [
      { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
      { type: "text", text: instrucao },
    ], 8000);
  }
  throw new Error("Nenhuma chave de IA disponível para extração de imagem");
}

// Extração a partir de PDF cru escaneado (só o Claude lê PDF nativo).
// Ideal: o frontend converte PDF escaneado em imagem e cai em extrairDeImagem.
async function extrairDePdf(base64: string, keys: AIKeys, tipos?: string[]): Promise<string> {
  if (!keys.anthropic) {
    throw new Error("Leitura de PDF escaneado requer ANTHROPIC_API_KEY (ou envie o extrato como imagem)");
  }
  return await claudeMessages(keys.anthropic, [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
    { type: "text", text: `Leia TODAS as páginas deste extrato (use o valor da coluna de DÉBITO de cada linha).\n\n${instrucoesCopista(tipos)}${respostaCopista}` },
  ]);
}

// Tetos por categoria — sanity check para não capturar o valor de um
// empréstimo/financiamento inteiro. Também serve para DESAMBIGUAR o valor da
// transação vs. saldo na extração determinística.
const LIMITES: Record<string, number> = {
  "Tarifas Bancárias": 250,
  "Seguros": 400,
  "Capitalização": 600,
  "Anuidade Cartão": 400,
  "TAC — Vedada": 5000,
  "TEC — Vedada": 1500,
  "Serviços Não Solicitados": 600,
  "Cobranças Indevidas": 600,
};

// Filtra e classifica lançamentos BRUTOS (venham do parser determinístico ou da IA).
// Retorna apenas as cobranças indevidas válidas.
function filtrarClassificar(brutos: Lancamento[]): Lancamento[] {
  const lancamentos: Lancamento[] = [];

  for (const { data, descricao, valor } of brutos) {
    if (!data || !descricao || isNaN(valor) || valor <= 0) continue;
    if (!data.match(/\d{2}[\/\-]\d{2}([\/\-]\d{2,4})?/)) continue;

    const d = descricao.toUpperCase();

    // Exclui categorias não indevidas (movimentações comuns)
    if (
      d.includes("IOF") ||
      d.includes("SAQUE") ||
      d.includes("DEPOSITO") ||
      d.includes("DEPÓSITO") ||
      d.includes("TRANSFERENCIA") ||
      d.includes("TRANSFERÊNCIA") ||
      d.includes("TRANSF") ||
      d.includes("COMPRA") ||
      d.includes("SALARIO") ||
      d.includes("SALÁRIO") ||
      d.includes("CONTA DE LUZ") ||
      d.includes("CONTA DE AGUA") ||
      d.includes("CONTA DE TELEFONE") ||
      d.includes("RENDIMENTO")
    ) continue;

    // Exclui o PRÓPRIO empréstimo/cartão do cliente — NÃO é tarifa/seguro indevido.
    // "MORA CREDITO PESSOAL", "PARCELA CREDITO PESSOAL" = quitação da dívida (principal);
    // "GASTOS CARTAO DE CREDITO" = gasto do próprio cliente. Contar isso inflaria o laudo
    // com o valor da dívida/gasto, não com a cobrança casada.
    if (
      d.includes("CREDITO PESSOAL") || d.includes("CRÉDITO PESSOAL") ||
      d.includes("CRED PESS") ||
      d.includes("PARCELA") || d.includes("PARC CRED") ||
      d.includes("OPER DE CREDITO") || d.includes("OPERACAO DE CREDITO") ||
      d.includes("OPERAÇÃO DE CRÉDITO") || d.includes("OPERACOES VENCIDAS") ||
      d.includes("OPERAÇÕES VENCIDAS") ||
      d.includes("GASTOS CARTAO") || d.includes("GASTOS CARTÃO") ||
      d.includes("GASTO C CRED") || d.includes("PROVISAO GASTO") ||
      d.includes("FATURA") ||
      d.includes("PIX") || d.includes("DOC CRED") || d.includes("DOC AUTOM") ||
      d.includes("ESTORNO") || d.includes("POUP") ||
      d.includes("APLIC") || d.includes("RESGATE") ||
      d.includes("BX.ANT") || d.includes("BX ANT") ||
      d.includes("AMORTIZ")
    ) continue;

    // Exclui anuidades de conselhos profissionais
    if (
      d.includes("CRC") ||
      d.includes("CRM") ||
      d.includes("OAB") ||
      d.includes("CREA") ||
      d.includes("CFO") ||
      d.includes("CONSELHO") ||
      d.includes("CFMV") ||
      d.includes("COREN") ||
      d.includes("CAU")
    ) continue;

    const { indevido, categoria } = classificar(descricao);
    if (!indevido) continue;

    if (valor > (LIMITES[categoria] ?? 600)) {
      console.warn(`Rejeitado (valor alto, possível soma/saldo): ${data} | ${descricao} | ${valor} > limite ${LIMITES[categoria] ?? 600}`);
      continue;
    }

    lancamentos.push({ data, descricao, valor });
  }

  console.log(`Lançamentos válidos: ${lancamentos.length}`);
  lancamentos.forEach((l) => console.log(`  ✓ ${l.data} | ${l.descricao} | R$${l.valor}`));
  return lancamentos;
}

// Converte a saída da IA ("DATA | DESCRIÇÃO | VALOR") em lançamentos brutos.
function parsearPipe(texto: string): Lancamento[] {
  const brutos: Lancamento[] = [];
  for (const linha of texto.split("\n")) {
    const trimmed = linha.trim();
    if (!trimmed || !trimmed.includes("|")) continue;
    const partes = trimmed.split("|").map((p) => p.trim());
    if (partes.length < 3) continue;
    const data = partes[0].trim();
    const descricao = partes[1].trim();
    const valor = parseFloat(partes[2].trim().replace(/[^\d,\.]/g, "").replace(",", "."));
    brutos.push({ data, descricao, valor });
  }
  return brutos;
}

// ── EXTRAÇÃO DETERMINÍSTICA (SEM IA) ──────────────────────────────────────────
// Lê o texto já estruturado por linha (o pdf.js do frontend agrupa por coordenada
// Y, então cada transação fica numa linha). Para cada linha com DATA + VALOR(es),
// extrai o lançamento. Quando há vários valores na linha (ex.: valor + saldo),
// desambigua usando o teto da categoria da descrição.
const reValorGlobal = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g;
const reDataInicio = /^\s*(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})\b/;

// Um cabeçalho GENÉRICO (ex.: só "TARIFA BANCARIA") precisa do especificador da
// linha vizinha (ex.: "CESTA FACIL ECONOMICA") para identificar o tipo da tarifa.
function ehCabecalhoGenerico(d: string): boolean {
  return /^(TARIFAS?( BANCARIA)?|SEGURO|SEG\.?|TAXA|CESTA|PACOTE)$/.test(d.toUpperCase().trim());
}

// Quebra uma linha em { data, valores, desc }.
function analisarLinha(l: string): { data: string; valores: number[]; desc: string } {
  const dm = l.match(reDataInicio);
  let corpo = l;
  let data = "";
  if (dm) { data = `${dm[1]}/${dm[2]}/${dm[3]}`; corpo = l.slice(dm[0].length); }
  const valores = [...corpo.matchAll(reValorGlobal)]
    .map((m) => parseFloat(m[0].replace(/\./g, "").replace(",", ".")))
    .filter((v) => v > 0);
  const desc = corpo.replace(reValorGlobal, " ").replace(/\b\d{5,}\b/g, " ").replace(/\s+/g, " ").trim();
  return { data, valores, desc };
}

function extrairDeterministico(texto: string): Lancamento[] {
  const brutos: Lancamento[] = [];
  const linhas = texto.split("\n");

  // Muitos bancos (ex.: Bradesco) repetem a data só no 1º lançamento do dia e
  // quebram a descrição em 2 linhas ("TARIFA BANCARIA" + "CESTA FACIL ECONOMICA").
  // O valor pode cair na linha do rótulo OU na do especificador — tratamos ambos.
  let dataAtual = "";
  let prefixo = "";

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l || l.startsWith("---")) continue;

    const { data, valores, desc } = analisarLinha(l);
    if (data) dataAtual = data;

    if (valores.length === 0) {
      // Linha "rótulo" (sem valor). Se for de categoria indevida, vira o prefixo
      // da descrição da próxima linha (que carrega o valor). Senão, zera o prefixo.
      prefixo = desc && classificar(desc).indevido ? desc : "";
      continue;
    }

    if (!dataAtual) continue; // ainda sem contexto de data

    let descFinal = (prefixo ? `${prefixo} ` : "") + desc;
    prefixo = "";

    // Look-ahead: se a descrição ficou genérica ("TARIFA BANCARIA"), anexa o
    // especificador da PRÓXIMA linha de texto puro (sem data e sem valor).
    if (ehCabecalhoGenerico(descFinal)) {
      const bruta = (linhas[i + 1] || "").trim();
      const prox = analisarLinha(bruta);
      if (bruta && !prox.data && prox.valores.length === 0 && prox.desc.length >= 3) {
        descFinal += ` ${prox.desc}`;
        i++; // consome a linha do especificador
      }
    }

    if (!descFinal || descFinal.length < 3) continue;

    // Desambigua valor vs. saldo: prefere o 1º valor dentro do teto da categoria.
    const { categoria } = classificar(descFinal);
    const limite = LIMITES[categoria] ?? 600;
    const dentro = valores.filter((v) => v <= limite);
    const valor = dentro.length ? dentro[0] : valores[0];

    brutos.push({ data: dataAtual, descricao: descFinal, valor });
  }

  console.log(`[determinístico] candidatos brutos: ${brutos.length}`);
  return brutos;
}

function classificar(descricao: string): Classificacao {
  const d = descricao.toUpperCase();

  if (
    d.match(/TARIFA\s*(DE\s*)?(MANUT|PACOTE|CESTA|SERV|ADM)/) ||
    d.includes("CESTA") ||
    d.includes("PACOTE DE SERV") ||
    d.includes("MANUTENÇÃO DE CONTA") ||
    d.includes("MANUTENCAO DE CONTA") ||
    d.includes("TAXA DE MANUT") ||
    d.includes("TAXA MANUT") ||
    d.includes("MENSALIDADE CONTA") ||
    d.includes("TARIFA BANCARIA") ||
    d.includes("TARIFA BANCÁRIA") ||
    d.includes("TAXA DE SERVICO") ||
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
    d.includes("SEGURO") ||
    d.includes("SEG.") ||
    d.includes("PRESTAMISTA") ||
    d.includes("PROTEÇÃO") ||
    d.includes("PROTECAO") ||
    d.includes("VIDA PREV") ||
    d.includes("BRADESCO VIDA") ||
    d.includes("HAP VIDA") ||
    d.includes("HP VIDA") ||
    d.includes("ITAUSEG") ||
    d.includes("SANT SEG") ||
    d.includes("BB SEG") ||
    d.includes("BRASILSEG") ||
    d.includes("CAIXA SEG") ||
    d.includes("BMG SEG") ||
    d.includes("SEGURO VIDA") ||
    d.includes("SEG VIDA") ||
    d.includes("SEG.VIDA")
  ) {
    return {
      categoria: "Seguros",
      baseLegal: "CDC Art. 39, III e IV — venda casada proibida; Resolução CNSP 382/2020",
      justificativa: "Seguro cobrado sem contrato assinado — caracteriza venda casada proibida pelo CDC Art. 39, III.",
      indevido: true,
    };
  }

  if (
    d.includes("CAPITALIZ") ||
    d.includes("TITULO CAP") ||
    d.includes("CAP MENSAL")
  ) {
    return {
      categoria: "Capitalização",
      baseLegal: "CDC Art. 39, III — venda casada proibida; Circular SUSEP 462/2013",
      justificativa: "Capitalização contratada sem autorização expressa do cliente.",
      indevido: true,
    };
  }

  if (
    d.includes("ANUIDADE") ||
    d.includes("ADM CARTAO") ||
    d.includes("ADM CARTÃO") ||
    d.includes("ADMINISTRAÇÃO CARTÃO") ||
    d.includes("MENSALIDADE CARTAO") ||
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
    d.includes("TAC") ||
    d.includes("ABERTURA DE CREDITO") ||
    d.includes("ABERTURA DE CRÉDITO") ||
    d.includes("ABERTURA CREDITO")
  ) {
    return {
      categoria: "TAC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TAC vedada desde 30/04/2008",
      justificativa: "Tarifa de Abertura de Crédito proibida pelo Banco Central desde abril de 2008.",
      indevido: true,
    };
  }

  if (
    d.includes("TEC") ||
    d.includes("EMISSAO DE CARNE") ||
    d.includes("EMISSÃO DE CARNÊ")
  ) {
    return {
      categoria: "TEC — Vedada",
      baseLegal: "Resolução BACEN 3.518/2007 — TEC vedada desde 30/04/2008",
      justificativa: "Taxa de Emissão de Carnê proibida pelo Banco Central desde abril de 2008.",
      indevido: true,
    };
  }

  if (
    d.includes("CLUBE") ||
    d.includes("BENEFICIO") ||
    d.includes("BENEFÍCIO") ||
    d.includes("ASSISTÊNCIA") ||
    d.includes("ASSISTENCIA") ||
    d.includes("ASSINATURA") ||
    d.includes("CONSORCIO") ||
    d.includes("CONSÓRCIO") ||
    d.includes("ODONTO") ||
    d.includes("PREVIDENCIA PRIV") ||
    // clubes/serviços/seguradoras que aparecem no extrato como débito embutido
    d.includes("SOROCRED") || d.includes("SUDAMERICA") || d.includes("SEBRASEG") ||
    d.includes("BINCLUB") || d.includes("ASPECIR") || d.includes("SABEMI") ||
    d.includes("LIBERTY") || d.includes("PREVISUL") || d.includes("JBCRED") ||
    d.includes("CREFISA") || d.includes("PSERV") || d.includes("EAGLE") ||
    d.includes("PAGTO ELETRON COBRANCA") || d.includes("PADRONIZADO PRIORITARIOS") ||
    d.includes("VIZA PREV") || d.includes("SECON")
  ) {
    return {
      categoria: "Serviços Não Solicitados",
      baseLegal: "CDC Art. 39, III — serviço sem solicitação é prática abusiva",
      justificativa: "Serviço/produto cobrado sem autorização expressa do cliente.",
      indevido: true,
    };
  }

  // Fallback: lançamento que não casa com nenhum padrão de venda casada conhecido.
  // NÃO marca como indevido — evita falsos positivos (mora/parcela de empréstimo,
  // gastos do cliente, etc., que não foram excluídos antes). Foco em precisão:
  // só entra no laudo o que é claramente tarifa/seguro/serviço casado.
  return {
    categoria: "Cobranças Indevidas",
    baseLegal: "CDC Art. 39 — práticas abusivas proibidas",
    justificativa: "Cobrança sem evidência de contratação expressa.",
    indevido: false,
  };
}

// Ordena os lançamentos individuais por categoria e depois por data — SEM agrupar.
// Cada lançamento permanece como uma linha própria no laudo (análise item a item).
function ordenarLancamentos(lancamentos: Lancamento[]): Lancamento[] {
  return [...lancamentos].sort((a, b) => {
    const ca = classificar(a.descricao).categoria;
    const cb = classificar(b.descricao).categoria;
    return ca !== cb ? ca.localeCompare(cb) : a.data.localeCompare(b.data);
  });
}

// ── Análise jurídica INDIVIDUAL de cada lançamento (via IA) ────────────────────
// Envia todos os lançamentos em uma única chamada e pede uma justificativa
// personalizada por item (considerando data, valor e descrição específicos).
// Se a IA falhar, cai no fallback determinístico (justificativa por categoria).
async function analisarItensIndividualmente(
  itens: Array<{ data: string; descricao: string; valor: number; categoria: string; baseLegal: string }>,
  keys: AIKeys,
): Promise<string[]> {
  const CHUNK = 40;
  const resultado: string[] = new Array(itens.length).fill("");
  if (!keys.openai && !keys.anthropic) return resultado; // sem IA → usa fallback determinístico

  for (let inicio = 0; inicio < itens.length; inicio += CHUNK) {
    const lote = itens.slice(inicio, inicio + CHUNK);
    const listaTxt = lote
      .map((it, i) =>
        `${i + 1}. Data: ${it.data} | Descrição: "${it.descricao}" | Valor: R$ ${it.valor.toFixed(2)} | Categoria: ${it.categoria} | Base legal: ${it.baseLegal}`,
      )
      .join("\n");

    const prompt = `Você é advogado(a) especialista em Direito Bancário e do Consumidor. Para CADA lançamento abaixo, escreva uma ANÁLISE JURÍDICA INDIVIDUAL e específica (1 a 2 frases), fundamentando por que aquela cobrança é indevida — citando o valor, a data e a natureza da cobrança daquele item específico. Seja formal, técnico e evite repetir texto genérico idêntico entre itens.

LANÇAMENTOS:
${listaTxt}

Responda APENAS um array JSON válido, um objeto por item, no formato exato:
[{"i":1,"justificativa":"..."}, {"i":2,"justificativa":"..."}]`;

    try {
      // OpenAI primário → Claude fallback
      let txt = "";
      if (keys.openai) {
        try {
          txt = await openaiChat(keys.openai, [{ role: "user", content: prompt }], 8000);
        } catch (e) {
          console.error("OpenAI análise individual falhou; fallback Claude:", (e as Error).message);
        }
      }
      if (!txt && keys.anthropic) {
        txt = await claudeMessages(keys.anthropic, prompt, 8000);
      }
      if (!txt) continue; // mantém fallback determinístico para este lote

      const jsonMatch = txt.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const arr = JSON.parse(jsonMatch[0]) as Array<{ i: number; justificativa: string }>;
      for (const obj of arr) {
        const idx = inicio + (obj.i - 1);
        if (idx >= 0 && idx < itens.length && obj.justificativa) {
          resultado[idx] = String(obj.justificativa).trim();
        }
      }
    } catch (e) {
      console.error("Erro ao analisar lote individual:", (e as Error).message);
      // segue com fallback determinístico para este lote
    }
  }

  return resultado;
}

function gerarFundamentacao(cats: Set<string>, banco: string, valorTotal: number): string {
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
      textoExtraido, imagensBase64, arquivosBase64, tiposCobranças,
    } = body;
    const tipos: string[] = Array.isArray(tiposCobranças) ? tiposCobranças : [];
    console.log("Tipos de cobrança selecionados:", tipos.length);

    console.log("=== NOVA ANÁLISE ===");
    console.log("Banco:", banco, "| Período:", dataInicial, "a", dataFinal);
    console.log("textoExtraido:", textoExtraido?.length || 0, "chars");
    console.log("arquivosBase64:", arquivosBase64?.length || 0);
    console.log("imagensBase64:", imagensBase64?.length || 0);

    const keys: AIKeys = {
      openai: Deno.env.get("OPENAI_API_KEY") || undefined,
      anthropic: Deno.env.get("ANTHROPIC_API_KEY") || undefined,
    };

    const periodoAnalisado = dataInicial && dataFinal
      ? `${dataInicial} a ${dataFinal}` : "Período não informado";

    let lancamentos: Lancamento[] = [];
    let metodoLeitura = "";

    // ── CAMINHO 0 — DETERMINÍSTICO (SEM IA) ──────────────────────────────────
    // Para PDF digital (texto extraído pelo pdf.js), lê e classifica sem gastar IA.
    if (textoExtraido?.trim()) {
      const filtrados = filtrarClassificar(extrairDeterministico(textoExtraido));
      if (filtrados.length > 0) {
        lancamentos = filtrados;
        metodoLeitura = "determinístico (sem IA)";
        console.log(`CAMINHO 0 (determinístico): ${filtrados.length} cobranças — nenhuma IA usada`);
      }
    }

    // ── Só usa IA se o determinístico não resolveu ───────────────────────────
    if (lancamentos.length === 0) {
      if (!keys.openai && !keys.anthropic) {
        return new Response(JSON.stringify({
          error: "Leitura automática não encontrou lançamentos e nenhuma chave de IA (OPENAI_API_KEY/ANTHROPIC_API_KEY) está configurada.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let linhasAnalisadas = "";

      // CAMINHO 1: IA sobre o texto do pdf.js (OpenAI → Claude)
      if (textoExtraido?.trim()) {
        console.log("CAMINHO 1: IA sobre texto do pdf.js...");
        linhasAnalisadas = await extrairDeTexto(textoExtraido, keys, tipos);
        metodoLeitura = "IA (texto)";
      }

      // CAMINHO 2: Imagens / prints (OpenAI Vision → Claude Vision)
      if (!linhasAnalisadas.trim()) {
        const imagens = [...(arquivosBase64 || []), ...(imagensBase64 || [])]
          .filter((f: any) => f.mimeType !== "application/pdf");
        if (imagens.length > 0) {
          console.log(`CAMINHO 2: ${imagens.length} imagem(ns)...`);
          for (const img of imagens) {
            linhasAnalisadas += (await extrairDeImagem(img.base64, img.mimeType, keys, tipos)) + "\n";
          }
          metodoLeitura = "IA (imagem)";
        }
      }

      // CAMINHO 3: PDF cru escaneado (só Claude lê PDF nativo)
      if (!linhasAnalisadas.trim()) {
        const pdfs = [...(arquivosBase64 || []), ...(imagensBase64 || [])]
          .filter((f: any) => f.mimeType === "application/pdf");
        if (pdfs.length > 0) {
          console.log(`CAMINHO 3: ${pdfs.length} PDF(s) escaneado(s)...`);
          for (const file of pdfs) {
            linhasAnalisadas += (await extrairDePdf(file.base64, keys, tipos)) + "\n";
          }
          metodoLeitura = "IA (PDF escaneado)";
        }
      }

      if (!linhasAnalisadas.trim()) {
        return new Response(
          JSON.stringify({ error: "Não foi possível extrair lançamentos. Verifique se o arquivo é um extrato bancário válido." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      lancamentos = filtrarClassificar(parsearPipe(linhasAnalisadas));
    }

    console.log(`Método de leitura: ${metodoLeitura} | lançamentos válidos: ${lancamentos.length}`);

    if (lancamentos.length === 0) {
      return new Response(JSON.stringify({
        resumo: { total_lancamentos: 0, irregularidades_encontradas: 0, valor_total_indevido: 0, periodo_analisado: periodoAnalisado, banco: banco || "Não informado" },
        cobrancas_indevidas: [],
        recomendacao: { tipo_acao: "Nenhuma irregularidade identificada", fundamentacao: "Não foram encontradas cobranças indevidas.", estimativa_recuperacao: 0, prazo_prescricional: "N/A", prioridade: "baixa" },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ANÁLISE 100% INDIVIDUAL — cada lançamento é uma linha própria (sem agrupar) ──
    const ordenados = ordenarLancamentos(lancamentos);
    console.log("=== ITENS INDIVIDUAIS ===");
    ordenados.forEach((l) => console.log(`  • ${l.data} | ${l.descricao} | R$${l.valor}`));

    // Classificação determinística (categoria + base legal confiável por item)
    const itensBase = ordenados.map((l) => {
      const { categoria, baseLegal, justificativa } = classificar(l.descricao);
      return { ...l, categoria, baseLegal, justificativaFallback: justificativa };
    });

    // Justificativa jurídica INDIVIDUAL de cada item, gerada pela IA
    // (com fallback determinístico por categoria se a IA falhar).
    const justificativasIA = await analisarItensIndividualmente(
      itensBase.map((i) => ({ data: i.data, descricao: i.descricao, valor: i.valor, categoria: i.categoria, baseLegal: i.baseLegal })),
      keys,
    );

    const cobrancas_indevidas = itensBase.map((it, idx) => ({
      data: it.data,
      descricao: it.descricao,
      valor_unitario: it.valor,
      quantidade_ocorrencias: 1,
      valor_total: it.valor,
      categoria: it.categoria,
      status: "confirmado",
      base_legal: it.baseLegal,
      justificativa: justificativasIA[idx]?.trim() || it.justificativaFallback,
      recorrente: false,
    }));

    const valor_total_indevido = parseFloat(
      cobrancas_indevidas.reduce((s, c) => s + c.valor_total, 0).toFixed(2)
    );
    const estimativa_recuperacao = parseFloat((valor_total_indevido * 2).toFixed(2));

    const cats = new Set(cobrancas_indevidas.map((c) => c.categoria));

    const resultado = {
      resumo: {
        total_lancamentos: lancamentos.length,
        irregularidades_encontradas: cobrancas_indevidas.length,
        valor_total_indevido, periodo_analisado: periodoAnalisado,
        banco: banco || "Não informado",
      },
      cobrancas_indevidas,
      recomendacao: {
        tipo_acao: "Requerimento administrativo e/ou Ação Judicial de repetição de indébito",
        fundamentacao: gerarFundamentacao(cats, banco || "banco", valor_total_indevido),
        estimativa_recuperacao,
        prazo_prescricional: "5 anos para tarifas (CDC Art. 27) e 10 anos para seguros (CC Art. 205)",
        prioridade: valor_total_indevido > 300 ? "alta" : "media",
      },
    };

    console.log("=== RESULTADO ===");
    console.log("Lançamentos:", resultado.resumo.total_lancamentos);
    console.log("Itens individuais:", resultado.resumo.irregularidades_encontradas);
    console.log("Total: R$", resultado.resumo.valor_total_indevido);
    console.log("2x: R$", resultado.recomendacao.estimativa_recuperacao);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("Erro geral:", e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
