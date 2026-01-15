import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates de seções por tipo
const SECTION_TEMPLATES: Record<string, { fatos: string; fundamentos: string; pedidos: string[] }> = {
  juros_abusivos: {
    fatos: `O Autor firmou contrato com o Réu para {{produto}}, sendo cobrados juros muito acima da média de mercado estabelecida pelo Banco Central do Brasil. O valor originalmente contratado era de {{valor_total}}, porém já foram cobrados {{valor_cobrado}}, caracterizando evidente abusividade.`,
    fundamentos: `O Código de Defesa do Consumidor, em seu artigo 51, inciso IV, considera nulas de pleno direito as cláusulas contratuais que estabeleçam obrigações iníquas, abusivas, que coloquem o consumidor em desvantagem exagerada. O artigo 6º, inciso V, do mesmo diploma legal, garante ao consumidor a modificação de cláusulas contratuais que estabeleçam prestações desproporcionais.

A Súmula 379 do STJ estabelece que "Nos contratos bancários não regidos por legislação específica, os juros moratórios poderão ser convencionados até o limite de 1% ao mês."

Ademais, o artigo 39, inciso V, do CDC veda a exigência de vantagem manifestamente excessiva.`,
    pedidos: [
      "A revisão do contrato para adequação dos juros à média de mercado do BACEN",
      "A restituição em dobro dos valores cobrados indevidamente, conforme art. 42, parágrafo único do CDC",
      "A condenação do Réu ao pagamento de danos morais",
      "A concessão de tutela de urgência para suspensão das cobranças abusivas",
    ],
  },
  negativacao_indevida: {
    fatos: `O Autor teve seu nome inscrito indevidamente nos cadastros restritivos de crédito (SERASA/SPC) por dívida inexistente ou já quitada junto ao Réu. Tal negativação causou constrangimento e abalo à honra do Autor, impossibilitando-o de realizar operações de crédito.`,
    fundamentos: `A responsabilidade do fornecedor é objetiva, nos termos do art. 14 do CDC. A inclusão indevida em cadastros de inadimplentes caracteriza dano moral in re ipsa, conforme entendimento consolidado do STJ.

A Súmula 385 do STJ estabelece: "Da anotação irregular em cadastro de proteção ao crédito, não cabe indenização por dano moral, quando preexistente legítima inscrição, ressalvado o direito ao cancelamento."

O art. 43, §1º do CDC determina que os cadastros de consumidores devem ser objetivos, claros, verdadeiros e em linguagem de fácil compreensão.`,
    pedidos: [
      "A imediata exclusão do nome do Autor dos cadastros restritivos de crédito",
      "A declaração de inexistência do débito apontado",
      "A condenação do Réu ao pagamento de indenização por danos morais",
      "A concessão de tutela de urgência para exclusão liminar da negativação",
    ],
  },
  rmc_rcc: {
    fatos: `O Autor é beneficiário do INSS/servidor público e vem sofrendo descontos indevidos em sua folha de pagamento/benefício, decorrentes de contrato de RMC/RCC não autorizado ou com cláusulas abusivas. O valor mensal descontado é de {{valor_cobrado}}, comprometendo significativamente sua renda.`,
    fundamentos: `A Lei nº 10.820/2003 estabelece limites para os descontos em folha de pagamento, que não podem ultrapassar 35% da remuneração disponível. A contratação de empréstimo consignado sem a devida autorização do consumidor configura prática abusiva vedada pelo CDC.

A Instrução Normativa INSS/PRES nº 28/2008 regulamenta os procedimentos para autorização de descontos em benefícios previdenciários.

O Superior Tribunal de Justiça tem entendimento consolidado de que a contratação de empréstimo consignado mediante fraude enseja responsabilidade objetiva da instituição financeira.`,
    pedidos: [
      "A imediata cessação dos descontos indevidos na folha/benefício do Autor",
      "A declaração de nulidade do contrato não autorizado",
      "A restituição em dobro dos valores indevidamente descontados",
      "A condenação do Réu ao pagamento de danos morais",
      "A concessão de tutela de urgência para suspensão imediata dos descontos",
    ],
  },
  emprestimo_nao_reconhecido: {
    fatos: `O Autor verificou em seu extrato bancário a existência de empréstimo que não reconhece ter contratado, no valor de {{valor_total}}. Trata-se de evidente fraude, sendo o Autor vítima de terceiros que utilizaram seus dados pessoais para contratação indevida.`,
    fundamentos: `A responsabilidade da instituição financeira é objetiva, fundada na teoria do risco do empreendimento, conforme art. 14 do CDC e Súmula 479 do STJ: "As instituições financeiras respondem objetivamente pelos danos gerados por fortuito interno relativo a fraudes e delitos praticados por terceiros no âmbito de operações bancárias."

O consumidor não pode ser responsabilizado por falhas nos sistemas de segurança da instituição financeira, que tem o dever de zelar pela segurança das operações realizadas.`,
    pedidos: [
      "A declaração de inexistência do contrato de empréstimo fraudulento",
      "A restituição dos valores eventualmente descontados",
      "A exclusão de quaisquer anotações negativas decorrentes do contrato",
      "A condenação do Réu ao pagamento de danos morais",
    ],
  },
  cobranca_pacote_bancario: {
    fatos: `O Autor é correntista do Réu e vem sendo cobrado por pacote de serviços bancários que não contratou expressamente ou do qual não foi devidamente informado sobre os custos. O período das cobranças indevidas compreende de {{periodo_inicio}} até a presente data, totalizando {{valor_cobrado}} cobrados indevidamente.`,
    fundamentos: `O art. 6º, inciso III, do CDC assegura ao consumidor o direito à informação adequada e clara sobre os serviços contratados. A cobrança de tarifas bancárias sem prévia e expressa autorização do consumidor configura prática abusiva.

A Resolução CMN nº 3.919/2010 estabelece que a prestação de serviços por parte das instituições financeiras deve ser realizada mediante prévia autorização ou solicitação do cliente.

O Superior Tribunal de Justiça tem decidido pela ilegalidade da cobrança de tarifas não contratadas expressamente pelo consumidor.`,
    pedidos: [
      "A declaração de nulidade das cobranças de pacote de serviços não contratados",
      "A restituição em dobro dos valores cobrados indevidamente",
      "A condenação do Réu ao pagamento de danos morais",
      "A obrigação de não fazer, cessando as cobranças indevidas",
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { petitionId } = await req.json();

    if (!petitionId) {
      return new Response(
        JSON.stringify({ error: "petitionId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[petition-generate] Gerando petição: ${petitionId}`);

    // Buscar petição com tipo
    const { data: petition, error: petitionError } = await supabase
      .from("petitions")
      .select("*, petition_types(*)")
      .eq("id", petitionId)
      .single();

    if (petitionError || !petition) {
      console.error("[petition-generate] Petição não encontrada:", petitionError);
      return new Response(
        JSON.stringify({ error: "Petição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configurações do escritório
    const { data: officeSettings } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .single();

    // Buscar modelo padrão (se houver)
    const { data: modelData } = await supabase
      .from("petition_models")
      .select("*")
      .eq("petition_type_slug", petition.petition_type_slug)
      .eq("is_active", true)
      .eq("is_default", true)
      .limit(1)
      .single();

    // Buscar chunks do RAG (se modelo existir)
    let ragChunks: Array<{ chunk_type: string; content: string }> = [];
    if (modelData?.id) {
      const { data: chunks } = await supabase
        .from("model_chunks")
        .select("chunk_type, content")
        .eq("model_id", modelData.id)
        .limit(10);
      
      if (chunks) {
        ragChunks = chunks;
      }
    }

    const payload = petition.payload || {};
    const typeSlug = petition.petition_type_slug || "juros_abusivos";
    const tipoLabel = petition.petition_types?.title || typeSlug;

    // Gerar conteúdo HTML
    let htmlContent = "";

    if (openaiKey && ragChunks.length > 0) {
      // Usar OpenAI com RAG
      htmlContent = await generateWithAI(
        openaiKey,
        petition,
        payload,
        tipoLabel,
        officeSettings,
        ragChunks,
        modelData?.variables_map
      );
    } else {
      // Fallback: usar templates
      htmlContent = generateFromTemplate(
        petition,
        payload,
        typeSlug,
        tipoLabel,
        officeSettings
      );
    }

    // Buscar última versão
    const { data: lastDoc } = await supabase
      .from("petition_documents")
      .select("version")
      .eq("petition_id", petitionId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (lastDoc?.version || 0) + 1;

    // Criar documento
    const { data: newDoc, error: docError } = await supabase
      .from("petition_documents")
      .insert({
        petition_id: petitionId,
        version: newVersion,
        html_content: htmlContent,
        generated_by: ragChunks.length > 0 ? "isa_rag" : "template",
        notes: ragChunks.length > 0 
          ? `Gerado com RAG usando ${ragChunks.length} chunks do modelo`
          : "Gerado a partir de template padrão",
      })
      .select("id")
      .single();

    if (docError) {
      console.error("[petition-generate] Erro ao criar documento:", docError);
      throw docError;
    }

    // Registrar no audit log
    await supabase.from("petition_audit_log").insert({
      petition_id: petitionId,
      action: "document_generated",
      actor: "isa",
      meta: { 
        document_id: newDoc.id,
        version: newVersion,
        method: ragChunks.length > 0 ? "rag" : "template",
      },
    });

    console.log(`[petition-generate] Documento v${newVersion} gerado com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true,
        documentId: newDoc.id,
        version: newVersion,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[petition-generate] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Gerar com OpenAI e RAG
async function generateWithAI(
  apiKey: string,
  petition: Record<string, unknown>,
  payload: Record<string, unknown>,
  tipoLabel: string,
  officeSettings: Record<string, unknown> | null,
  ragChunks: Array<{ chunk_type: string; content: string }>,
  variablesMap: Record<string, string> | null
): Promise<string> {
  // Montar contexto dos chunks
  const chunksContext = ragChunks
    .map(c => `[${c.chunk_type?.toUpperCase()}]\n${c.content}`)
    .join("\n\n---\n\n");

  // Montar dados do caso
  const client = payload.client as Record<string, string> || {};
  const endereco = payload.endereco as Record<string, string> || {};
  const banco = payload.banco as Record<string, string> || {};
  const valores = payload.valores as Record<string, unknown> || {};

  const dadosCaso = `
DADOS DO AUTOR:
- Nome: ${client.nome_completo || "Não informado"}
- CPF: ${client.cpf || "Não informado"}
- Estado Civil: ${client.estado_civil || "Não informado"}
- Profissão: ${client.profissao || "Não informado"}
- Nacionalidade: ${client.nacionalidade || "brasileira"}
- Endereço: ${endereco.rua || ""}, ${endereco.numero || ""}, ${endereco.complemento || ""}, ${endereco.bairro || ""}, ${endereco.cidade || ""}-${endereco.uf || ""}, CEP: ${endereco.cep || ""}

DADOS DO RÉU:
- Banco: ${banco.banco_nome || "Não informado"}
- CNPJ: ${banco.banco_cnpj || "Não informado"}
- Produto: ${banco.produto || "Não informado"}

VALORES:
- Valor Cobrado: R$ ${valores.valor_cobrado || "Não informado"}
- Valor Total: R$ ${valores.valor_total || "Não informado"}
- Período: ${valores.periodo_inicio || ""} a ${valores.periodo_fim || ""}
- Parcelas: ${valores.parcelas || "Não informado"}
- Observações: ${valores.observacoes || "Nenhuma"}

PEDIDOS SELECIONADOS: ${(valores.pedidos_selecionados as string[] || []).join(", ") || "Nenhum específico"}
`;

  const systemPrompt = `Você é um advogado especialista em Direito do Consumidor e Bancário, redator de petições para o Juizado Especial Cível (JEC).

Utilize os trechos do modelo do escritório fornecidos como referência para estilo e estrutura.

REGRAS:
1. Gere uma petição inicial COMPLETA em formato HTML
2. Use os dados do caso fornecidos - NUNCA invente dados
3. Siga a estrutura: Qualificação → Fatos → Fundamentos → Pedidos → Provas → Valor da Causa
4. O valor da causa deve ser até 40 salários mínimos (JEC)
5. Mantenha linguagem formal jurídica
6. Inclua os fundamentos legais apropriados (CDC, CC, Súmulas do STJ)
7. Os pedidos devem ser numerados e específicos

FORMATO HTML:
- Use <h2> para títulos de seção
- Use <p> para parágrafos
- Use <ol> ou <ul> para listas
- Use <strong> para destaques
- NÃO inclua CSS inline
- NÃO inclua cabeçalho do documento (será adicionado depois)`;

  const userPrompt = `TIPO DE AÇÃO: ${tipoLabel}

${dadosCaso}

TRECHOS DO MODELO DO ESCRITÓRIO:
${chunksContext}

Gere a petição inicial completa em HTML, preenchendo com os dados do caso.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const generatedContent = data.choices?.[0]?.message?.content || "";

  // Montar HTML final com cabeçalho e rodapé
  return buildFullHTML(generatedContent, officeSettings, tipoLabel);
}

// Gerar a partir de template
function generateFromTemplate(
  petition: Record<string, unknown>,
  payload: Record<string, unknown>,
  typeSlug: string,
  tipoLabel: string,
  officeSettings: Record<string, unknown> | null
): string {
  const template = SECTION_TEMPLATES[typeSlug] || SECTION_TEMPLATES.juros_abusivos;
  
  const client = payload.client as Record<string, string> || {};
  const endereco = payload.endereco as Record<string, string> || {};
  const banco = payload.banco as Record<string, string> || {};
  const valores = payload.valores as Record<string, unknown> || {};

  // Substituir variáveis nos templates
  let fatos = template.fatos
    .replace("{{produto}}", banco.produto || "produto bancário")
    .replace("{{valor_total}}", `R$ ${valores.valor_total || "___"}`)
    .replace("{{valor_cobrado}}", `R$ ${valores.valor_cobrado || "___"}`)
    .replace("{{periodo_inicio}}", valores.periodo_inicio as string || "___");

  const qualificacao = `
<h2>I - DA QUALIFICAÇÃO DAS PARTES</h2>
<p><strong>${client.nome_completo || "___"}</strong>, ${client.nacionalidade || "brasileiro(a)"}, ${client.estado_civil || "___"}, ${client.profissao || "___"}, inscrito(a) no CPF sob o nº ${client.cpf || "___"}, portador(a) do RG nº ${client.rg || "___"}, residente e domiciliado(a) na ${endereco.rua || "___"}, nº ${endereco.numero || "___"}${endereco.complemento ? ", " + endereco.complemento : ""}, Bairro ${endereco.bairro || "___"}, ${endereco.cidade || "___"}-${endereco.uf || "___"}, CEP ${endereco.cep || "___"}, vem, respeitosamente, à presença de Vossa Excelência, propor a presente</p>
<p style="text-align: center;"><strong>AÇÃO ${tipoLabel.toUpperCase()}</strong></p>
<p>em face de <strong>${banco.banco_nome || "___"}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${banco.banco_cnpj || "___"}, pelos fatos e fundamentos a seguir expostos.</p>
`;

  const fatosSection = `
<h2>II - DOS FATOS</h2>
<p>${fatos}</p>
<p>${valores.observacoes || ""}</p>
`;

  const fundamentosSection = `
<h2>III - DO DIREITO</h2>
<p>${template.fundamentos}</p>
`;

  const pedidosSection = `
<h2>IV - DOS PEDIDOS</h2>
<p>Diante do exposto, requer:</p>
<ol>
${template.pedidos.map(p => `<li>${p};</li>`).join("\n")}
<li>A condenação do Réu ao pagamento das custas processuais e honorários advocatícios;</li>
<li>A produção de todas as provas admitidas em direito.</li>
</ol>
`;

  const provasSection = `
<h2>V - DAS PROVAS</h2>
<p>Protesta provar o alegado por todos os meios de prova admitidos em direito, especialmente pela juntada de documentos, oitiva de testemunhas e depoimento pessoal do representante legal do Réu.</p>
`;

  const valorCausa = valores.valor_total 
    ? `R$ ${Number(valores.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "R$ ___";

  const fechamento = `
<h2>VI - DO VALOR DA CAUSA</h2>
<p>Dá-se à causa o valor de <strong>${valorCausa}</strong>.</p>
<p>Nestes termos,<br/>Pede deferimento.</p>
<p>${endereco.cidade || "___"}, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.</p>
`;

  const content = qualificacao + fatosSection + fundamentosSection + pedidosSection + provasSection + fechamento;

  return buildFullHTML(content, officeSettings, tipoLabel);
}

// Montar HTML completo com cabeçalho e assinatura
function buildFullHTML(
  content: string,
  officeSettings: Record<string, unknown> | null,
  tipoLabel: string
): string {
  const office = officeSettings || {};
  
  const logoUrl = office.logo_url as string || "";
  const officeName = office.office_name as string || "Escritório de Advocacia";
  const lawyerName = office.lawyer_name as string || "Advogado(a)";
  const oabMain = office.oab_main as string || "";
  const oabSecondary = office.oab_secondary as string || "";
  const addressMain = office.address_main as string || "";
  const email = office.email as string || "";

  const header = `
<div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a365d; padding-bottom: 20px;">
  ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px;" />` : ""}
  <h1 style="font-size: 18px; color: #1a365d; margin: 0;">${officeName}</h1>
  ${addressMain ? `<p style="font-size: 12px; color: #666; margin: 5px 0;">${addressMain}</p>` : ""}
  ${email ? `<p style="font-size: 12px; color: #666; margin: 5px 0;">${email}</p>` : ""}
</div>
<p style="text-align: right; font-size: 12px; color: #666;">Exmo(a). Sr(a). Juiz(a) de Direito do Juizado Especial Cível</p>
`;

  const signature = `
<div style="margin-top: 60px; text-align: center;">
  <div style="border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 10px;">
    <p style="margin: 0; font-weight: bold;">${lawyerName}</p>
    ${oabMain ? `<p style="margin: 0; font-size: 12px;">OAB/${oabMain}</p>` : ""}
    ${oabSecondary ? `<p style="margin: 0; font-size: 12px;">OAB/${oabSecondary}</p>` : ""}
  </div>
</div>
`;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Petição - ${tipoLabel}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { font-size: 18px; }
    h2 { font-size: 14px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; }
    p { text-align: justify; margin-bottom: 15px; }
    ol, ul { margin-left: 20px; }
    li { margin-bottom: 10px; }
  </style>
</head>
<body>
${header}
${content}
${signature}
</body>
</html>
`;
}
