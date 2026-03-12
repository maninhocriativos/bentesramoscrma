import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ESCAVADOR_API_KEY = Deno.env.get("ESCAVADOR_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ESCAVADOR_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "ESCAVADOR_API_KEY não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { oab_numero, oab_uf, advogado_id } = body;

    if (!oab_numero || !oab_uf) {
      return new Response(
        JSON.stringify({ success: false, error: "oab_numero e oab_uf são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 [Intimações] Buscando publicações no Diário para OAB/${oab_uf} ${oab_numero}`);

    // Strategy: Use Escavador V1 busca endpoint to search Diários Oficiais
    // This is more credit-efficient than fetching movimentações per process
    const searchTerm = `OAB ${oab_uf} ${oab_numero}`;

    const buscaResp = await fetch(
      `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(searchTerm)}&qo=d&limit=50&page=1`,
      {
        headers: {
          Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
        },
      }
    );

    if (buscaResp.status === 402) {
      return new Response(
        JSON.stringify({ success: false, error: "Créditos Escavador insuficientes" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!buscaResp.ok) {
      const errorText = await buscaResp.text();
      console.error(`❌ Escavador busca error: ${buscaResp.status} - ${errorText.slice(0, 300)}`);
      
      // Fallback: try V2 processos por OAB (less efficient but more reliable)
      return await fallbackProcessosOAB(oab_numero, oab_uf, advogado_id);
    }

    const buscaData = await buscaResp.json();
    const resultados = buscaData?.items?.data || buscaData?.items || buscaData?.data || [];

    console.log(`📋 ${resultados.length} resultados encontrados na busca de diários`);

    const intimacoes: any[] = [];

    for (const item of resultados) {
      // Each item is a diário publication entry
      const conteudo = item.conteudo || item.texto || item.content || "";
      const titulo = item.titulo || item.title || "";
      const dataPublicacao = item.data_publicacao || item.data || item.created_at || null;
      const fonte = item.fonte?.nome || item.diario?.nome || item.source || "";
      const tribunal = item.fonte?.sigla || item.tribunal || "";
      
      // Extract CNJ number from content if present
      const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
      const processoCnj = cnjMatch ? cnjMatch[1] : "";

      // Classify the type of publication
      const conteudoLower = conteudo.toLowerCase();
      const tituloLower = titulo.toLowerCase();
      let tipoIntimacao = "Publicação";
      
      if (conteudoLower.includes("intimação") || conteudoLower.includes("intimacao") || tituloLower.includes("intimação")) {
        tipoIntimacao = "Intimação";
      } else if (conteudoLower.includes("citação") || conteudoLower.includes("citacao")) {
        tipoIntimacao = "Citação";
      } else if (conteudoLower.includes("notificação") || conteudoLower.includes("notificacao")) {
        tipoIntimacao = "Notificação";
      } else if (conteudoLower.includes("despacho")) {
        tipoIntimacao = "Despacho";
      } else if (conteudoLower.includes("sentença") || conteudoLower.includes("sentenca")) {
        tipoIntimacao = "Sentença";
      } else if (conteudoLower.includes("decisão") || conteudoLower.includes("decisao")) {
        tipoIntimacao = "Decisão";
      } else if (conteudoLower.includes("edital")) {
        tipoIntimacao = "Edital";
      }

      intimacoes.push({
        processo_cnj: processoCnj,
        processo_titulo: titulo || fonte || "Publicação em Diário Oficial",
        tribunal: tribunal,
        tipo_intimacao: tipoIntimacao,
        conteudo: conteudo.slice(0, 5000), // Limit content size
        data_intimacao: dataPublicacao,
        data_disponibilizacao: dataPublicacao,
        oab_numero,
        oab_uf,
        advogado_id: advogado_id || null,
        fonte: "escavador_diario",
        raw_json: item,
      });
    }

    console.log(`📌 ${intimacoes.length} publicações processadas`);

    // Save to database
    let savedCount = 0;
    if (intimacoes.length > 0 && advogado_id) {
      for (const int of intimacoes) {
        const { error } = await supabase.from("intimacoes").insert(int);
        if (!error) savedCount++;
        else if (error.code !== "23505") { // Ignore duplicate key errors
          console.warn(`⚠️ Erro ao salvar intimação:`, error.message);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: intimacoes.length,
        saved: savedCount,
        processosAnalisados: resultados.length,
        fonte: "diario_oficial",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro nas intimações:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fallback: V2 processos por OAB (fetches process list only, no movimentações per process)
async function fallbackProcessosOAB(oab_numero: string, oab_uf: string, advogado_id: string | null) {
  console.log("🔄 Fallback: buscando processos via V2 OAB endpoint");

  const processosResp = await fetch(
    `https://api.escavador.com/api/v2/processos/oab/${oab_numero}?estado=${oab_uf}&pagina=1`,
    {
      headers: {
        Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
      },
    }
  );

  if (!processosResp.ok) {
    const errText = await processosResp.text();
    console.error(`❌ Fallback error: ${processosResp.status} - ${errText.slice(0, 200)}`);
    return new Response(
      JSON.stringify({ success: false, error: `Escavador: HTTP ${processosResp.status}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const processosData = await processosResp.json();
  const processos = processosData?.items || processosData?.data || [];

  console.log(`📋 Fallback: ${processos.length} processos encontrados`);

  const intimacoes: any[] = [];

  // Only extract basic info from the process list - no extra API calls per process
  for (const proc of processos) {
    const cnj = proc.numero_cnj || proc.numero_processo;
    if (!cnj) continue;

    const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0] || {};
    const ultimaMovimentacao = fonteTribunal?.capa?.ultima_movimentacao || null;

    if (ultimaMovimentacao) {
      const titulo = ultimaMovimentacao.nome || ultimaMovimentacao.titulo || "";
      const tituloLower = titulo.toLowerCase();

      const isIntimacao =
        tituloLower.includes("intimação") || tituloLower.includes("intimacao") ||
        tituloLower.includes("citação") || tituloLower.includes("citacao") ||
        tituloLower.includes("notificação") || tituloLower.includes("despacho") ||
        tituloLower.includes("sentença") || tituloLower.includes("decisão") ||
        tituloLower.includes("publicação") || tituloLower.includes("publicacao");

      if (isIntimacao) {
        intimacoes.push({
          processo_cnj: cnj,
          processo_titulo: fonteTribunal?.capa?.classe || proc.titulo_classe || "Processo",
          tribunal: fonteTribunal?.tribunal?.sigla || "",
          tipo_intimacao: titulo,
          conteudo: ultimaMovimentacao.descricao || ultimaMovimentacao.conteudo || "",
          data_intimacao: ultimaMovimentacao.data || null,
          oab_numero: oab_numero,
          oab_uf: oab_uf,
          advogado_id: advogado_id,
          fonte: "escavador_v2",
          raw_json: ultimaMovimentacao,
        });
      }
    }
  }

  // Save
  let savedCount = 0;
  if (intimacoes.length > 0 && advogado_id) {
    for (const int of intimacoes) {
      const { error } = await supabase.from("intimacoes").insert(int);
      if (!error) savedCount++;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      total: intimacoes.length,
      saved: savedCount,
      processosAnalisados: processos.length,
      fonte: "processos_v2",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
