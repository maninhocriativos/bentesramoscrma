import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Insert test case
  const { data: testCase, error: insertErr } = await supabase.from("petition_cases").insert({
    petition_type_id: "dc548c3d-eabc-4293-b443-7837d632460d", // Venda Casada
    status: "rascunho",
    cliente_nome: "MARIA DA SILVA SANTOS",
    cliente_nacionalidade: "brasileira",
    cliente_naturalidade: "amazonense",
    cliente_estado_civil: "casada",
    cliente_profissao: "aposentada",
    cliente_rg: "1234567-8 SSP/AM",
    cliente_cpf: "123.456.789-00",
    cliente_data_nascimento: "1960-03-15",
    cliente_idade: "66",
    cliente_condicao_especial: "idoso",
    cliente_endereco: "Rua das Flores, n 450",
    cliente_bairro: "Centro",
    cliente_cidade: "Manaus",
    cliente_uf: "AM",
    cliente_cep: "69.010-100",
    cliente_telefone: "(92) 99999-1234",
    cliente_email: "maria.silva@email.com",
    reu_nome: "BANCO BRADESCO S/A",
    reu_cnpj: "60.746.948/0001-12",
    reu_tipo: "Instituição Financeira",
    reu_endereco: "Rua Barroso, n 101, Centro, Manaus/AM, Cep: 69.010-050",
    comarca: "MANAUS",
    estado: "AM",
    tipo_vara: "JUIZADO ESPECIAL CÍVEL",
    tramitacao_preferencial: true,
    dados_faticos: {
      produto_vendido: "Seguro Bradesco Vida e Previdência no valor de R$ 42,90 mensais",
      data_contratacao: "Janeiro de 2024",
      forma_descoberta: "Ao verificar extrato bancário, identificou descontos mensais de R$ 42,90 referentes a seguro que nunca contratou nem autorizou",
      valor_descontos: "R$ 42,90 mensais desde janeiro de 2024, totalizando R$ 514,80 em 12 meses",
      tentativa_cancelamento: "Procurou a agência bancária em dezembro de 2024 para cancelar, mas foi informada que deveria ligar para central telefônica, onde ficou em espera por mais de 40 minutos sem atendimento",
      prejuizo: "Descontos indevidos no benefício de aposentadoria, causando redução na renda mensal e angústia"
    },
    pedir_tutela_urgencia: false,
    pedir_repeticao_indebito: true,
    pedir_danos_morais: true,
    pedir_inversao_onus: true,
    pedir_justica_gratuita: true,
    desinteresse_conciliacao: true,
    valor_dano_moral: "10000",
  }).select("id").single();

  if (insertErr) {
    return new Response(JSON.stringify({ error: "Insert failed: " + insertErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Test case created:", testCase.id);

  // Now call the generate function
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const resp = await fetch(`${supabaseUrl}/functions/v1/petition-generate-v3`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ case_id: testCase.id }),
  });

  const result = await resp.json();

  return new Response(JSON.stringify({ case_id: testCase.id, generation_result: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
