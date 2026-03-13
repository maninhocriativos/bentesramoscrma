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

    let oab_numero: string, oab_uf: string, advogado_id: string | null;

    // Support both POST (manual) and GET (cron)
    if (req.method === "POST") {
      const body = await req.json();
      oab_numero = body.oab_numero;
      oab_uf = body.oab_uf;
      advogado_id = body.advogado_id || null;
    } else {
      // Cron mode: fetch OAB from office_settings
      const { data: settings } = await supabase
        .from("office_settings")
        .select("oab_number, oab_state")
        .limit(1)
        .single();

      if (!settings?.oab_number) {
        return new Response(
          JSON.stringify({ success: false, error: "OAB não configurada no escritório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      oab_numero = settings.oab_number;
      oab_uf = settings.oab_state || "AM";
      advogado_id = null; // Cron: will use null (visible to admins)
    }

    if (!oab_numero || !oab_uf) {
      return new Response(
        JSON.stringify({ success: false, error: "oab_numero e oab_uf são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 [Intimações] Buscando para OAB/${oab_uf} ${oab_numero}`);

    // Helper: next business day (skip weekends)
    function nextBusinessDay(dateStr: string): string {
      const baseInput = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`;
      let d = new Date(baseInput);

      if (Number.isNaN(d.getTime())) {
        const onlyDate = dateStr.split("T")[0];
        d = new Date(`${onlyDate}T12:00:00Z`);
      }

      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }

      return d.toISOString().split("T")[0];
    }

    // Strategy 1: Use Escavador V2 monitoramento de diários
    const intimacoes: any[] = [];
    let fonte = "escavador_v2";

    // First: fetch all processos for this OAB
    const processosResp = await fetch(
      `https://api.escavador.com/api/v2/processos/oab/${oab_numero}?estado=${oab_uf}&pagina=1`,
      {
        headers: {
          Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    if (processosResp.status === 402) {
      return new Response(
        JSON.stringify({ success: false, error: "Créditos Escavador insuficientes" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (processosResp.ok) {
      const processosData = await processosResp.json();
      const processos = processosData?.items || processosData?.data || [];

      console.log(`📋 ${processos.length} processos encontrados via OAB`);

      for (const proc of processos) {
        const cnj = proc.numero_cnj || proc.numero_processo;
        if (!cnj) continue;

        // Extract tribunal from fontes
        const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0];
        const tribunalSigla = fonteTribunal?.tribunal?.sigla || fonteTribunal?.nome || "";
        const classeProcesso = fonteTribunal?.capa?.classe || proc.titulo_classe || "";

        // Fetch movimentações for each processo to get real intimações
        try {
          const movResp = await fetch(
            `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}?movimentacoes=true`,
            {
              headers: {
                Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
                "X-Requested-With": "XMLHttpRequest",
              },
            }
          );

          if (movResp.ok) {
            const movData = await movResp.json();
            const fontes = movData?.fontes || [];

            for (const f of fontes) {
              const tribunal = f.tribunal?.sigla || f.nome || tribunalSigla;
              const movimentacoes = f.movimentacoes || [];

              for (const mov of movimentacoes) {
                const titulo = mov.titulo || mov.nome || "";
                const conteudo = mov.conteudo || mov.descricao || "";
                const tituloLower = titulo.toLowerCase();
                const conteudoLower = conteudo.toLowerCase();
                const combined = tituloLower + " " + conteudoLower;

                // Filter only relevant publications
                const isRelevant =
                  combined.includes("intimação") || combined.includes("intimacao") ||
                  combined.includes("citação") || combined.includes("citacao") ||
                  combined.includes("notificação") || combined.includes("notificacao") ||
                  combined.includes("despacho") || combined.includes("sentença") ||
                  combined.includes("sentenca") || combined.includes("decisão") ||
                  combined.includes("decisao") || combined.includes("publicação") ||
                  combined.includes("publicacao") || combined.includes("edital") ||
                  combined.includes("diário") || combined.includes("diario");

                if (!isRelevant) continue;

                // Classify type
                let tipoIntimacao = "Publicação";
                if (combined.includes("intimação") || combined.includes("intimacao")) tipoIntimacao = "Intimação";
                else if (combined.includes("citação") || combined.includes("citacao")) tipoIntimacao = "Citação";
                else if (combined.includes("notificação") || combined.includes("notificacao")) tipoIntimacao = "Notificação";
                else if (combined.includes("despacho")) tipoIntimacao = "Despacho";
                else if (combined.includes("sentença") || combined.includes("sentenca")) tipoIntimacao = "Sentença";
                else if (combined.includes("decisão") || combined.includes("decisao")) tipoIntimacao = "Decisão";
                else if (combined.includes("edital")) tipoIntimacao = "Edital";

                // Extract dates properly - apply Brazilian procedural rules
                // Disponibilização → Publicação (1º dia útil seguinte) → Intimação (1º dia útil após publicação)
                const rawDate = mov.data || null;
                const rawDisponibilizacao = mov.data_disponibilizacao || null;
                const rawPublicacao = mov.data_publicacao || null;

                let dataDisponibilizacao = rawDisponibilizacao || rawDate || null;
                let dataPublicacao = rawPublicacao;
                let dataIntimacao: string | null = null;

                // If we only have one date, calculate the others per CPC rules
                if (dataDisponibilizacao && !dataPublicacao) {
                  dataPublicacao = nextBusinessDay(dataDisponibilizacao);
                }
                if (dataPublicacao) {
                  dataIntimacao = nextBusinessDay(dataPublicacao);
                } else if (rawDate) {
                  dataIntimacao = rawDate;
                }

                intimacoes.push({
                  processo_cnj: cnj,
                  processo_titulo: classeProcesso || titulo,
                  tribunal: tribunal,
                  tipo_intimacao: tipoIntimacao,
                  conteudo: (conteudo || titulo).slice(0, 5000),
                  data_intimacao: dataIntimacao,
                  data_disponibilizacao: dataDisponibilizacao,
                  data_publicacao: dataPublicacao,
                  oab_numero,
                  oab_uf,
                  advogado_id,
                  fonte: "escavador_v2",
                  raw_json: mov,
                });
              }
            }
          }
        } catch (e) {
          console.warn(`⚠️ Erro ao buscar movimentações para ${cnj}:`, e);
        }
      }
    } else {
      // Fallback: V1 busca em diários
      console.log("🔄 Fallback: busca V1 em diários");
      fonte = "escavador_v1";
      const searchTerm = `OAB ${oab_uf} ${oab_numero}`;

      const buscaResp = await fetch(
        `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(searchTerm)}&qo=d&limit=50&page=1`,
        {
          headers: {
            Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      if (buscaResp.ok) {
        const buscaData = await buscaResp.json();
        const resultados = buscaData?.items?.data || buscaData?.items || buscaData?.data || [];

        for (const item of resultados) {
          const conteudo = item.conteudo || item.texto || item.content || "";
          const titulo = item.titulo || item.title || "";
          const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);

          const conteudoLower = conteudo.toLowerCase();
          let tipoIntimacao = "Publicação";
          if (conteudoLower.includes("intimação") || conteudoLower.includes("intimacao")) tipoIntimacao = "Intimação";
          else if (conteudoLower.includes("citação")) tipoIntimacao = "Citação";
          else if (conteudoLower.includes("despacho")) tipoIntimacao = "Despacho";
          else if (conteudoLower.includes("sentença")) tipoIntimacao = "Sentença";

          const rawDate = item.data_publicacao || item.data || null;
          const rawDisp = item.data_disponibilizacao || null;

          let dispDate = rawDisp || rawDate || null;
          let pubDate = item.data_publicacao || (dispDate ? nextBusinessDay(dispDate) : null);
          let intDate = pubDate ? nextBusinessDay(pubDate) : rawDate;

          intimacoes.push({
            processo_cnj: cnjMatch ? cnjMatch[1] : "",
            processo_titulo: titulo || "Publicação em Diário Oficial",
            tribunal: item.fonte?.sigla || item.tribunal || item.fonte?.nome || "",
            tipo_intimacao: tipoIntimacao,
            conteudo: conteudo.slice(0, 5000),
            data_intimacao: intDate,
            data_disponibilizacao: dispDate,
            data_publicacao: pubDate,
            oab_numero,
            oab_uf,
            advogado_id,
            fonte: "escavador_v1",
            raw_json: item,
          });
        }
      }
    }

    console.log(`📌 ${intimacoes.length} publicações processadas`);

    // Upsert: insert new or update existing with missing data
    let savedCount = 0;
    let updatedCount = 0;
    for (const int of intimacoes) {
      // Check for existing
      let query = supabase
        .from("intimacoes")
        .select("id, tribunal, data_disponibilizacao, data_publicacao, data_intimacao")
        .eq("oab_numero", oab_numero)
        .eq("oab_uf", oab_uf);

      if (int.processo_cnj) {
        query = query.eq("processo_cnj", int.processo_cnj);
      }
      if (int.tipo_intimacao) {
        query = query.eq("tipo_intimacao", int.tipo_intimacao);
      }

      const { data: existing } = await query.limit(1);

      if (existing && existing.length > 0) {
        const rec = existing[0];
        const updates: Record<string, any> = {};

        if (!rec.tribunal && int.tribunal) updates.tribunal = int.tribunal;

        // Fix dates: update if missing OR if all 3 dates are identical (old broken logic)
        const allSame = rec.data_disponibilizacao && rec.data_publicacao && rec.data_intimacao &&
          rec.data_disponibilizacao.slice(0, 10) === rec.data_publicacao.slice(0, 10) &&
          rec.data_publicacao.slice(0, 10) === rec.data_intimacao.slice(0, 10);

        if (allSame && int.data_disponibilizacao && int.data_publicacao && int.data_intimacao) {
          // Overwrite with correctly calculated dates
          updates.data_disponibilizacao = int.data_disponibilizacao;
          updates.data_publicacao = int.data_publicacao;
          updates.data_intimacao = int.data_intimacao;
        } else {
          if (!rec.data_disponibilizacao && int.data_disponibilizacao) updates.data_disponibilizacao = int.data_disponibilizacao;
          if (!rec.data_publicacao && int.data_publicacao) updates.data_publicacao = int.data_publicacao;
          if (!rec.data_intimacao && int.data_intimacao) updates.data_intimacao = int.data_intimacao;
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          const { error } = await supabase.from("intimacoes").update(updates).eq("id", rec.id);
          if (!error) updatedCount++;
          else console.warn(`⚠️ Erro ao atualizar:`, error.message);
        }
        continue;
      }

      const { error } = await supabase.from("intimacoes").insert(int);
      if (!error) savedCount++;
      else console.warn(`⚠️ Erro ao salvar:`, error.message);
    }

    console.log(`✅ ${savedCount} novas, ${updatedCount} atualizadas`);

    return new Response(
      JSON.stringify({
        success: true,
        total: intimacoes.length,
        saved: savedCount,
        updated: updatedCount,
        processosAnalisados: intimacoes.length,
        fonte,
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
