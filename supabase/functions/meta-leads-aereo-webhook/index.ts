import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Classificação do lead ────────────────────────────────────────────────────
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

  // QUENTE
  const isQuente =
    p.includes("cancelado") ||
    p.includes("conexão") || p.includes("conexao") ||
    p.includes("overbooking") || p.includes("negaram") ||
    t.includes("mais de 4") ||
    t.includes("não consegui") || t.includes("nao consegui") ||
    (pr.length > 0 && !pr.includes("não tive") && !pr.includes("nao tive")) ||
    (c.length > 0 && !c.includes("não tenho") && !c.includes("nao tenho"));

  if (isQuente) return "quente";

  // MÉDIO
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
  // Tenta tabela zapi_instances primeiro
  const { data: inst } = await supabase
    .from("zapi_instances")
    .select("*")
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (inst?.instance_id && inst?.token) return inst;

  // Fallback: integrations_config
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
async function enviarZapi(
  supabase: any,
  telefone: string,
  mensagem: string
): Promise<string> {
  try {
    const inst = await getZapiInstance(supabase);
    if (!inst?.instance_id || !inst?.token) return "erro";

    const numero = normalizarTelefone(telefone);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (inst.client_token) headers["Client-Token"] = inst.client_token;

    const res = await fetch(
      `https://api.z-api.io/instances/${inst.instance_id}/token/${inst.token}/send-text`,
      { method: "POST", headers, body: JSON.stringify({ phone: numero, message: mensagem }) }
    );

    return res.ok ? "enviado" : "erro";
  } catch {
    return "erro";
  }
}

// ── Mensagens por classificação ──────────────────────────────────────────────
function mensagemPorClassificacao(classificacao: string, primeiroNome: string): string | null {
  if (classificacao === "quente") {
    return (
      `Olá ${primeiroNome}, recebemos sua pré-análise sobre problema com voo.\n\n` +
      `Pelo que você informou, seu caso merece uma análise mais detalhada.\n\n` +
      `Para agilizar, envie por aqui os comprovantes que tiver:\n` +
      `1. Passagem ou localizador\n` +
      `2. Cartão de embarque, se tiver\n` +
      `3. Prints ou e-mails da companhia\n` +
      `4. Comprovantes de gastos\n` +
      `5. Provas do prejuízo causado\n\n` +
      `Não precisa ter tudo. Envie o que tiver disponível.`
    );
  }
  if (classificacao === "medio") {
    return (
      `Olá ${primeiroNome}, recebemos suas informações sobre o problema com seu voo.\n\n` +
      `Sua situação precisa de uma análise com mais detalhes. Se tiver passagem, localizador, ` +
      `prints ou e-mails da companhia, envie por aqui para nossa equipe verificar.`
    );
  }
  return null; // frio: sem disparo automático
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

      // Extrai leadgen_id do payload
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const leadgenId = changes?.value?.leadgen_id;

      if (!leadgenId) {
        console.log("[meta-leads-aereo-webhook] Payload sem leadgen_id:", JSON.stringify(body));
        return new Response(
          JSON.stringify({ success: false, error: "leadgen_id não encontrado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deduplicação: verifica se já existe
      const { data: existing } = await supabase
        .from("meta_leads_aereo")
        .select("id, classificacao, zapi_status")
        .eq("lead_id_meta", leadgenId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            lead_id: existing.id,
            classificacao: existing.classificacao,
            zapi_status: existing.zapi_status,
            duplicate: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Busca dados completos na Graph API
      const graphRes = await fetch(
        `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${META_ACCESS_TOKEN}`
      );
      const graphData = await graphRes.json();

      if (graphData.error) {
        console.error("[meta-leads-aereo-webhook] Graph API error:", graphData.error);
        return new Response(
          JSON.stringify({ success: false, error: graphData.error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mapeia campos do formulário
      const fieldData: Record<string, string> = {};
      for (const f of graphData.field_data || []) {
        fieldData[f.name] = f.values?.[0] || "";
      }

      const nome = fieldData["full_name"] || fieldData["nome"] || null;
      const telefone = fieldData["phone_number"] || fieldData["telefone"] || null;
      const email = fieldData["email"] || null;
      const problema_voo = fieldData["problema_voo"] || null;
      const tempo_prejudicado = fieldData["tempo_prejudicado"] || null;
      const teve_prejuizo = fieldData["teve_prejuizo"] || null;
      const comprovantes = fieldData["comprovantes"] || null;

      // Classificação
      const classificacao = classificarLead({ problema_voo, tempo_prejudicado, teve_prejuizo, comprovantes });

      // Dados da campanha (vêm do changes.value ou do graphData)
      const campaign_id    = changes?.value?.campaign_id    || graphData.campaign_id    || null;
      const campaign_name  = changes?.value?.campaign_name  || graphData.campaign_name  || null;
      const adset_id       = changes?.value?.adset_id       || graphData.ad_set_id      || null;
      const adset_name     = changes?.value?.adset_name     || graphData.ad_set_name    || null;
      const ad_id          = changes?.value?.ad_id          || graphData.ad_id          || null;
      const ad_name        = changes?.value?.ad_name        || graphData.ad_name        || null;
      const form_id        = changes?.value?.form_id        || graphData.form_id        || null;

      let zapiStatus = telefone ? "nao_enviado" : "sem_telefone";

      // Salva no Supabase
      const { data: saved, error: saveErr } = await supabase
        .from("meta_leads_aereo")
        .insert({
          nome, telefone, email,
          problema_voo, tempo_prejudicado, teve_prejuizo, comprovantes,
          classificacao,
          campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, form_id,
          lead_id_meta: leadgenId,
          status: "novo",
          zapi_status: zapiStatus,
          raw_payload: body,
        })
        .select("id")
        .single();

      if (saveErr) {
        console.error("[meta-leads-aereo-webhook] Erro ao salvar:", saveErr);
        return new Response(
          JSON.stringify({ success: false, error: saveErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const savedId = saved?.id;

      // Envio Z-API apenas para quente e médio
      if (telefone && (classificacao === "quente" || classificacao === "medio")) {
        const primeiroNome = nome ? nome.split(" ")[0] : "você";
        const mensagem = mensagemPorClassificacao(classificacao, primeiroNome);

        if (mensagem) {
          zapiStatus = await enviarZapi(supabase, telefone, mensagem);
          if (savedId) {
            await supabase
              .from("meta_leads_aereo")
              .update({ zapi_status: zapiStatus, status: zapiStatus === "enviado" ? "em_atendimento" : "novo" })
              .eq("id", savedId);
          }
        }
      }

      console.log(`[meta-leads-aereo-webhook] Lead salvo: ${savedId} | ${classificacao} | zapi: ${zapiStatus}`);

      return new Response(
        JSON.stringify({ success: true, lead_id: savedId, classificacao, zapi_status: zapiStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[meta-leads-aereo-webhook] Erro:", err);
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
