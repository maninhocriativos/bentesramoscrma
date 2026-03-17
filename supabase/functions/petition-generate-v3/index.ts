import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch case with type info
    const { data: caseData, error: caseErr } = await supabase
      .from("petition_cases")
      .select("*, petition_types_v3(*, petition_categories(*))")
      .eq("id", case_id)
      .single();

    if (caseErr || !caseData) throw new Error("Caso não encontrado: " + caseErr?.message);

    const petType = caseData.petition_types_v3;
    const category = petType?.petition_categories;

    // Update status to generating
    await supabase.from("petition_cases").update({ status: "gerando" }).eq("id", case_id);
    await supabase.from("petition_status_logs").insert({
      case_id, from_status: caseData.status, to_status: "gerando", reason: "Geração iniciada",
    });

    // Fetch office settings
    const { data: office } = await supabase.from("office_settings").select("*").limit(1).single();

    // Build prompts
    const systemPrompt = buildSystemPrompt(petType, category, office, caseData);
    const userPrompt = buildUserPrompt(caseData, petType);

    const model = petType?.agent_model || "google/gemini-2.5-flash-preview-05-20";

    let responseContent = "";

    if (lovableKey) {
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
          temperature: 0.2,
          max_tokens: 12000,
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
          temperature: 0.2,
          max_tokens: 12000,
        }),
      });

      if (!resp.ok) throw new Error("OpenAI error: " + resp.status);
      const data = await resp.json();
      responseContent = data.choices?.[0]?.message?.content || "";
    } else {
      throw new Error("Nenhuma chave de API configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)");
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

    // Count versions
    const { count } = await supabase
      .from("petition_generation_versions")
      .select("id", { count: "exact", head: true })
      .eq("case_id", case_id);

    const version = (count || 0) + 1;

    // Save version
    await supabase.from("petition_generation_versions").insert({
      case_id,
      version,
      content_json: contentJson,
      generated_by: "ia",
    });

    // Update case
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

    // Try to revert status on error
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

// ===== OFFICE INFO CONSTANTS =====
const OFFICE_HEADER = "BENTES RAMOS ADVOCACIA E CONSULTORIA JURÍDICA";
const OFFICE_ADDRESS = "Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM – CEP 69057-040";
const OFFICE_PHONES = "(92) 3343-6173 | (92) 98223-7330 / (92) 99160-4348 / 98588-8190";
const OFFICE_EMAIL = "juridico@bentesramos.adv.br";
const OFFICE_SITE = "www.bentesramos.com.br";
const LAWYER_MAIN = "ANDREY AUGUSTO BENTES RAMOS – OAB/AM 7.526";
const LAWYER_SECONDARY = "GUSTAVO DA SILVA GRILLO – OAB/AM 7.883";

function buildSystemPrompt(petType: any, category: any, office: any, caseData: any): string {
  const isIdoso = caseData.cliente_condicao_especial?.toLowerCase().includes("idoso") ||
    caseData.tramitacao_preferencial;
  const isServidor = caseData.cliente_condicao_especial?.toLowerCase().includes("servidor") ||
    category?.slug === "fazenda-publica-servidor";
  const wantsTutela = caseData.pedir_tutela_urgencia;
  const wantsConciliacao = !caseData.desinteresse_conciliacao;

  // Determine vara type
  let varaType = caseData.tipo_vara || "";
  if (!varaType) {
    if (isServidor || category?.slug === "fazenda-publica-servidor") {
      varaType = "VARA CÍVEL E DE ACIDENTES DE TRABALHO";
    } else {
      varaType = "JUIZADO ESPECIAL CÍVEL";
    }
  }

  const comarca = caseData.comarca || "MANAUS";
  const estado = caseData.estado || "AM";

  // Build section order dynamically
  const sectionOrder: string[] = [];
  
  // Section 1: Requerimentos Prévios subsections
  const reqPrevios: string[] = [];
  if (isIdoso) reqPrevios.push("tramitacao_preferencial");
  reqPrevios.push("justica_gratuita");
  reqPrevios.push("autenticidade_documentos");
  if (caseData.desinteresse_conciliacao) reqPrevios.push("desinteresse_conciliacao");

  return `Você é o agente jurídico do escritório ${OFFICE_HEADER}. Você gera petições iniciais profissionais EXATAMENTE no padrão estrutural do escritório, analisado a partir de 14 modelos reais.

ESCRITÓRIO:
- ${OFFICE_ADDRESS}
- ${OFFICE_PHONES}
- ${OFFICE_EMAIL} | ${OFFICE_SITE}
- Advogado principal: ${LAWYER_MAIN}
- Advogado secundário: ${LAWYER_SECONDARY}

TIPO DE AÇÃO: ${petType?.nome || ""}
CATEGORIA: ${category?.nome || ""}
DESCRIÇÃO: ${petType?.descricao || ""}

============================================================
ESTRUTURA OBRIGATÓRIA DA PETIÇÃO (em ordem fixa):
============================================================

Retorne um JSON com EXATAMENTE as seguintes chaves, nesta ordem. Cada valor deve ser o texto completo daquela seção, pronto para impressão. Use linguagem jurídica formal brasileira.

{
  "enderecamento": "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA M.M. ____ª VARA DO ${varaType} DA COMARCA DE ${comarca}/${estado}",
  
  ${isIdoso ? `"tramitacao_preferencial": "PEDIDO DE TRAMITAÇÃO PREFERÊNCIAL – REQUERENTE IDOSO – [idade] – ART. 1.048, I, DO CPC C/C ART. 71, DA LEI 10.741/2003. Texto completo com fundamento no Estatuto do Idoso art. 71 e CPC art. 1.048, I.",` : ""}
  
  "qualificacao_autor": "Parágrafo ÚNICO com: [NOME EM MAIÚSCULAS], [nacionalidade], [naturalidade], [estado civil], [profissão], detentor(a) da cédula de identidade n° [RG] e do CPF n° [CPF], residente e domiciliado(a) na [endereço completo com número, bairro, cidade/UF, CEP], por intermédio de seus advogados infra-assinados (procuração em anexo), com escritório profissional situado na ${OFFICE_ADDRESS}, endereço eletrônico ${OFFICE_EMAIL} e WhatsApp (92) 99160-4348 / 98223-7330, onde recebem intimações e demais comunicações processuais, vem, com o devido respeito, à presença de Vossa Excelência, propor a presente",
  
  "nome_acao": "[TIPO DA AÇÃO EM MAIÚSCULAS, ex: AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS COM PEDIDO DE LIMINAR]",
  
  "qualificacao_reu": "em face de [NOME DO RÉU EM MAIÚSCULAS], pessoa jurídica de direito privado, inscrita no CNPJ sob o n° [CNPJ], com endereço a [endereço do réu], pelos fatos e fundamentos a seguir expostos:",
  
  "requerimentos_previos": "Seção 1 – DOS REQUERIMENTOS PRÉVIOS. Inclua TODAS as subseções abaixo como texto corrido com subtítulos numerados:
    ${isIdoso ? "1.1 – PRIORIDADE NA TRAMITAÇÃO PROCESSUAL - REQUERENTE IDOSO (com citação completa do art. 71 do Estatuto do Idoso e art. 1.048, I do CPC)" : ""}
    ${isIdoso ? "1.2" : "1.1"} – DA CONCESSÃO DO BENEFÍCIO DA JUSTIÇA GRATUITA (com citação do art. 5º LXXIV CF, art. 9º I CE/AM, arts. 98-102 CPC, art. 99 §3º e §4º CPC)
    ${isIdoso ? "1.3" : "1.2"} – DA DECLARAÇÃO DE AUTENTICIDADE DOS DOCUMENTOS JUNTADOS (art. 425, IV, CPC/2015)
    ${caseData.desinteresse_conciliacao ? (isIdoso ? "1.4" : "1.3") + " – DO DESINTERESSE NA REALIZAÇÃO DE AUDIÊNCIA DE CONCILIAÇÃO (art. 319, VII, CPC)" : ""}",
  
  "fatos": "Seção 2 – DOS FATOS. Narrativa COMPLETA dos fatos do caso. Use parágrafos longos e detalhados. Não invente fatos que não foram fornecidos. Marque dados faltantes com [PENDENTE].",
  
  "direito": "Seção 3 – DO DIREITO. OBRIGATÓRIO incluir subseções numeradas:
    3.1 – DA RELAÇÃO DE CONSUMO (CDC arts. 2º, 3º, 6º)
    3.2 – DA RESPONSABILIDADE OBJETIVA DO FORNECEDOR (CDC art. 14, Súmula 297/STJ)
    3.3 a 3.X – Fundamentos jurídicos ESPECÍFICOS para '${petType?.nome}' com legislação real e jurisprudência
    ${caseData.pedir_repeticao_indebito ? "- DA REPETIÇÃO DE INDÉBITO (art. 42, parágrafo único, CDC)" : ""}
    ${caseData.pedir_danos_morais ? "- DOS DANOS MORAIS (art. 5º V e X CF, art. 6º VI CDC, arts. 186 e 927 CC) incluindo QUANTUM INDENIZATÓRIO" : ""}
    - DO ATO ILÍCITO E DA RESPONSABILIDADE CIVIL (arts. 186 e 927 CC)",
  
  ${wantsTutela ? `"tutela_urgencia": "Seção X – DO PEDIDO DE TUTELA ANTECIPADA. Com fundamento nos arts. 294, 300 CPC e art. 84 §§3º e 4º CDC. Detalhar probabilidade do direito e periculum in mora. Pedir multa diária.",` : ""}
  
  "inversao_onus": "Seção X – DA INVERSÃO DO ÔNUS DA PROVA. Com fundamento no art. 6º VIII CDC e art. 373 CPC. Demonstrar verossimilhança e hipossuficiência.",
  
  "pedidos": "Seção X – DOS PEDIDOS. Lista ALFABÉTICA (a, b, c, d...) incluindo:
    (a) Citação da empresa requerida (art. 246 e 344 CPC)
    (b) Juízo 100% digital (Resolução 345 CNJ + Portaria 2330 TJAM)
    (c) Aplicabilidade do CDC com responsabilidade objetiva
    (d) Inversão do ônus da prova (art. 6° VIII CDC)
    (e) Justiça gratuita (art. 9° I CE/AM + art. 98 CPC)
    (f) PROCEDÊNCIA TOTAL da ação para: [sub-itens f.1, f.2, f.3... com valores, súmulas 43 e 54 STJ, Súmula 362 STJ]
    (g) Custas e honorários advocatícios de 20%
    (h) Publicações CONJUNTAMENTE em nome de ${LAWYER_MAIN} e ${LAWYER_SECONDARY} (art. 272 §5° CPC)",
  
  "provas": "Requer a produção de todas as provas em direito admitidas, em especial o depoimento pessoal do representante legal da requerida, bem como, prova testemunhal, documental, e de todas outras que façam necessárias ao curso da instrução processual.",
  
  "valor_causa": "Dá-se à causa o valor de R$ [VALOR] ([valor por extenso]).",
  
  "fechamento": "Nestes termos, pede deferimento.\\n\\n${comarca}/${estado}, [data de hoje por extenso].\\n\\n-ASSINADO ELETRONICAMENTE-\\n\\n${LAWYER_MAIN.split("–")[0].trim()}\\n${LAWYER_MAIN.split("–")[1]?.trim() || "OAB/AM 7.526"}",
  
  "documentos_anexos": "Lista numerada de documentos anexos (1. Procuração, 2. Documentos pessoais RG/CPF, 3. Comprovante de residência, 4. Declaração de hipossuficiência, 5-N. Documentos específicos do caso)"
}

============================================================
REGRAS INVIOLÁVEIS:
============================================================
1. NUNCA invente fatos, números, contratos, matrículas, valores, datas ou leis que NÃO foram fornecidos
2. Se faltar dado crítico, marque EXATAMENTE assim: [PENDENTE: descrição do dado faltante]
3. NUNCA coloque campos pendentes soltos no corpo do texto - use sempre a marcação [PENDENTE]
4. Respeite a ORDEM EXATA das seções acima
5. Cada seção deve ser texto corrido, profissional, pronto para impressão
6. Use citações diretas de artigos de lei com formatação adequada
7. Valores monetários sempre com cifrão, pontos de milhar e extenso entre parênteses
8. Nomes das partes SEMPRE em maiúsculas quando mencionados pela primeira vez
9. Retorne APENAS o JSON válido envolto em \`\`\`json\`\`\`
10. Seções marcadas com "X" na numeração: numere sequencialmente conforme a posição no documento
11. Inclua jurisprudência REAL do STJ, TJAM e tribunais aplicáveis
12. A petição deve ter entre 8 e 25 páginas de conteúdo substancial

${petType?.agent_prompt ? "\n== INSTRUÇÕES ESPECÍFICAS DO TIPO DE AÇÃO ==\n" + petType.agent_prompt : ""}`;
}

function buildUserPrompt(caseData: any, petType: any): string {
  const parts: string[] = [];

  parts.push("# DADOS COMPLETOS DO CASO PARA GERAÇÃO DA PETIÇÃO\n");

  // Bloco A - Cliente
  parts.push("## PARTE AUTORA (Bloco A)");
  const clienteFields = [
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
  const reuFields = [
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
  const params = [
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
