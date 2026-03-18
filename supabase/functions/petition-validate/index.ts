// xhr polyfill removed — using native fetch
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Checklist de documentos por tipo de petição
const CHECKLISTS: Record<string, Array<{ item: string; required: boolean }>> = {
  juros_abusivos: [
    { item: "Contrato bancário", required: true },
    { item: "Extrato de conta / parcelas", required: true },
    { item: "CET (Custo Efetivo Total)", required: false },
    { item: "Comprovante de pagamento das parcelas", required: false },
    { item: "Simulação de valores corretos", required: false },
  ],
  negativacao_indevida: [
    { item: "Comprovante de negativação (SERASA/SPC)", required: true },
    { item: "Prints da consulta ao nome", required: true },
    { item: "Prova de tentativa de solução extrajudicial", required: false },
    { item: "Documentos do contrato (se houver)", required: false },
  ],
  rmc_rcc: [
    { item: "Contracheque ou extrato de benefício", required: true },
    { item: "Autorização de desconto (se existir)", required: true },
    { item: "Extrato do empréstimo consignado", required: true },
    { item: "Histórico de descontos indevidos", required: false },
  ],
  emprestimo_nao_reconhecido: [
    { item: "Extrato bancário mostrando os depósitos/descontos", required: true },
    { item: "Declaração de não reconhecimento", required: true },
    { item: "Boletim de ocorrência (se fraude)", required: false },
    { item: "Prints de tentativa de solução com o banco", required: false },
  ],
  cobranca_pacote_bancario: [
    { item: "Extrato bancário com as cobranças", required: true },
    { item: "Contrato de abertura de conta", required: false },
    { item: "Demonstrativo de tarifas cobradas", required: true },
    { item: "Comprovante de solicitação de cancelamento", required: false },
  ],
};

