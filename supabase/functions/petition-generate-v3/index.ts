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

    // Build the prompt
    const systemPrompt = buildSystemPrompt(petType, category, office);
    const userPrompt = buildUserPrompt(caseData, petType);

    // Choose model from petition type or default
    const model = petType?.agent_model || "google/gemini-3-flash-preview";

    // Use custom agent_prompt if available, otherwise use system prompt
    const finalSystemPrompt = petType?.agent_prompt
      ? petType.agent_prompt + "\n\n" + systemPrompt
      : systemPrompt;

    let responseContent = "";

    // Try Lovable AI Gateway first, fallback to OpenAI
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
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
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
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!resp.ok) throw new Error("OpenAI error: " + resp.status);
      const data = await resp.json();
      responseContent = data.choices?.[0]?.message?.content || "";
    } else {
      throw new Error("Nenhuma chave de API configurada (LOVABLE_API_KEY ou OPENAI_API_KEY)");
    }

    // Parse the structured response
    let contentJson: Record<string, unknown> = {};
    try {
      // Try to parse as JSON first
      const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        contentJson = JSON.parse(jsonMatch[1]);
      } else if (responseContent.trim().startsWith("{")) {
        contentJson = JSON.parse(responseContent);
      } else {
        // Fallback: wrap raw text
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(petType: any, category: any, office: any): string {
  const officeName = office?.office_name || "Bentes Ramos Advogados";
  const lawyerName = office?.lawyer_name || "";
  const oab = office?.oab_number ? `OAB/${office.oab_state} ${office.oab_number}` : "";

  return `Você é um agente jurídico especializado em gerar petições iniciais para o escritório ${officeName}.
Advogado: ${lawyerName} ${oab}

Categoria: ${category?.nome || ""}
Tipo de Ação: ${petType?.nome || ""}
Descrição: ${petType?.descricao || ""}

REGRAS OBRIGATÓRIAS:
1. Gere o texto em formato JSON estruturado com as seguintes seções:
   - "enderecamento": texto do endereçamento (Ex: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO...")
   - "qualificacao_autor": qualificação completa da parte autora
   - "qualificacao_reu": qualificação completa da parte ré
   - "sintese_fatica": "DOS FATOS" - narrativa dos fatos
   - "fundamentos_juridicos": "DO DIREITO" - fundamentação jurídica
   - "tutela_urgencia": "DA TUTELA DE URGÊNCIA" (se aplicável, senão null)
   - "pedidos": "DOS PEDIDOS" - lista de pedidos
   - "provas": "DAS PROVAS" - provas que pretende produzir
   - "valor_causa": "DO VALOR DA CAUSA"
   - "fechamento": fechamento padrão
2. NUNCA invente fatos, números de documentos, contratos, leis ou datas que não foram fornecidos
3. Se faltar informação crítica, marque com [PENDENTE: descrição]
4. Use linguagem jurídica formal brasileira
5. Cite legislação real e aplicável
6. Retorne APENAS o JSON, sem texto extra. Envolva com \`\`\`json\`\`\``;
}

function buildUserPrompt(caseData: any, petType: any): string {
  const parts: string[] = [];

  parts.push("## DADOS DO CASO\n");

  // Bloco A - Cliente
  parts.push("### PARTE AUTORA");
  if (caseData.cliente_nome) parts.push(`Nome: ${caseData.cliente_nome}`);
  if (caseData.cliente_nacionalidade) parts.push(`Nacionalidade: ${caseData.cliente_nacionalidade}`);
  if (caseData.cliente_naturalidade) parts.push(`Naturalidade: ${caseData.cliente_naturalidade}`);
  if (caseData.cliente_estado_civil) parts.push(`Estado civil: ${caseData.cliente_estado_civil}`);
  if (caseData.cliente_profissao) parts.push(`Profissão: ${caseData.cliente_profissao}`);
  if (caseData.cliente_rg) parts.push(`RG: ${caseData.cliente_rg}`);
  if (caseData.cliente_cpf) parts.push(`CPF: ${caseData.cliente_cpf}`);
  if (caseData.cliente_data_nascimento) parts.push(`Data nascimento: ${caseData.cliente_data_nascimento}`);
  if (caseData.cliente_idade) parts.push(`Idade: ${caseData.cliente_idade}`);
  if (caseData.cliente_condicao_especial) parts.push(`Condição especial: ${caseData.cliente_condicao_especial}`);
  const endCliente = [caseData.cliente_endereco, caseData.cliente_bairro, caseData.cliente_cidade, caseData.cliente_uf, caseData.cliente_cep].filter(Boolean).join(", ");
  if (endCliente) parts.push(`Endereço: ${endCliente}`);
  if (caseData.cliente_telefone) parts.push(`Telefone: ${caseData.cliente_telefone}`);
  if (caseData.cliente_email) parts.push(`E-mail: ${caseData.cliente_email}`);

  // Bloco B - Réu
  parts.push("\n### PARTE RÉ");
  if (caseData.reu_nome) parts.push(`Nome/Razão social: ${caseData.reu_nome}`);
  if (caseData.reu_cnpj) parts.push(`CNPJ: ${caseData.reu_cnpj}`);
  if (caseData.reu_tipo) parts.push(`Tipo: ${caseData.reu_tipo}`);
  if (caseData.reu_natureza_relacao) parts.push(`Natureza da relação: ${caseData.reu_natureza_relacao}`);
  if (caseData.reu_endereco) parts.push(`Endereço: ${caseData.reu_endereco}`);

  // Bloco C - Competência
  parts.push("\n### COMPETÊNCIA");
  if (caseData.comarca) parts.push(`Comarca: ${caseData.comarca}`);
  if (caseData.estado) parts.push(`Estado: ${caseData.estado}`);
  if (caseData.vara) parts.push(`Vara: ${caseData.vara}`);
  if (caseData.tipo_vara) parts.push(`Tipo de vara: ${caseData.tipo_vara}`);
  if (caseData.tramitacao_preferencial) parts.push(`Tramitação preferencial: Sim - ${caseData.fundamento_prioridade || ""}`);

  // Bloco D - Dados fáticos
  if (caseData.dados_faticos && Object.keys(caseData.dados_faticos).length > 0) {
    parts.push("\n### DADOS FÁTICOS");
    for (const [key, value] of Object.entries(caseData.dados_faticos)) {
      if (value) parts.push(`${key}: ${value}`);
    }
  }

  // Bloco E - Pedidos
  parts.push("\n### PARÂMETROS JURÍDICOS");
  if (caseData.pedir_tutela_urgencia) parts.push("- Pedir tutela de urgência: SIM");
  if (caseData.pedir_repeticao_indebito) parts.push("- Pedir repetição de indébito: SIM");
  if (caseData.pedir_danos_morais) parts.push(`- Pedir danos morais: SIM (valor sugerido: R$ ${caseData.valor_dano_moral || "a definir"})`);
  if (caseData.pedir_inversao_onus) parts.push("- Pedir inversão do ônus da prova: SIM");
  if (caseData.pedir_justica_gratuita) parts.push("- Pedir justiça gratuita: SIM");
  if (caseData.tentativa_administrativa) parts.push("- Houve tentativa administrativa: SIM");
  if (caseData.desinteresse_conciliacao) parts.push("- Desinteresse em audiência de conciliação: SIM");

  // Bloco F
  if (caseData.fatos_adicionais) parts.push(`\n### FATOS ADICIONAIS\n${caseData.fatos_adicionais}`);
  if (caseData.observacoes_advogado) parts.push(`\n### OBSERVAÇÕES DO ADVOGADO\n${caseData.observacoes_advogado}`);

  parts.push(`\nTipo de petição: ${petType?.nome || ""}`);
  parts.push(`Descrição: ${petType?.descricao || ""}`);

  return parts.join("\n");
}
