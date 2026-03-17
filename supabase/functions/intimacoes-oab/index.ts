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

    const intimacoes: any[] = [];
    let fonte = "escavador_v2+v1";

    // ── Strategy 1: V2 advogado/processos + movimentações ──
    const processosResp = await fetch(
      `https://api.escavador.com/api/v2/advogado/processos?oab_numero=${oab_numero}&oab_estado=${oab_uf}`,
      {
        headers: {
          Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    console.log(`📡 Escavador V2 status: ${processosResp.status}`);

    if (processosResp.status === 402) {
      return new Response(
        JSON.stringify({ success: false, error: "Créditos Escavador insuficientes" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (processosResp.ok) {
      const processosData = await processosResp.json();
      console.log(`📦 Escavador response keys: ${Object.keys(processosData || {}).join(', ')}`);
      let processos = processosData?.items || processosData?.data || [];
      console.log(`📋 ${processos.length} processos encontrados via OAB (página 1)`);

      // Fetch page 2 if available (older processes with actual movements)
      const nextPageUrl = processosData?.links?.next || processosData?.paginator?.next_page_url;
      if (nextPageUrl) {
        try {
          const page2Resp = await fetch(
            nextPageUrl.startsWith("http") ? nextPageUrl : `https://api.escavador.com${nextPageUrl}`,
            {
              headers: {
                Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
                "X-Requested-With": "XMLHttpRequest",
              },
            }
          );
          if (page2Resp.ok) {
            const page2Data = await page2Resp.json();
            const page2Items = page2Data?.items || page2Data?.data || [];
            console.log(`📋 Página 2: ${page2Items.length} processos adicionais`);
            processos = [...processos, ...page2Items];
          }
        } catch (e) {
          console.warn(`⚠️ Erro ao buscar página 2:`, e);
        }
      }

      const maxProcessos = 15;
      const processosToFetch = processos.slice(0, maxProcessos);
      if (processos.length > maxProcessos) {
        console.log(`⚠️ Limitando a ${maxProcessos} de ${processos.length} processos`);
      }

      for (const proc of processosToFetch) {
        const cnj = proc.numero_cnj || proc.numero_processo;
        if (!cnj) { console.log(`⏭️ Processo sem CNJ, pulando`); continue; }

        const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0];
        const tribunalSigla = fonteTribunal?.sigla || fonteTribunal?.tribunal?.sigla || fonteTribunal?.nome || "";
        const classeProcesso = fonteTribunal?.capa?.classe || proc.titulo_classe || "";

        console.log(`🔎 Buscando movimentações: ${cnj}`);

        try {
          const movResp = await fetch(
            `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?limit=50`,
            {
              headers: {
                Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
                "X-Requested-With": "XMLHttpRequest",
              },
            }
          );

          if (movResp.ok) {
            const movData = await movResp.json();
            const movimentacoes = movData?.items || [];
            console.log(`  📄 ${movimentacoes.length} movimentações para ${cnj}`);

            for (const mov of movimentacoes) {
              const conteudo = mov.conteudo || "";
              const tipo = mov.tipo || "";
              const conteudoLower = conteudo.toLowerCase();
              const tipoLower = tipo.toLowerCase();
              const combined = conteudoLower + " " + tipoLower;

              const movDate = mov.data || "";
              if (movDate && movDate < "2026-01-01") continue;

              let tipoIntimacao = "Movimentação";
              if (combined.includes("intimação") || combined.includes("intimacao")) tipoIntimacao = "Intimação";
              else if (combined.includes("citação") || combined.includes("citacao")) tipoIntimacao = "Citação";
              else if (combined.includes("notificação") || combined.includes("notificacao")) tipoIntimacao = "Notificação";
              else if (combined.includes("despacho")) tipoIntimacao = "Despacho";
              else if (combined.includes("sentença") || combined.includes("sentenca")) tipoIntimacao = "Sentença";
              else if (combined.includes("decisão") || combined.includes("decisao")) tipoIntimacao = "Decisão";
              else if (combined.includes("edital")) tipoIntimacao = "Edital";
              else if (combined.includes("publicação") || combined.includes("publicacao")) tipoIntimacao = "Publicação";
              else if (combined.includes("audiência") || combined.includes("audiencia")) tipoIntimacao = "Audiência";

              const rawDate = mov.data || null;
              const tribunal = mov.fonte?.sigla || mov.fonte?.nome || tribunalSigla;

              let dataDisponibilizacao = rawDate;
              let dataPublicacao = rawDate ? nextBusinessDay(rawDate) : null;
              let dataIntimacao = dataPublicacao ? nextBusinessDay(dataPublicacao) : rawDate;

              intimacoes.push({
                processo_cnj: cnj,
                processo_titulo: classeProcesso || `${proc.titulo_polo_ativo || ''} X ${proc.titulo_polo_passivo || ''}`,
                tribunal: tribunal,
                tipo_intimacao: tipoIntimacao,
                conteudo: conteudo.slice(0, 5000),
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
          } else {
            const errBody = await movResp.text().catch(() => "");
            console.warn(`⚠️ Movimentações falhou para ${cnj}: ${movResp.status} - ${errBody.slice(0, 200)}`);
          }
        } catch (e) {
          console.warn(`⚠️ Erro ao buscar movimentações para ${cnj}:`, e);
        }
      }
    } else {
      const errText = await processosResp.text().catch(() => "");
      console.warn(`⚠️ V2 falhou (${processosResp.status}): ${errText.slice(0, 500)}`);
    }

    console.log(`📊 V2 encontrou ${intimacoes.length} itens. Agora buscando V1 diários...`);

    // ── Strategy 2: ALWAYS also search V1 diários oficiais ──
    // This is the primary source for actual intimações/publicações in court journals
    const searchTerm = `OAB ${oab_uf} ${oab_numero}`;
    try {
      const buscaResp = await fetch(
        `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(searchTerm)}&qo=d&limit=50&page=1&data_inicio=2026-01-01`,
        {
          headers: {
            Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      console.log(`📡 Escavador V1 diários status: ${buscaResp.status}`);

      if (buscaResp.ok) {
        const buscaData = await buscaResp.json();
        const resultados = buscaData?.items?.data || buscaData?.items || buscaData?.data || [];
        console.log(`📋 V1: ${resultados.length} resultados em diários`);
        if (resultados.length > 0) {
          const sample = resultados[0];
          console.log(`📋 V1 sample keys: ${Object.keys(sample).join(', ')}`);
          console.log(`📋 V1 sample diario_data: ${sample.diario_data}, data_publicacao: ${sample.data_publicacao}, data: ${sample.data}`);
          console.log(`📋 V1 sample texto length: ${(sample.texto || '').length}, conteudo: ${(sample.conteudo || '').length}`);
        }

        for (const item of resultados) {
          const conteudo = item.texto || item.conteudo || item.content || "";
          const titulo = item.diario_nome || item.titulo || item.title || "";
          const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);

          const conteudoLower = conteudo.toLowerCase();
          let tipoIntimacao = "Publicação";
          if (conteudoLower.includes("intimação") || conteudoLower.includes("intimacao")) tipoIntimacao = "Intimação";
          else if (conteudoLower.includes("citação")) tipoIntimacao = "Citação";
          else if (conteudoLower.includes("despacho")) tipoIntimacao = "Despacho";
          else if (conteudoLower.includes("sentença") || conteudoLower.includes("sentenca")) tipoIntimacao = "Sentença";
          else if (conteudoLower.includes("decisão") || conteudoLower.includes("decisao")) tipoIntimacao = "Decisão";
          else if (conteudoLower.includes("notificação") || conteudoLower.includes("notificacao")) tipoIntimacao = "Notificação";

          const diarioData = item.diario_data || item.data_publicacao || item.data || "";
          if (diarioData && diarioData < "2026-01-01") continue;

          let dataDisponibilizacao = diarioData || null;
          let dataPublicacao = dataDisponibilizacao ? nextBusinessDay(dataDisponibilizacao) : null;
          let dataIntimacao = dataPublicacao ? nextBusinessDay(dataPublicacao) : diarioData || null;

          intimacoes.push({
            processo_cnj: cnjMatch ? cnjMatch[1] : "",
            processo_titulo: titulo || "Publicação em Diário Oficial",
            tribunal: item.diario_sigla || item.fonte?.sigla || item.tribunal || "",
            tipo_intimacao: tipoIntimacao,
            conteudo: conteudo.slice(0, 5000),
            data_intimacao: dataIntimacao,
            data_disponibilizacao: dataDisponibilizacao,
            data_publicacao: dataPublicacao,
            oab_numero,
            oab_uf,
            advogado_id,
            fonte: "escavador_v1",
            raw_json: item,
          });
        }
      } else {
        console.warn(`⚠️ V1 diários falhou: ${buscaResp.status}`);
      }
    } catch (e) {
      console.warn(`⚠️ Erro na busca V1 diários:`, e);
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

    // Notify admin users about new intimações
    if (savedCount > 0) {
      console.log(`🔔 Criando notificações para ${savedCount} novas intimações`);
      
      // Get all admin/gerente users to notify
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["Administrador", "Gerente"]);

      const userIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];
      
      if (userIds.length > 0) {
        const notifications = userIds.map((uid: string) => ({
          user_id: uid,
          titulo: `${savedCount} nova(s) intimação(ões)`,
          mensagem: savedCount === 1
            ? `Nova intimação encontrada: ${intimacoes[intimacoes.length - 1]?.processo_cnj || 'Processo não identificado'}`
            : `Foram encontradas ${savedCount} novas intimações/movimentações nos seus processos.`,
          tipo: 'alerta',
          lida: false,
          link: '/intimacoes',
          dados: { source: 'intimacoes_oab', count: savedCount },
        }));

        const { error: notifError } = await supabase
          .from("notificacoes_internas")
          .insert(notifications);

        if (notifError) {
          console.warn(`⚠️ Erro ao criar notificações:`, notifError.message);
        } else {
          console.log(`✅ ${notifications.length} notificações criadas`);
        }
      }
    }

    // Backfill fix: correct existing rows where all 3 dates were previously saved as identical
    let correctedLegacyCount = 0;
    const { data: legacyRows } = await supabase
      .from("intimacoes")
      .select("id, data_disponibilizacao, data_publicacao, data_intimacao")
      .eq("oab_numero", oab_numero)
      .eq("oab_uf", oab_uf)
      .not("data_disponibilizacao", "is", null)
      .not("data_publicacao", "is", null)
      .not("data_intimacao", "is", null)
      .limit(500);

    if (legacyRows?.length) {
      for (const row of legacyRows) {
        const disp = String(row.data_disponibilizacao).slice(0, 10);
        const pub = String(row.data_publicacao).slice(0, 10);
        const intm = String(row.data_intimacao).slice(0, 10);

        if (disp === pub && pub === intm) {
          const correctedPub = nextBusinessDay(disp);
          const correctedInt = nextBusinessDay(correctedPub);

          const { error } = await supabase
            .from("intimacoes")
            .update({
              data_disponibilizacao: disp,
              data_publicacao: correctedPub,
              data_intimacao: correctedInt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          if (!error) correctedLegacyCount++;
        }
      }
    }

    console.log(`✅ ${savedCount} novas, ${updatedCount} atualizadas, ${correctedLegacyCount} corrigidas (legado)`);

    return new Response(
      JSON.stringify({
        success: true,
        total: intimacoes.length,
        saved: savedCount,
        updated: updatedCount,
        corrected_legacy: correctedLegacyCount,
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
