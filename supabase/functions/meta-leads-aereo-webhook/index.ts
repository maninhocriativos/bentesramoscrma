import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout, TIMEOUT } from '../_shared/fetch-helper.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Detecta tipo do formulário pelos campos recebidos ────────────────────────
function detectarTipoForm(campos: Record<string, string>): "aereo" | "bancario" | "generico" {
  const keys = Object.keys(campos).join(" ").toLowerCase();
  const vals = Object.values(campos).join(" ").toLowerCase();
  const texto = keys + " " + vals;

  if (
    texto.includes("problema_voo") || texto.includes("tempo_prejudicado") ||
    texto.includes("teve_prejuizo") || texto.includes("comprovantes") ||
    texto.includes("voo") || texto.includes("aéreo") || texto.includes("aereo") ||
    texto.includes("cancelado") || texto.includes("embarque")
  ) return "aereo";

  if (
    texto.includes("banco") || texto.includes("bancari") || texto.includes("cobrad") ||
    texto.includes("consigna") || texto.includes("inss") || texto.includes("contrato") ||
    texto.includes("extrato") || texto.includes("produto") || texto.includes("cobran")
  ) return "bancario";

  return "generico";
}

// ── Classificação do lead aéreo ──────────────────────────────────────────────
function classificarLead(data: {
  problema_voo?: string | null;
  tempo_prejudicado?: string | null;
  teve_prejuizo?: string | null;
  comprovantes?: string | null;
}): "quente" | "medio" | "frio" {
  const p = (data.problema_voo || "").toLowerCase();
  const t = (data.tempo_prejudicado || "").toLowerCase();
  const pr = (data.teve_prejuizo || "").toLowerCase();
  const c = (data.comprovantes || "").toLowerCase();

  const isQuente =
    p.includes("cancelado") ||
    p.includes("conexão") || p.includes("conexao") ||
    p.includes("overbooking") || p.includes("negaram") ||
    t.includes("mais de 4") ||
    t.includes("não consegui") || t.includes("nao consegui") ||
    (pr.length > 0 && !pr.includes("não tive") && !pr.includes("nao tive")) ||
    (c.length > 0 && !c.includes("não tenho") && !c.includes("nao tenho"));

  if (isQuente) return "quente";

  const isMedio =
    t.includes("2 a 4") ||
    c.includes("poucos") ||
    t.includes("não lembro") || t.includes("nao lembro");

  if (isMedio) return "medio";

  return "frio";
}

// ── Normaliza telefone BR ────────────────────────────────────────────────────
function normalizarTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.startsWith("0")) return `55${digits.slice(1)}`;
  return `55${digits}`;
}

// ── Busca instância Z-API ────────────────────────────────────────────────────
async function getZapiInstance(supabase: any) {
  const { data: inst } = await supabase
    .from("zapi_instances")
    .select("*")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (inst?.instance_id && inst?.token) return inst;

  const { data: cfg } = await supabase
    .from("integrations_config")
    .select("config_json")
    .eq("provider", "zapi_instances")
    .maybeSingle();

  if (!cfg?.config_json) return null;

  const list = Array.isArray(cfg.config_json)
    ? cfg.config_json
    : cfg.config_json?.instances || [];

  return (
    list.find((i: any) =>
      i.name === "trafego_isa" ||
      i.label?.toLowerCase()?.includes("trafego")
    ) || list[0] || null
  );
}

// ── Envio Z-API ──────────────────────────────────────────────────────────────
async function enviarZapi(supabase: any, telefone: string, mensagem: string): Promise<string> {
  try {
    const inst = await getZapiInstance(supabase);
    if (!inst?.instance_id || !inst?.token) return "erro";

    const numero = normalizarTelefone(telefone);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (inst.client_token) headers["Client-Token"] = inst.client_token;

    const res = await fetchWithTimeout(
      `https://api.z-api.io/instances/${inst.instance_id}/token/${inst.token}/send-text`,
      { method: "POST", headers, body: JSON.stringify({ phone: numero, message: mensagem }) },
      TIMEOUT.ZAPI,
    );

    return res.ok ? "enviado" : "erro";
  } catch (err) {
    console.error("[meta-webhook] Z-API error:", err);
    return "erro";
  }
}

