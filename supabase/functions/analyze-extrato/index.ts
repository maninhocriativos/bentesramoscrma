const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PASSO 1: Claude lê o PDF e extrai lançamentos no formato estruturado
async function extrairLancamentos(base64: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
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
              text: `Leia TODAS as páginas deste extrato bancário sem pular nenhuma.

Liste APENAS os lançamentos destas categorias, um por linha, exatamente neste formato:
DATA|DESCRIÇÃO|VALOR

Categorias a buscar:
- TARIFA BANCARIA (CESTA CELULAR, CESTA CLASSIC, manutenção)
- SEGURO (VIDA, PRESTAMISTA, BRADESCO VIDA PREV, proteção financeira)
- CAPITALIZAÇÃO
- TAC ou TEC
- CLUBE DE BENEFICIOS

REGRAS OBRIGATÓRIAS:
- Uma linha por lançamento, mesmo que a mesma cobrança apareça em vários meses
- Não agrupe, não resuma, não pule nenhuma ocorrência
- Verifique TODOS os meses: janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro
- Formato exato: 06/01/2017|TARIFA BANCARIA CESTA CELULAR|32.00
- Use ponto como separador decimal
- Não inclua: IOF, ENCARGOS LIMITE DE CRED, saques, transferências, compras

Exemplo de saída correta:
06/01/2017|TARIFA BANCARIA CESTA CELULAR|32.00
07/02/2017|TARIFA BANCARIA CESTA CELULAR|32.00
07/03/2017|TARIFA BANCARIA CESTA CELULAR|32.00
07/04/2017|TARIFA BANCARIA CESTA CELULAR|32.00
08/05/2017|TARIFA BANCARIA CESTA CELULAR|32.00
30/01/2017|BRADESCO VIDA PREV-SEG.VIDA|13.90
01/03/2017|BRADESCO VIDA PREV-SEG.VIDA|14.84`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Erro extração PDF:", await response.text());
    return "";
  }
  const result = await response.json();
  return result.content?.[0]?.text || "";
}

// PASSO 2: Claude analisa os lançamentos e gera o laudo completo em JSON
async function analisarLancamentos(
  lancamentosTexto: string,
  banco: string,
  dataInicial: string,
  dataFinal: string,
  nomeCliente: string,
  cpf: string,
  numeroContrato: string,
  apiKey: string,
): Promise<any> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Você é um especialista em direito bancário do consumidor brasileiro.

Analise os lançamentos abaixo extraídos do extrato bancário do banco ${banco}, período ${dataInicial} a ${dataFinal}.
Cliente: ${nomeCliente || "não informado"}
CPF: ${cpf || "não informado"}
Contrato: ${numeroContrato || "não informado"}

LANÇAMENTOS IDENTIFICADOS:
${lancamentosTexto}

REGRAS DE CLASSIFICAÇÃO:
- TARIFA BANCARIA / CESTA = categoria "Tarifas Bancárias", base legal "Resolução CMN nº 3.919/2010"
- SEGURO / BRADESCO VIDA PREV = categoria "Seguros", base legal "CDC Art. 39, III — venda casada proibida"
- TAC = categoria "TAC Vedada", base legal "Resolução BACEN 3.518/2007"
- TEC = categoria "TEC Vedada", base legal "Resolução BACEN 3.518/2007"
- CAPITALIZAÇÃO = categoria "Capitalização", base legal "CDC Art. 39, III"

REGRAS DE AGRUPAMENTO:
- Agrupe lançamentos com MESMA descrição E MESMO valor em um único item
- Se o VALOR mudou (ex: de 32.00 para 24.00), crie itens SEPARADOS
- valor_unitario = valor de uma ocorrência
- quantidade_ocorrencias = quantas vezes esse valor aparece
- valor_total = valor_unitario × quantidade_ocorrencias

IMPORTANTE:
- estimativa_recuperacao = valor_total_indevido × 2 (devolução em dobro CDC art. 42)
- prioridade = "alta" se valor_total_indevido > 300, senão "media"
- Fundamentação deve citar leis específicas e mencionar os valores encontrados

Responda APENAS com JSON válido, sem markdown:
{
  "resumo": {
    "total_lancamentos": 0,
    "irregularidades_encontradas": 0,
    "valor_total_indevido": 0.00,
    "periodo_analisado": "${dataInicial} a ${dataFinal}",
    "banco": "${banco}"
  },
  "cobrancas_indevidas": [
    {
      "data": "data da primeira ocorrência",
      "descricao": "descrição exata",
      "valor_unitario": 0.00,
      "quantidade_ocorrencias": 0,
      "valor_total": 0.00,
      "categoria": "",
      "status": "confirmado",
      "base_legal": "",
      "justificativa": "",
      "recorrente": true
    }
  ],
  "por_categoria": [
    {
      "categoria": "",
      "total": 0.00,
      "ocorrencias": 0
    }
  ],
  "recomendacao": {
    "tipo_acao": "",
    "fundamentacao": "",
    "estimativa_recuperacao": 0.00,
    "prazo_prescricional": "",
    "prioridade": "alta"
  }
}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Erro análise Claude:", await response.text());
    return null;
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || "";
  console.log("Análise Claude (primeiros 500):", content.substring(0, 500));

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Sem JSON");
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.error("Falha ao parsear JSON da análise:", content.substring(0, 300));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { banco, dataInicial, dataFinal, nomeCliente, cpf, numeroContrato, arquivosBase64 } = body;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let todosTextos = "";

    // Passo 1: extrai lançamentos de todos os arquivos
    for (const file of arquivosBase64 || []) {
      if (file.mimeType === "application/pdf") {
        console.log("Extraindo PDF:", file.name);
        const texto = await extrairLancamentos(file.base64, ANTHROPIC_API_KEY);
        if (texto) {
          todosTextos += texto + "\n";
          console.log("Extraído:", texto.length, "chars");
          console.log("Lançamentos encontrados:\n", texto.substring(0, 800));
        }
      }
    }

    if (!todosTextos.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Não foi possível extrair lançamentos do documento. Verifique se o arquivo é um extrato bancário válido.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Passo 2: Claude analisa e gera o JSON completo
    console.log("Analisando lançamentos com Claude...");
    const resultado = await analisarLancamentos(
      todosTextos,
      banco || "não informado",
      dataInicial || "",
      dataFinal || "",
      nomeCliente || "",
      cpf || "",
      numeroContrato || "",
      ANTHROPIC_API_KEY,
    );

    if (!resultado) {
      return new Response(
        JSON.stringify({
          error: "Falha ao processar análise. Tente novamente.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Resultado final:", JSON.stringify(resultado.resumo));

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro geral:", e.message);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
