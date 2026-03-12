import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { oab_numero, oab_uf, advogado_id, pagina = 1 } = body;

    if (!oab_numero || !oab_uf) {
      return new Response(
        JSON.stringify({ success: false, error: "oab_numero e oab_uf são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 [Intimações] Buscando processos para OAB/${oab_uf} ${oab_numero}`);

    // Step 1: Get all processes for this OAB via Escavador
    const processosResp = await fetch(
      `https://api.escavador.com/api/v2/processos/oab/${oab_numero}?estado=${oab_uf}&pagina=${pagina}`,
      {
        headers: {
          Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
        },
      }
    );

    if (processosResp.status === 402) {
      return new Response(
        JSON.stringify({ success: false, error: "Créditos Escavador insuficientes" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!processosResp.ok) {
      const errorText = await processosResp.text();
      console.error(`❌ Escavador error: ${processosResp.status} - ${errorText.slice(0, 200)}`);
      return new Response(
        JSON.stringify({ success: false, error: `Escavador: HTTP ${processosResp.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processosData = await processosResp.json();
    const processos = processosData?.items || processosData?.data || [];
    const totalPages = processosData?.last_page || processosData?.paginas || 1;

    console.log(`📋 ${processos.length} processos encontrados (página ${pagina}/${totalPages})`);

    // Step 2: For each processo, get movimentações and filter for intimações
    const intimacoes: any[] = [];

    for (const proc of processos) {
      const cnj = proc.numero_cnj || proc.numero_processo;
      if (!cnj) continue;

      try {
        // Get movimentações for this process
        const movResp = await fetch(
          `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?pagina=1`,
          {
            headers: {
              Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
              "X-Requested-With": "XMLHttpRequest",
            },
          }
        );

        if (movResp.ok) {
          const movData = await movResp.json();
          const movimentos = movData?.items || movData?.data || [];

          // Filter for intimações
          for (const mov of movimentos) {
            const nome = (mov.classificacao_predita?.nome || mov.titulo || mov.conteudo || "").toLowerCase();
            const conteudo = (mov.conteudo || mov.complemento || mov.descricao_complementar || "").toLowerCase();

            const isIntimacao =
              nome.includes("intimação") ||
              nome.includes("intimacao") ||
              nome.includes("citação") ||
              nome.includes("citacao") ||
              nome.includes("notificação judicial") ||
              nome.includes("notificacao judicial") ||
              conteudo.includes("intimação") ||
              conteudo.includes("intimacao") ||
              conteudo.includes("intimar") ||
              conteudo.includes("citar");

            if (isIntimacao) {
              const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0] || {};

              intimacoes.push({
                processo_cnj: cnj,
                processo_titulo: fonteTribunal?.capa?.classe || proc.titulo_classe || proc.classe || "Processo",
                tribunal: fonteTribunal?.tribunal?.sigla || fonteTribunal?.sigla || "",
                tipo_intimacao: mov.classificacao_predita?.nome || mov.titulo || "Intimação",
                conteudo: mov.conteudo || mov.complemento || mov.descricao_complementar || "",
                data_intimacao: mov.data || mov.data_hora || null,
                oab_numero,
                oab_uf,
                advogado_id: advogado_id || null,
                raw_json: mov,
              });
            }
          }
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 800));
      } catch (e) {
        console.error(`⚠️ Erro ao buscar movimentações de ${cnj}:`, e);
      }
    }

    console.log(`📌 ${intimacoes.length} intimações encontradas`);

    // Step 3: Save to database (upsert by process + date + tipo)
    if (intimacoes.length > 0 && advogado_id) {
      for (const int of intimacoes) {
        await supabase.from("intimacoes").upsert(
          {
            ...int,
            fonte: "escavador",
          },
          { onConflict: "id" }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        intimacoes,
        total: intimacoes.length,
        pagina,
        totalPages,
        processosAnalisados: processos.length,
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
