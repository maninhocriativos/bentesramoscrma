// xhr polyfill removed — using native fetch
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
  vendas_casadas: {
    fatos: `O Autor procurou a instituição financeira Ré para contratação de {{produto_principal}}, no valor de {{valor_total}}. Contudo, para a liberação do crédito/serviço, foi condicionado pelo Réu à contratação obrigatória de produtos adicionais não desejados pelo Autor, tais como: {{produtos_casados}}.

O Autor foi induzido a aceitar tais condições sob pena de não obter o produto/serviço principal que necessitava, configurando a prática abusiva conhecida como "venda casada".

O valor dos produtos impostos totaliza {{valor_produtos_casados}}, valor este que foi cobrado indevidamente do consumidor.`,
    fundamentos: `A prática de venda casada é expressamente vedada pelo Código de Defesa do Consumidor, conforme artigo 39, inciso I: "É vedado ao fornecedor de produtos ou serviços, dentre outras práticas abusivas: I - condicionar o fornecimento de produto ou de serviço ao fornecimento de outro produto ou serviço, bem como, sem justa causa, a limites quantitativos."

O artigo 6º, inciso II, do CDC assegura ao consumidor a liberdade de escolha e a igualdade nas contratações.

A Súmula 473 do STJ estabelece: "O mutuário do SFH não pode ser compelido a contratar o seguro habitacional obrigatório com a instituição financeira mutuante ou com a seguradora por ela indicada."

Tal entendimento é aplicável por analogia às demais contratações bancárias onde há imposição de produtos não essenciais.

A Resolução CMN nº 4.949/2021 veda às instituições financeiras a oferta ou realização de operações de crédito condicionadas à aquisição de outros produtos ou serviços.

Configura-se, portanto, prática abusiva passível de nulidade, com direito à restituição em dobro dos valores cobrados (art. 42, parágrafo único, CDC) e indenização por danos morais.`,
    pedidos: [
      "A declaração de nulidade dos contratos referentes aos produtos casados não desejados",
      "A restituição em dobro dos valores cobrados pelos produtos impostos, nos termos do art. 42, parágrafo único, do CDC",
      "A condenação do Réu ao pagamento de indenização por danos morais, em valor a ser arbitrado por Vossa Excelência",
      "A manutenção do contrato principal sem a vinculação aos produtos casados",
      "A obrigação de não fazer, cessando qualquer cobrança relacionada aos produtos impostos",
      "A concessão de tutela de urgência para suspensão das cobranças dos produtos casados",
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

    // SEMPRE usar OpenAI/Isa para gerar petição completa
    let htmlContent = "";

    if (openaiKey) {
      console.log(`[petition-generate] Usando Isa/GPT para gerar petição completa`);
      htmlContent = await generateWithIsa(
        openaiKey,
        petition,
        payload,
        typeSlug,
        tipoLabel,
        officeSettings,
        ragChunks,
        modelData?.variables_map
      );
    } else {
      // Fallback: usar templates (só se não tiver OpenAI)
      console.log(`[petition-generate] Fallback para templates (OpenAI não configurado)`);
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
        generated_by: openaiKey ? "isa_gpt" : "template",
        notes: openaiKey 
          ? `Gerado pela Isa (GPT-4o) com argumentação jurídica completa`
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
        method: openaiKey ? "isa_gpt" : "template",
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

// Gerar petição completa com Isa/GPT
async function generateWithIsa(
  apiKey: string,
  petition: Record<string, unknown>,
  payload: Record<string, unknown>,
  typeSlug: string,
  tipoLabel: string,
  officeSettings: Record<string, unknown> | null,
  ragChunks: Array<{ chunk_type: string; content: string }>,
  variablesMap: Record<string, string> | null
): Promise<string> {
  // Montar contexto dos chunks (se houver modelo)
  const chunksContext = ragChunks.length > 0
    ? ragChunks.map(c => `[${c.chunk_type?.toUpperCase()}]\n${c.content}`).join("\n\n---\n\n")
    : "";

  // Montar dados do caso
  const client = payload.client as Record<string, string> || {};
  const endereco = payload.endereco as Record<string, string> || {};
  const banco = payload.banco as Record<string, string> || {};
  const valores = payload.valores as Record<string, unknown> || {};

  // Template específico do tipo
  const template = SECTION_TEMPLATES[typeSlug] || SECTION_TEMPLATES.juros_abusivos;
  
  const office = officeSettings || {};
  const city = office.city as string || "Manaus";
  const state = office.state as string || "AM";
  const lawyerName = office.lawyer_name as string || "Advogado(a)";
  const oabMain = office.oab_main as string || "";
  const oabSecondary = office.oab_secondary as string || "";

  const dadosCaso = `
## DADOS DO CASO

### AUTOR (Cliente)
- Nome Completo: ${client.nome_completo || "NÃO INFORMADO"}
- CPF: ${client.cpf || "NÃO INFORMADO"}
- RG: ${client.rg || "NÃO INFORMADO"}
- Estado Civil: ${client.estado_civil || "solteiro(a)"}
- Profissão: ${client.profissao || "NÃO INFORMADO"}
- Nacionalidade: ${client.nacionalidade || "brasileiro(a)"}

### ENDEREÇO DO AUTOR
- Rua: ${endereco.rua || "NÃO INFORMADO"}
- Número: ${endereco.numero || "S/N"}
- Complemento: ${endereco.complemento || ""}
- Bairro: ${endereco.bairro || "NÃO INFORMADO"}
- Cidade: ${endereco.cidade || "NÃO INFORMADO"}
- UF: ${endereco.uf || "NÃO INFORMADO"}
- CEP: ${endereco.cep || "NÃO INFORMADO"}

### RÉU (Instituição Financeira)
- Nome/Razão Social: ${banco.banco_nome || "NÃO INFORMADO"}
- Agência: ${banco.agencia || "NÃO INFORMADO"}
- Conta: ${banco.conta || "NÃO INFORMADO"}
- Produto Contratado: ${banco.produto || "empréstimo/financiamento"}
${typeSlug === 'vendas_casadas' ? `- Produtos Casados Impostos: ${valores.produtos_casados || "seguro prestamista, título de capitalização"}` : ''}

### VALORES E DANOS
- Valor do Contrato/Causa: R$ ${valores.valor_total || "a ser calculado"}
- Valor Cobrado Indevidamente: R$ ${valores.valor_cobrado || "a ser calculado"}
${typeSlug === 'vendas_casadas' ? `- Valor dos Produtos Casados: R$ ${valores.valor_produtos_casados || "a ser calculado"}` : ''}
- Período: ${valores.periodo_inicio || "___"} até ${valores.periodo_fim || "presente data"}
- Parcelas: ${valores.parcelas || "___"}
- Observações do Caso: ${valores.observacoes || "Nenhuma observação adicional"}

### PEDIDOS SELECIONADOS
${(valores.pedidos_selecionados as string[] || []).map(p => `- ${p}`).join("\n") || "Nenhum pedido específico selecionado"}

### COMARCA
- Cidade: ${city}
- Estado: ${state}

### ADVOGADO RESPONSÁVEL
- Nome: ${lawyerName}
- OAB Principal: ${oabMain}
${oabSecondary ? `- OAB Secundária: ${oabSecondary}` : ''}
`;

  const fundamentosBase = template.fundamentos;
  const pedidosBase = template.pedidos;

  const systemPrompt = `Você é a ISA, uma advogada especialista em Direito do Consumidor e Bancário, com vasta experiência em petições para Juizados Especiais Cíveis.

## SUA MISSÃO
Redigir uma PETIÇÃO INICIAL COMPLETA, PROFISSIONAL e JURIDICAMENTE ROBUSTA para o caso apresentado.

## ESTRUTURA OBRIGATÓRIA DA PETIÇÃO

A petição DEVE conter TODAS as seguintes seções, bem desenvolvidas:

### 1. ENDEREÇAMENTO
- "AO JUÍZO DE DIREITO DA __ VARA DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE [CIDADE]/[UF]"

### 2. QUALIFICAÇÃO DAS PARTES (I - DA QUALIFICAÇÃO DAS PARTES)
- Qualificação COMPLETA do Autor com TODOS os dados
- Qualificação do Réu (banco/instituição financeira)
- Usar dados reais fornecidos - NUNCA inventar

### 3. DOS FATOS (II - DOS FATOS)
- Narrativa DETALHADA e CRONOLÓGICA dos fatos
- Mínimo de 3-4 parágrafos bem desenvolvidos
- Descrever o que aconteceu, quando, como e as consequências
- Incluir valores específicos quando disponíveis
- Tom assertivo mas respeitoso

### 4. DO DIREITO (III - DO DIREITO / DOS FUNDAMENTOS JURÍDICOS)
- Fundamentos legais COMPLETOS e ESPECÍFICOS
- Citar artigos de lei com precisão (CDC, CC, CF)
- Incluir Súmulas relevantes do STJ/STF
- Incluir jurisprudência pertinente
- Mínimo de 4-5 parágrafos de argumentação jurídica sólida
- Demonstrar nexo causal e dano

### 5. DOS PEDIDOS (IV - DOS PEDIDOS)
- Lista NUMERADA de pedidos específicos
- Incluir tutela de urgência quando cabível
- Pedido de inversão do ônus da prova
- Pedido de danos morais E materiais quando aplicável
- Pedido de custas e honorários

### 6. DAS PROVAS (V - DAS PROVAS)
- Protesto pela produção de provas
- Listar documentos anexos
- Mencionar outras provas cabíveis

### 7. DO VALOR DA CAUSA (VI - DO VALOR DA CAUSA)
- Valor até 40 salários mínimos (JEC)
- Justificar brevemente

### 8. FECHAMENTO
- "Nestes termos, pede deferimento."
- Local e data
- Espaço para assinatura do advogado

## REGRAS DE FORMATAÇÃO HTML

Use EXATAMENTE esta estrutura HTML:

\`\`\`html
<p class="enderecamento">AO JUÍZO DE DIREITO DA __ VARA DO JUIZADO ESPECIAL CÍVEL<br/>DA COMARCA DE [CIDADE]/[UF]</p>

<div class="titulo-acao">
  <h1>AÇÃO DE [TIPO DA AÇÃO]</h1>
</div>

<h2>I - DA QUALIFICAÇÃO DAS PARTES</h2>
<p>...</p>

<h2>II - DOS FATOS</h2>
<p>...</p>
<p>...</p>

<h2>III - DO DIREITO</h2>
<p>...</p>

<h2>IV - DOS PEDIDOS</h2>
<p>Diante do exposto, requer:</p>
<ol>
<li>...</li>
</ol>

<h2>V - DAS PROVAS</h2>
<p>...</p>

<h2>VI - DO VALOR DA CAUSA</h2>
<p>...</p>

<p>Nestes termos,<br/>Pede deferimento.</p>

<p class="date-location">[Cidade], [data por extenso].</p>

<div class="signature">
  <div class="signature-line">
    <p class="signature-name">[Nome do Advogado]</p>
    <p class="signature-oab">OAB/[Estado] [Número]</p>
  </div>
</div>
\`\`\`

## REGRAS IMPORTANTES

1. Use TODOS os dados fornecidos - dados reais, não placeholder
2. Linguagem FORMAL e TÉCNICA jurídica
3. Argumentação CONVINCENTE e bem fundamentada
4. Parágrafos DESENVOLVIDOS (não superficiais)
5. Citações legais PRECISAS e ATUALIZADAS
6. NÃO use CSS inline - use apenas as classes definidas
7. Retorne APENAS o HTML, sem explicações
8. Data deve ser formatada: "[Cidade], [dia] de [mês] de [ano]"

## FUNDAMENTOS JURÍDICOS DISPONÍVEIS PARA ESTE TIPO DE AÇÃO:
${fundamentosBase}

## PEDIDOS BASE SUGERIDOS:
${pedidosBase.map((p, i) => `${i + 1}. ${p}`).join("\n")}
`;

  const userPrompt = `Gere a PETIÇÃO INICIAL COMPLETA para:

**TIPO DE AÇÃO:** ${tipoLabel.toUpperCase()}

${dadosCaso}

${chunksContext ? `\n## MODELO DO ESCRITÓRIO (use como referência de estilo):\n${chunksContext}\n` : ''}

IMPORTANTE: Gere uma petição ROBUSTA, COMPLETA e PROFISSIONAL. Desenvolva cada seção com argumentação jurídica sólida. Use TODOS os dados fornecidos. Retorne APENAS o HTML.`;

  console.log(`[petition-generate] Chamando GPT-4o para gerar petição...`);

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
      max_tokens: 8000,
      temperature: 0.4,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error("[petition-generate] Erro OpenAI:", data);
    throw new Error(data.error?.message || "Erro ao gerar com OpenAI");
  }

  const generatedContent = data.choices?.[0]?.message?.content || "";
  
  // Limpar possíveis blocos de código markdown
  let cleanHtml = generatedContent
    .replace(/```html\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();

  console.log(`[petition-generate] Petição gerada com ${cleanHtml.length} caracteres`);

  return cleanHtml;
}

// Gerar a partir de template (fallback)
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
  const office = officeSettings || {};
  
  const city = office.city as string || "Manaus";
  const state = office.state as string || "AM";
  const lawyerName = office.lawyer_name as string || "Advogado(a)";
  const oabMain = office.oab_main as string || "";
  const oabSecondary = office.oab_secondary as string || "";

  // Substituir variáveis nos templates
  let fatos = template.fatos
    .replace("{{produto}}", banco.produto || "produto bancário")
    .replace("{{produto_principal}}", banco.produto || "empréstimo/financiamento")
    .replace("{{valor_total}}", `R$ ${valores.valor_total || "___"}`)
    .replace("{{valor_cobrado}}", `R$ ${valores.valor_cobrado || "___"}`)
    .replace("{{valor_produtos_casados}}", `R$ ${valores.valor_produtos_casados || "___"}`)
    .replace("{{produtos_casados}}", valores.produtos_casados as string || "seguro prestamista, título de capitalização")
    .replace("{{periodo_inicio}}", valores.periodo_inicio as string || "___");

  const enderecamento = `<p class="enderecamento">AO JUÍZO DE DIREITO DA __ VARA DO JUIZADO ESPECIAL CÍVEL<br/>DA COMARCA DE ${city.toUpperCase()}/${state}</p>`;

  const tituloAcao = `<div class="titulo-acao"><h1>AÇÃO DE ${tipoLabel.toUpperCase().replace('AÇÃO ', '').replace('AÇÃO DE ', '')}</h1></div>`;

  const qualificacao = `
<h2>I - DA QUALIFICAÇÃO DAS PARTES</h2>
<p><strong>${client.nome_completo || "___"}</strong>, ${client.nacionalidade || "brasileiro(a)"}, ${client.estado_civil || "___"}, ${client.profissao || "___"}, inscrito(a) no CPF sob o nº ${client.cpf || "___"}, portador(a) do RG nº ${client.rg || "___"}, residente e domiciliado(a) na ${endereco.rua || "___"}, nº ${endereco.numero || "___"}${endereco.complemento ? ", " + endereco.complemento : ""}, Bairro ${endereco.bairro || "___"}, ${endereco.cidade || "___"}-${endereco.uf || "___"}, CEP ${endereco.cep || "___"}, vem, respeitosamente, à presença de Vossa Excelência, propor a presente ação</p>
<p>em face de <strong>${banco.banco_nome || "___"}</strong>, pessoa jurídica de direito privado, pelos fatos e fundamentos a seguir expostos.</p>
`;

  const fatosSection = `
<h2>II - DOS FATOS</h2>
<p>${fatos}</p>
${valores.observacoes ? `<p>${valores.observacoes}</p>` : ""}
`;

  const fundamentosSection = `
<h2>III - DO DIREITO</h2>
<p>${template.fundamentos.split('\n\n').join('</p><p>')}</p>
`;

  const pedidosSection = `
<h2>IV - DOS PEDIDOS</h2>
<p>Diante do exposto, requer:</p>
<ol>
${template.pedidos.map(p => `<li>${p};</li>`).join("\n")}
<li>A inversão do ônus da prova, nos termos do art. 6º, VIII, do CDC;</li>
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

  const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const fechamento = `
<h2>VI - DO VALOR DA CAUSA</h2>
<p>Dá-se à causa o valor de <strong>${valorCausa}</strong>.</p>
<p>Nestes termos,<br/>Pede deferimento.</p>
<p class="date-location">${city}, ${dataAtual}.</p>
<div class="signature">
  <div class="signature-line">
    <p class="signature-name">${lawyerName}</p>
    ${oabMain ? `<p class="signature-oab">OAB/${oabMain}</p>` : ""}
    ${oabSecondary ? `<p class="signature-oab">OAB/${oabSecondary}</p>` : ""}
  </div>
</div>
`;

  return enderecamento + tituloAcao + qualificacao + fatosSection + fundamentosSection + pedidosSection + provasSection + fechamento;
}