// Campos obrigatórios por tipo
const REQUIRED_FIELDS: Record<string, string[]> = {
  default: [
    "client.nome_completo",
    "client.cpf",
    "client.estado_civil",
    "client.profissao",
    "endereco.cep",
    "endereco.rua",
    "endereco.numero",
    "endereco.bairro",
    "endereco.cidade",
    "endereco.uf",
    "banco.banco_nome",
  ],
  juros_abusivos: ["valores.valor_cobrado", "valores.valor_total"],
  negativacao_indevida: [],
  rmc_rcc: ["valores.valor_cobrado"],
  emprestimo_nao_reconhecido: ["valores.valor_total"],
  cobranca_pacote_bancario: ["valores.valor_cobrado", "valores.periodo_inicio"],
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

    console.log(`[petition-validate] Validando petição: ${petitionId}`);

    // Buscar petição
    const { data: petition, error: petitionError } = await supabase
      .from("petitions")
      .select("*, petition_types(*)")
      .eq("id", petitionId)
      .single();

    if (petitionError || !petition) {
      console.error("[petition-validate] Petição não encontrada:", petitionError);
      return new Response(
        JSON.stringify({ error: "Petição não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = petition.payload || {};
    const typeSlug = petition.petition_type_slug || "default";
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar campos obrigatórios
    const requiredFields = [
      ...REQUIRED_FIELDS.default,
      ...(REQUIRED_FIELDS[typeSlug] || []),
    ];

    for (const field of requiredFields) {
      const value = getNestedValue(payload, field);
      if (!value || (typeof value === "string" && value.trim() === "")) {
        errors.push(`Campo obrigatório não preenchido: ${getFieldLabel(field)}`);
      }
    }

    // Validar CPF
    const cpf = payload.client?.cpf;
    if (cpf && !isValidCPF(cpf)) {
      errors.push("CPF inválido");
    }

    // Validar CEP
    const cep = payload.endereco?.cep;
    if (cep && !/^\d{5}-?\d{3}$/.test(cep)) {
      warnings.push("CEP em formato inválido");
    }

    // Validar valores
    if (payload.valores) {
      if (payload.valores.valor_cobrado && payload.valores.valor_total) {
        if (payload.valores.valor_cobrado > payload.valores.valor_total) {
          warnings.push("Valor cobrado é maior que o valor total");
        }
      }
      if (payload.valores.periodo_inicio && payload.valores.periodo_fim) {
        if (new Date(payload.valores.periodo_inicio) > new Date(payload.valores.periodo_fim)) {
          errors.push("Período inicial é posterior ao período final");
        }
      }
    }

    // Avisos adicionais
    if (!payload.client?.telefone && !payload.client?.email) {
      warnings.push("Nenhum contato informado (telefone ou e-mail)");
    }

    if (!payload.valores?.pedidos_selecionados?.length) {
      warnings.push("Nenhum pedido selecionado");
    }

    // Montar checklist de documentos
    const checklistTemplate = CHECKLISTS[typeSlug] || CHECKLISTS.juros_abusivos;
    const checklist_docs = checklistTemplate.map((item) => ({
      ...item,
      present: false, // Por ora, marcamos como não presente (futuramente integrar com anexos)
    }));

    // Verificar anexos
    const anexos = payload.anexos || [];
    if (anexos.length > 0) {
      // Marcar alguns como presentes baseado nos anexos
      for (const anexo of anexos) {
        const tipo = anexo.tipo?.toLowerCase() || "";
        for (const doc of checklist_docs) {
          if (doc.item.toLowerCase().includes(tipo) || tipo.includes(doc.item.toLowerCase().split(" ")[0])) {
            doc.present = true;
          }
        }
      }
    }

    // Gerar resumo com OpenAI (se disponível)
    let summary = "";
    if (openaiKey) {
      try {
        const tipoLabel = petition.petition_types?.title || typeSlug;
        const clientName = payload.client?.nome_completo || "Cliente";
        const bancoNome = payload.banco?.banco_nome || "Instituição financeira";
        const valorCobrado = payload.valores?.valor_cobrado 
          ? `R$ ${payload.valores.valor_cobrado.toLocaleString("pt-BR")}`
          : "valor não informado";

        const prompt = `Você é um assistente jurídico especializado em Direito do Consumidor e Bancário.

Gere um BREVE resumo do caso (máximo 3 parágrafos) para a seguinte petição:

Tipo de Ação: ${tipoLabel}
Cliente: ${clientName}
Réu: ${bancoNome}
Valor da Causa: ${valorCobrado}
Produto Bancário: ${payload.banco?.produto || "não informado"}
Observações: ${payload.valores?.observacoes || "nenhuma"}

O resumo deve:
1. Descrever o problema de forma clara e objetiva
2. Indicar a pretensão do autor
3. Mencionar os principais fundamentos jurídicos aplicáveis

Responda apenas com o resumo, sem títulos ou formatação especial.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
          }),
        });

        const data = await response.json();
        summary = data.choices?.[0]?.message?.content || "";
        console.log("[petition-validate] Resumo gerado com sucesso");
      } catch (aiError) {
        console.error("[petition-validate] Erro ao gerar resumo:", aiError);
        summary = `Ação de ${petition.petition_types?.title || typeSlug} movida por ${payload.client?.nome_completo || "autor"} contra ${payload.banco?.banco_nome || "instituição financeira"}.`;
      }
    } else {
      summary = `Ação de ${petition.petition_types?.title || typeSlug} movida por ${payload.client?.nome_completo || "autor"} contra ${payload.banco?.banco_nome || "instituição financeira"}.`;
    }

    const validation = {
      errors,
      warnings,
      checklist_docs,
    };

    console.log(`[petition-validate] Validação concluída: ${errors.length} erros, ${warnings.length} avisos`);

    return new Response(
      JSON.stringify({ 
        success: true,
        validation,
        summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[petition-validate] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helpers
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    "client.nome_completo": "Nome Completo",
    "client.cpf": "CPF",
    "client.estado_civil": "Estado Civil",
    "client.profissao": "Profissão",
    "endereco.cep": "CEP",
    "endereco.rua": "Rua",
    "endereco.numero": "Número",
    "endereco.bairro": "Bairro",
    "endereco.cidade": "Cidade",
    "endereco.uf": "UF",
    "banco.banco_nome": "Nome do Banco",
    "valores.valor_cobrado": "Valor Cobrado",
    "valores.valor_total": "Valor Total",
    "valores.periodo_inicio": "Período Inicial",
  };
  return labels[field] || field;
}

function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(cleaned[10])) return false;

  return true;
}