// ── Primeira mensagem da ISA por tipo de formulário ──────────────────────────
// ISA é a recepcionista que filtra e roteia para Gerusa (aéreo) ou Melissa (bancário)
function mensagemIsa(tipo: "aereo" | "bancario" | "generico", nome: string): string {
  if (tipo === "aereo") {
    return (
      `Olá ${nome}! 👋 Sou a ISA, assistente virtual do escritório Bentes Ramos.\n\n` +
      `Vi que você preencheu nosso formulário sobre um problema com voo. Fico feliz que entrou em contato! ✈️\n\n` +
      `A Gerusa, nossa especialista em Direito Aéreo, vai analisar seu caso com prioridade.\n\n` +
      `Para agilizarmos sua análise, me conta: *o que exatamente aconteceu com o seu voo?*`
    );
  }

  if (tipo === "bancario") {
    return (
      `Olá ${nome}! 👋 Sou a ISA, assistente virtual do escritório Bentes Ramos.\n\n` +
      `Vi que você preencheu nosso formulário sobre cobranças do banco. Entendo que essa situação é muito chata! 🏦\n\n` +
      `A Melissa, nossa especialista em Direito Bancário, vai verificar seu caso.\n\n` +
      `Para agilizarmos, me conta: *qual banco e qual tipo de cobrança está te incomodando?*`
    );
  }

  return (
    `Olá ${nome}! 👋 Sou a ISA, assistente virtual do escritório Bentes Ramos.\n\n` +
    `Vi que você entrou em contato com a gente. Nossa equipe jurídica especializada vai analisar seu caso! ⚖️\n\n` +
    `Para eu te direcionar para o especialista certo, me conta: *o que aconteceu e como posso te ajudar?*`
  );
}

// ── Handler principal ────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
  const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── GET: verificação do webhook Meta ──────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: lead recebido ───────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();

      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const leadgenId = changes?.value?.leadgen_id;

      if (!leadgenId) {
        console.log("[meta-webhook] Payload sem leadgen_id:", JSON.stringify(body));
        return new Response(
          JSON.stringify({ success: false, error: "leadgen_id não encontrado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deduplicação
      const { data: existing } = await supabase
        .from("meta_leads_aereo")
        .select("id, classificacao, zapi_status")
        .eq("lead_id_meta", leadgenId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, lead_id: existing.id, classificacao: existing.classificacao, zapi_status: existing.zapi_status, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Busca dados na Graph API
      const graphRes = await fetchWithTimeout(
        `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${META_ACCESS_TOKEN}`,
        {},
        TIMEOUT.META,
      );
      const graphData = await graphRes.json();

      if (graphData.error) {
        console.error("[meta-webhook] Graph API error:", graphData.error);
        return new Response(
          JSON.stringify({ success: false, error: graphData.error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mapeia campos
      const fieldData: Record<string, string> = {};
      for (const f of graphData.field_data || []) {
        fieldData[f.name] = f.values?.[0] || "";
      }

      const nome       = fieldData["full_name"] || fieldData["nome_completo"] || fieldData["nome"] || null;
      const telefone   = fieldData["phone_number"] || fieldData["telefone"] || null;
      const email      = fieldData["email"] || null;
      const problema_voo      = fieldData["problema_voo"] || null;
      const tempo_prejudicado = fieldData["tempo_prejudicado"] || null;
      const teve_prejuizo     = fieldData["teve_prejuizo"] || null;
      const comprovantes      = fieldData["comprovantes"] || null;

      const campaign_id   = changes?.value?.campaign_id   || graphData.campaign_id   || null;
      const campaign_name = changes?.value?.campaign_name || graphData.campaign_name || null;
      const adset_id      = changes?.value?.adset_id      || graphData.ad_set_id     || null;
      const adset_name    = changes?.value?.adset_name    || graphData.ad_set_name   || null;
      const ad_id         = changes?.value?.ad_id         || graphData.ad_id         || null;
      const ad_name       = changes?.value?.ad_name       || graphData.ad_name       || null;
      const form_id       = changes?.value?.form_id       || graphData.form_id       || null;

      const classificacao = classificarLead({ problema_voo, tempo_prejudicado, teve_prejuizo, comprovantes });
      const tipoForm      = detectarTipoForm(fieldData);

      let zapiStatus = telefone ? "nao_enviado" : "sem_telefone";

      // Salva no banco
      const { data: saved, error: saveErr } = await supabase
        .from("meta_leads_aereo")
        .insert({
          nome, telefone, email,
          problema_voo, tempo_prejudicado, teve_prejuizo, comprovantes,
          classificacao, origem: tipoForm,
          campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, form_id,
          lead_id_meta: leadgenId,
          status: "novo",
          zapi_status: zapiStatus,
          raw_payload: body,
        })
        .select("id")
        .single();

      if (saveErr) {
        console.error("[meta-webhook] Erro ao salvar:", saveErr);
        return new Response(
          JSON.stringify({ success: false, error: saveErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const savedId = saved?.id;

      // ISA dispara para TODOS os leads com telefone — sem exceção por classificação
      if (telefone) {
        const primeiroNome = nome ? nome.split(" ")[0] : "você";
        const mensagem = mensagemIsa(tipoForm, primeiroNome);
        zapiStatus = await enviarZapi(supabase, telefone, mensagem);

        if (savedId) {
          await supabase
            .from("meta_leads_aereo")
            .update({
              zapi_status: zapiStatus,
              status: zapiStatus === "enviado" ? "em_atendimento" : "novo",
            })
            .eq("id", savedId);
        }
      }

      console.log(`[meta-webhook] Lead salvo: ${savedId} | tipo: ${tipoForm} | ${classificacao} | zapi: ${zapiStatus}`);

      return new Response(
        JSON.stringify({ success: true, lead_id: savedId, tipo: tipoForm, classificacao, zapi_status: zapiStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[meta-webhook] Erro:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
