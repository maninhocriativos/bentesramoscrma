const serve = Deno.serve;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { case_id } = await req.json();
    if (!case_id) throw new Error("case_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: caseData, error: caseErr } = await supabase
      .from("petition_cases")
      .select("*, petition_types_v3(*, petition_categories(*))")
      .eq("id", case_id)
      .single();

    if (caseErr || !caseData) throw new Error("Caso não encontrado: " + caseErr?.message);

    const petType = caseData.petition_types_v3;
    const category = petType?.petition_categories;

    await supabase.from("petition_cases").update({ status: "gerando" }).eq("id", case_id);
    await supabase.from("petition_status_logs").insert({
      case_id, from_status: caseData.status, to_status: "gerando", reason: "Geração iniciada",
    });

    const { data: office } = await supabase.from("office_settings").select("*").limit(1).single();

    const systemPrompt = buildSystemPrompt(petType, category, office, caseData);
    const userPrompt = buildUserPrompt(caseData, petType);

    let responseContent = "";

    // Priority: 1) Anthropic Claude  2) Lovable AI Gateway  3) OpenAI
    if (anthropicKey) {
      // Only use agent_model if it's a valid Claude model, otherwise use default
      const rawModel = petType?.agent_model || "";
      const claudeModel = rawModel.startsWith("claude") ? rawModel : "claude-sonnet-4-20250514";
      console.log("Using Anthropic Claude:", claudeModel);

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 16000,
          temperature: 0.15,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Anthropic error:", resp.status, errText);
        throw new Error(`Anthropic API error: ${resp.status} - ${errText}`);
      }

      const data = await resp.json();
      responseContent = data.content?.[0]?.text || "";
    } else if (lovableKey) {
      const model = "google/gemini-2.5-flash";
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.15,
          max_tokens: 16000,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Lovable AI error:", resp.status, errText);
        throw new Error(`AI Gateway error: ${resp.status}`);
      }

      const data = await resp.json();
      responseContent = data.choices?.[0]?.message?.content || "";
    } else if (openaiKey) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.15,
          max_tokens: 16000,
        }),
      });

      if (!resp.ok) throw new Error("OpenAI error: " + resp.status);
      const data = await resp.json();
      responseContent = data.choices?.[0]?.message?.content || "";
    } else {
      throw new Error("Nenhuma chave de API configurada (ANTHROPIC_API_KEY, LOVABLE_API_KEY ou OPENAI_API_KEY)");
    }

    // Parse structured response
    let contentJson: Record<string, unknown> = {};
    try {
      const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        contentJson = JSON.parse(jsonMatch[1]);
      } else if (responseContent.trim().startsWith("{")) {
        contentJson = JSON.parse(responseContent);
      } else {
        contentJson = { texto_completo: responseContent };
      }
    } catch {
      contentJson = { texto_completo: responseContent };
    }

    const { count } = await supabase
      .from("petition_generation_versions")
      .select("id", { count: "exact", head: true })
      .eq("case_id", case_id);

    const version = (count || 0) + 1;

    await supabase.from("petition_generation_versions").insert({
      case_id,
      version,
      content_json: contentJson,
      generated_by: "ia",
    });

    await supabase.from("petition_cases").update({
      status: "gerado",
      generated_content: contentJson,
    }).eq("id", case_id);

    await supabase.from("petition_status_logs").insert({
      case_id, from_status: "gerando", to_status: "gerado", reason: `Versão ${version} gerada`,
    });

    return new Response(JSON.stringify({ success: true, version, content: contentJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("petition-generate-v3 error:", e);

    try {
      const { case_id } = await req.clone().json().catch(() => ({ case_id: null }));
      if (case_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("petition_cases").update({ status: "rascunho" }).eq("id", case_id);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== OFFICE CONSTANTS =====
const OFFICE_NAME = "BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA";
const OFFICE_ADDRESS = "Rua Salvador, n˚ 120, sala 708, 7˚ andar – Edifício Vieiralves Business Center, bairro: Adrianópolis, Manaus/AM – Cep: 69.057-040";
const OFFICE_EMAIL = "juridico@bentesramos.adv.br";
const OFFICE_WHATSAPP = "(92) 99160-4348 / 98223-7330";
const LAWYER_1 = "ANDREY AUGUSTO BENTES RAMOS";
const LAWYER_1_OAB = "OAB/AM 7.526";
const LAWYER_2 = "GUSTAVO DA SILVA GRILLO";
const LAWYER_2_OAB = "OAB/AM 7.883";

function getCategorySlug(category: any): string {
  return category?.slug || "";
}

function isFazendaPublica(category: any): boolean {
  return getCategorySlug(category) === "fazenda-publica-servidor";
}

function isTransporteAereo(category: any): boolean {
  return getCategorySlug(category) === "transporte-aereo-consumo";
}

function buildSystemPrompt(petType: any, category: any, _office: any, caseData: any): string {
  const isIdoso = caseData.cliente_condicao_especial?.toLowerCase().includes("idoso") || caseData.tramitacao_preferencial;
  const isFP = isFazendaPublica(category);
  const isTA = isTransporteAereo(category);
  const wantsTutela = caseData.pedir_tutela_urgencia;

  // Determine vara type based on category
  let varaType = caseData.tipo_vara || "";
  if (!varaType) {
    if (isFP) {
      varaType = "VARA DA FAZENDA PÚBLICA";
    } else if (isTA) {
      varaType = "JUIZADO ESPECIAL CÍVEL";
    } else {
      varaType = "JUIZADO ESPECIAL CÍVEL";
    }
  }

  const comarca = caseData.comarca || "MANAUS";
  const estado = caseData.estado || "AM";

  // Build category-specific legal sections guidance
  let categorySpecificSections = "";
  let pedidosGuide = "";

  if (isFP) {
    categorySpecificSections = buildFazendaPublicaSections(petType, caseData);
    pedidosGuide = buildFazendaPublicaPedidos();
  } else if (isTA) {
    categorySpecificSections = buildTransporteAereoSections(petType, caseData);
    pedidosGuide = buildConsumidorPedidos(caseData);
  } else {
    categorySpecificSections = buildBancarioConsumidorSections(petType, caseData);
    pedidosGuide = buildConsumidorPedidos(caseData);
  }

  return `Você é o agente jurídico do escritório ${OFFICE_NAME}. Gera petições iniciais EXATAMENTE no padrão estrutural do escritório, analisado a partir de 14 modelos reais.

ESCRITÓRIO:
- ${OFFICE_ADDRESS}
- E-mail: ${OFFICE_EMAIL} | WhatsApp: ${OFFICE_WHATSAPP}
- Tel.: (92) 3343-6173 | Cel.: (92) 98223-7330 / 99160-4348 / 98588-8190
- Advogado principal: ${LAWYER_1} – ${LAWYER_1_OAB}
- Advogado secundário: ${LAWYER_2} – ${LAWYER_2_OAB}

TIPO DE AÇÃO: ${petType?.nome || ""}
CATEGORIA: ${category?.nome || ""}
DESCRIÇÃO: ${petType?.descricao || ""}

============================================================
ESTRUTURA OBRIGATÓRIA DA PETIÇÃO – JSON COM SEÇÕES FIXAS
============================================================

Retorne um JSON com EXATAMENTE as chaves abaixo, nesta ordem. Cada valor é o texto COMPLETO daquela seção, em linguagem jurídica formal brasileira, pronto para impressão.

{
  "enderecamento": "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA M.M. ____ª VARA DO ${varaType} DA COMARCA DE ${comarca}/${estado}",

  ${isIdoso ? `"tramitacao_preferencial": "PEDIDO DE TRAMITAÇÃO PREFERÊNCIAL – REQUERENTE IDOSO – ATUALMENTE COM [idade por extenso] ANOS DE IDADE - ART. 1.048, I, DO CPC C/C ART. 71, DA LEI 10.741/2003.\\n\\nTexto completo citando art. 71 do Estatuto do Idoso (Lei 10.741/2003) e art. 1.048, I, do CPC, com §1° de ambos os artigos.",` : ""}

  "qualificacao_autor": "[NOME COMPLETO EM MAIÚSCULAS], [nacionalidade], [naturalidade], [estado civil], [profissão], detentor(a) da cédula de identidade n° [RG] [órgão] e do CPF n° [CPF], residente e domiciliado(a) nesta cidade, [endereço completo com número], bairro: [bairro], Cep: [CEP], por seus advogados que esta subscrevem (procuração em anexo), com escritório profissional a ${OFFICE_ADDRESS}, e-mail ${OFFICE_EMAIL} e WhatsApp ${OFFICE_WHATSAPP}, onde recebem intimações e demais atos processuais, vem, respeitosamente, a presença de Vossa Excelência, propor a presente",

  "nome_acao": "[TIPO EXATO DA AÇÃO EM MAIÚSCULAS NEGRITO – ex: AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS COM PEDIDO DE LIMINAR]",

  "qualificacao_reu": "em face de [NOME/RAZAO SOCIAL DO REU EM MAIUSCULAS], [qualificacao juridica], inscrit(o/a) no CNPJ ${isFP ? "n." : "sob o n"} [CNPJ], ${isFP ? "na pessoa do Procurador Geral do Estado, podendo ser citado na sede da Procuradoria Geral do Estado, [endereco PGE]" : "com sede " + (caseData.reu_endereco || "[endereco do reu]")}, pelos ${isFP ? "seguintes fundamentos de fato e de direito:" : "fatos e fundamentos a seguir expostos:"}",

  "requerimentos_previos": "Seção numerada '1 – DOS REQUERIMENTOS PRÉVIOS' com subseções:
    ${isIdoso ? "1.1 – PRIORIDADE NA TRAMITAÇÃO PROCESSUAL – REQUERENTE IDOSO (se não houver seção separada de tramitação preferencial acima)\\n" : ""}
    ${isIdoso ? "1.2" : "1.1"} – DA CONCESSÃO ${isFP ? "DE JUSTIÇA GRATUITA" : "DO BENEFÍCIO DA JUSTIÇA GRATUITA"}
    Texto COMPLETO com fundamentação: art. 5° LXXIV CF, ${!isFP ? "art. 9° I CE/AM (defesa do consumidor), " : ""}arts. 98 a 102 CPC/2015, art. 99 §3° (presunção de veracidade da declaração de hipossuficiência), art. 99 §4° (advogado particular não impede). ${!isFP ? "Incluir citação direta do art. 98 CPC e do art. 9° I CE/AM." : "Incluir citação direta do art. 98 CPC."}
    ${!isFP ? `
    ${isIdoso ? "1.3" : "1.2"} – DA DECLARAÇÃO DE AUTENTICIDADE DOS DOCUMENTOS JUNTADOS
    Com espeque no art. 425 do CPC/2015, declaração de que todos os documentos em cópia simples conferem com originais.
    ${caseData.desinteresse_conciliacao ? `
    ${isIdoso ? "1.4" : "1.3"} – DO DESINTERESSE NA REALIZAÇÃO DE AUDIÊNCIA DE CONCILIAÇÃO
    Com base no art. 319, VII do CPC. Manifestar expressamente o desinteresse.` : ""}` : ""}",

  "fatos": "Seção '2 – DOS FATOS'. Narrativa COMPLETA, detalhada, em parágrafos longos. Contextualizar a relação entre as partes, descrever cronologicamente os eventos, explicar o prejuízo sofrido. NÃO inventar fatos não fornecidos. Marcar dados faltantes como [PENDENTE: descrição].",

  "direito": "Seção '3 – DO DIREITO'. OBRIGATÓRIO subseções numeradas:
    ${!isFP ? `3.1 – DA RELAÇÃO DE CONSUMO (CDC arts. 2°, 3°, 6°)
    3.2 – DA RESPONSABILIDADE OBJETIVA DO FORNECEDOR (CDC art. 14, Súmula 297/STJ)
    3.3 em diante – Fundamentos jurídicos ESPECÍFICOS para '${petType?.nome}' com legislação real e jurisprudência do STJ/TJAM` : `Fundamentos específicos para '${petType?.nome}' com legislação administrativa, constitucional e jurisprudência do STJ/TJAM`}
    ${categorySpecificSections}",

  ${wantsTutela ? `"tutela_urgencia": "Seção numerada – DA TUTELA DE URGÊNCIA / PEDIDO DE LIMINAR. Arts. 294, 300 CPC e art. 84 §§3° e 4° CDC. Detalhar probabilidade do direito e perigo de dano. Pedir multa diária (astreintes).",` : ""}

  ${!isFP ? `"inversao_onus": "Seção numerada – DA INVERSÃO DO ÔNUS DA PROVA. Art. 6° VIII CDC e art. 373 CPC. Demonstrar verossimilhança das alegações e hipossuficiência técnica/informacional do consumidor perante o fornecedor.",` : ""}

  "pedidos": "Seção numerada – DOS PEDIDOS. 'Diante do exposto, a parte requerente pugna que Vossa Excelência se digne à:'
    Lista ALFABÉTICA ou NUMÉRICA com itens:
    ${pedidosGuide}",

  "provas": "Parágrafo separado após pedidos: 'A parte requerente pugna pela produção de todas as provas em direito admitidas, em especial o depoimento pessoal do representante legal do requerido, bem como, prova testemunhal, documental, e de todas outras que façam necessárias ao curso da instrução processual.'",

  "valor_causa": "Dá-se à causa o valor de R$ [VALOR] ([valor por extenso]).",

  "fechamento": "Nestes termos, pede e espera deferimento.\\n\\n${comarca}/${estado}, [data de hoje por extenso].\\n\\n-ASSINADO ELETRONICAMENTE-\\n\\n${LAWYER_1}\\n${LAWYER_1_OAB}\\n\\n${LAWYER_2}\\n${LAWYER_2_OAB}"
}

============================================================
REGRAS INVIOLÁVEIS (baseadas nos 14 modelos reais):
============================================================
1. NUNCA invente fatos, números, contratos, valores, datas ou leis não fornecidos
2. Dados faltantes: marque EXATAMENTE [PENDENTE: descrição do dado faltante]
3. [PENDENTE] NUNCA aparece solto no corpo – sempre com a marcação completa
4. Respeite a ORDEM EXATA das seções acima – NUNCA reordene
5. Texto corrido, profissional, pronto para impressão – sem marcadores markdown
6. Citações diretas de artigos de lei com formatação adequada
7. Valores monetários com R$, pontos de milhar e extenso entre parênteses
8. Nomes das partes SEMPRE em MAIÚSCULAS na primeira menção
9. Retorne APENAS o JSON válido envolto em \`\`\`json\`\`\`
10. Inclua jurisprudência REAL do STJ, TJAM e tribunais aplicáveis
11. A petição deve ter entre 8 e 25 páginas de conteúdo substancial
12. O texto de cada seção deve ser COMPLETO e EXTENSO – não resuma
13. Seções de direito devem ter múltiplos parágrafos com doutrina e jurisprudência
14. Cada subseção dos requerimentos prévios deve ter no mínimo 3-4 parágrafos

${petType?.agent_prompt ? "\n== INSTRUÇÕES ESPECÍFICAS DO TIPO DE AÇÃO ==\n" + petType.agent_prompt : ""}`;
}

function buildFazendaPublicaSections(petType: any, caseData: any): string {
  const nome = petType?.nome || "";
  if (nome.includes("Promoção") && nome.includes("Policial")) {
    return `
    - DO DIREITO À PROMOÇÃO (Lei Estadual aplicável, quadro de acesso)
    - DA OMISSÃO ADMINISTRATIVA E DO DIREITO SUBJETIVO
    - DA INAPLICABILIDADE DA LEI DE RESPONSABILIDADE FISCAL (jurisprudência do TJAM e STJ)
    - DAS DIFERENÇAS SALARIAIS RETROATIVAS (art. 1°-F Lei 9.494/97, RE 870947 Tema 810)`;
  }
  if (nome.includes("Professor") || nome.includes("Salarial")) {
    return `
    - DO DIREITO À DIFERENÇA SALARIAL RETROATIVA
    - DA LEI ESTADUAL APLICÁVEL E DO ENQUADRAMENTO FUNCIONAL
    - DA OMISSÃO ADMINISTRATIVA
    - DOS JUROS E CORREÇÃO MONETÁRIA (art. 1°-F Lei 9.494/97, RE 870947 Tema 810)`;
  }
  if (nome.includes("SES") || nome.includes("Servidor")) {
    return `
    - DO DIREITO À PROMOÇÃO FUNCIONAL (legislação estadual aplicável)
    - DO PREENCHIMENTO DOS REQUISITOS LEGAIS
    - DA OMISSÃO ADMINISTRATIVA E DO ATO VINCULADO
    - DA INAPLICABILIDADE DA LEI DE RESPONSABILIDADE FISCAL
    - DAS DIFERENÇAS SALARIAIS RETROATIVAS`;
  }
  return `
    - Fundamentos específicos para '${nome}' com legislação aplicável
    - Jurisprudência do TJAM e tribunais superiores`;
}

function buildTransporteAereoSections(_petType: any, caseData: any): string {
  return `
    ${caseData.pedir_danos_morais ? "- DOS DANOS MORAIS (art. 5° V e X CF, art. 6° VI CDC, arts. 186 e 927 CC)" : ""}
    - DA RESPONSABILIDADE DA COMPANHIA AÉREA
    - DA FALHA NA PRESTAÇÃO DO SERVIÇO (CDC art. 14)
    - DOS DIREITOS DO PASSAGEIRO (Resolução ANAC 400/2016)
    - DO ATO ILÍCITO E DA RESPONSABILIDADE CIVIL (arts. 186 e 927 CC)`;
}

function buildBancarioConsumidorSections(petType: any, caseData: any): string {
  const nome = petType?.nome || "";
  let specific = "";

  if (nome.includes("Venda Casada")) {
    specific = `
    - DA PRÁTICA DE VENDA CASADA (art. 39, I do CDC)
    - DA COBRANÇA INDEVIDA E ENRIQUECIMENTO ILÍCITO`;
  } else if (nome.includes("Empréstimo Fraudulento") || nome.includes("Não Reconhecido")) {
    specific = `
    - DA INEXISTÊNCIA DE RELAÇÃO CONTRATUAL / CONTRATO NÃO RECONHECIDO
    - DA RESPONSABILIDADE OBJETIVA DA INSTITUIÇÃO FINANCEIRA (Súmula 479/STJ)
    - DA FRAUDE E DA FALHA DE SEGURANÇA`;
  } else if (nome.includes("Tarifa")) {
    specific = `
    - DA COBRANÇA INDEVIDA DE TARIFAS BANCÁRIAS
    - DA ABUSIVIDADE DAS COBRANÇAS`;
  } else if (nome.includes("Seguro")) {
    specific = `
    - DA CONTRATAÇÃO NÃO AUTORIZADA DO SEGURO
    - DA PRÁTICA ABUSIVA (art. 39 CDC)`;
  } else if (nome.includes("Revisão") || nome.includes("Crefisa")) {
    specific = `
    - DA ABUSIVIDADE DA TAXA DE JUROS REMUNERATÓRIOS
    - DA NULIDADE DAS CLÁUSULAS CONTRATUAIS ABUSIVAS (arts. 51 CDC)
    - DA TAXA MÉDIA DE MERCADO (Banco Central) COMO PARÂMETRO`;
  } else if (nome.includes("RMC")) {
    specific = `
    - DO CARTÃO RMC E DA RESERVA DE MARGEM CONSIGNÁVEL
    - DA COBRANÇA ABUSIVA E INEXISTÊNCIA DE CONSENTIMENTO`;
  }

  return `${specific}
    ${caseData.pedir_repeticao_indebito ? "- DA REPETIÇÃO DE INDÉBITO (art. 42, parágrafo único, CDC)" : ""}
    ${caseData.pedir_danos_morais ? "- DOS DANOS MORAIS (art. 5° V e X CF, art. 6° VI CDC, arts. 186 e 927 CC) com QUANTUM INDENIZATÓRIO" : ""}
    - DO ATO ILÍCITO E DA RESPONSABILIDADE CIVIL (arts. 186 e 927 CC)`;
}

function buildConsumidorPedidos(caseData: any): string {
  return `
    (a) Citação da empresa requerida (arts. 246 e 344 CPC)
    (b) Juízo 100% digital (Resolução 345/2020 CNJ + Portaria 2330/2020 TJAM)
    (c) Aplicabilidade do CDC com responsabilidade objetiva
    (d) Inversão do ônus da prova (art. 6° VIII CDC)
    ${caseData.desinteresse_conciliacao ? "(e) Desinteresse na audiência de conciliação" : ""}
    (f) Justiça gratuita (art. 9° I CE/AM + art. 98 CPC)
    (g) PROCEDÊNCIA TOTAL da ação para: [sub-itens detalhados com valores, Súmulas 43 e 54 STJ, Súmula 362 STJ]
    (h) Custas e honorários advocatícios de 20%
    (i) Publicações CONJUNTAMENTE em nome de ${LAWYER_1} – ${LAWYER_1_OAB} e ${LAWYER_2} – ${LAWYER_2_OAB} (art. 272 §5° CPC)`;
}

function buildFazendaPublicaPedidos(): string {
  return `
    (a) Citação do requerido na pessoa de seu representante legal (prazo legal, sob pena de revelia)
    (b) Justiça gratuita (art. 5° LXXIV CF + arts. 98 e ss. CPC)
    (c) Intimação do Ministério Público Estadual como fiscal da lei
    (d) Dispensa da audiência de conciliação e mediação (art. 334 §4° I CPC)
    (e) Inversão do ônus da prova (art. 373 §1° CPC)
    (f) PROCEDÊNCIA TOTAL da ação para: [sub-itens específicos – obrigação de fazer, diferenças salariais, correção IPCA-E, juros art. 1°-F Lei 9.494/97 conforme RE 870947 Tema 810]
    (g) Parcelas vencidas no curso da demanda (art. 323 CPC)
    (h) Custas e honorários de 20% sobre o valor da condenação
    (i) Publicações CONJUNTAMENTE em nome de ${LAWYER_1} – ${LAWYER_1_OAB} e ${LAWYER_2} – ${LAWYER_2_OAB} (art. 272 §5° CPC)`;
}

function buildUserPrompt(caseData: any, petType: any): string {
  const parts: string[] = [];

  parts.push("# DADOS COMPLETOS DO CASO PARA GERAÇÃO DA PETIÇÃO\n");

  // Bloco A - Cliente
  parts.push("## PARTE AUTORA (Bloco A)");
  const clienteFields: [string, any][] = [
    ["Nome completo", caseData.cliente_nome],
    ["Nacionalidade", caseData.cliente_nacionalidade],
    ["Naturalidade", caseData.cliente_naturalidade],
    ["Estado civil", caseData.cliente_estado_civil],
    ["Profissão", caseData.cliente_profissao],
    ["RG", caseData.cliente_rg],
    ["CPF", caseData.cliente_cpf],
    ["Data de nascimento", caseData.cliente_data_nascimento],
    ["Idade", caseData.cliente_idade],
    ["Condição especial", caseData.cliente_condicao_especial],
    ["Endereço", caseData.cliente_endereco],
    ["Bairro", caseData.cliente_bairro],
    ["Cidade", caseData.cliente_cidade],
    ["UF", caseData.cliente_uf],
    ["CEP", caseData.cliente_cep],
    ["Telefone", caseData.cliente_telefone],
    ["E-mail", caseData.cliente_email],
  ];
  for (const [label, value] of clienteFields) {
    parts.push(`- ${label}: ${value || "[NÃO INFORMADO]"}`);
  }

  // Bloco B - Réu
  parts.push("\n## PARTE RÉ (Bloco B)");
  const reuFields: [string, any][] = [
    ["Nome/Razão Social", caseData.reu_nome],
    ["CNPJ", caseData.reu_cnpj],
    ["Tipo da instituição", caseData.reu_tipo],
    ["Natureza da relação", caseData.reu_natureza_relacao],
    ["Endereço", caseData.reu_endereco],
  ];
  for (const [label, value] of reuFields) {
    parts.push(`- ${label}: ${value || "[NÃO INFORMADO]"}`);
  }

  // Bloco C - Competência
  parts.push("\n## COMPETÊNCIA E RITO (Bloco C)");
  parts.push(`- Comarca: ${caseData.comarca || "[NÃO INFORMADO]"}`);
  parts.push(`- Estado: ${caseData.estado || "[NÃO INFORMADO]"}`);
  parts.push(`- Vara: ${caseData.vara || "[NÃO INFORMADO]"}`);
  parts.push(`- Tipo de vara: ${caseData.tipo_vara || "[NÃO INFORMADO]"}`);
  parts.push(`- Tramitação preferencial: ${caseData.tramitacao_preferencial ? "SIM" : "NÃO"}`);
  if (caseData.fundamento_prioridade) parts.push(`- Fundamento da prioridade: ${caseData.fundamento_prioridade}`);

  // Bloco D - Dados fáticos
  parts.push("\n## DADOS FÁTICOS DO CASO (Bloco D)");
  if (caseData.dados_faticos && typeof caseData.dados_faticos === "object") {
    for (const [key, value] of Object.entries(caseData.dados_faticos)) {
      if (value) {
        const label = key.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase());
        parts.push(`- ${label}: ${value}`);
      }
    }
  } else {
    parts.push("- [NENHUM DADO FÁTICO ESPECÍFICO INFORMADO]");
  }

  // Bloco E - Parâmetros jurídicos
  parts.push("\n## PARÂMETROS JURÍDICOS (Bloco E)");
  const params: [string, any][] = [
    ["Tutela de urgência", caseData.pedir_tutela_urgencia],
    ["Repetição de indébito", caseData.pedir_repeticao_indebito],
    ["Danos morais", caseData.pedir_danos_morais],
    ["Inversão do ônus da prova", caseData.pedir_inversao_onus],
    ["Justiça gratuita", caseData.pedir_justica_gratuita],
    ["Tentativa administrativa prévia", caseData.tentativa_administrativa],
    ["Desinteresse em conciliação", caseData.desinteresse_conciliacao],
  ];
  for (const [label, value] of params) {
    parts.push(`- ${label}: ${value ? "SIM" : "NÃO"}`);
  }
  if (caseData.pedir_danos_morais && caseData.valor_dano_moral) {
    parts.push(`- Valor sugerido para danos morais: R$ ${caseData.valor_dano_moral}`);
  }

  // Bloco F - Informações adicionais
  if (caseData.fatos_adicionais) {
    parts.push(`\n## FATOS ADICIONAIS (Bloco F)\n${caseData.fatos_adicionais}`);
  }
  if (caseData.observacoes_advogado) {
    parts.push(`\n## OBSERVAÇÕES DO ADVOGADO\n${caseData.observacoes_advogado}`);
  }

  parts.push(`\n## TIPO DE AÇÃO: ${petType?.nome || "[NÃO DEFINIDO]"}`);
  parts.push(`## DESCRIÇÃO: ${petType?.descricao || ""}`);
  parts.push("\nGere a petição completa no formato JSON estruturado conforme as instruções do sistema.");

  return parts.join("\n");
}
