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

// Janela dinâmica: busca movimentações dos últimos 90 dias
function cutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}

function nextBusinessDay(dateStr: string): string {
  const base = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`;
  let d = new Date(base);
  if (Number.isNaN(d.getTime())) d = new Date(`${dateStr.split("T")[0]}T12:00:00Z`);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function classifyMovimento(conteudo: string, tipo: string): string {
  const c = (conteudo + " " + tipo).toLowerCase();
  if (c.includes("intimação") || c.includes("intimacao")) return "Intimação";
  if (c.includes("citação") || c.includes("citacao")) return "Citação";
  if (c.includes("notificação") || c.includes("notificacao")) return "Notificação";
  if (c.includes("despacho")) return "Despacho";
  if (c.includes("sentença") || c.includes("sentenca")) return "Sentença";
  if (c.includes("decisão") || c.includes("decisao")) return "Decisão";
  if (c.includes("audiência") || c.includes("audiencia")) return "Audiência";
  if (c.includes("edital")) return "Edital";
  if (c.includes("publicação") || c.includes("publicacao")) return "Publicação";
  if (c.includes("petição") || c.includes("peticao")) return "Petição";
  if (c.includes("recurso")) return "Recurso";
  return "Movimentação";
}

async function fetchAllPages<T>(
  buildUrl: (page: number) => string,
  headers: Record<string, string>,
  maxPages = 10
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;

  while (page <= maxPages) {
    const resp = await fetch(buildUrl(page), { headers });
    if (!resp.ok) {
      console.warn(`⚠️ Página ${page} falhou (${resp.status})`);
      break;
    }
    const data = await resp.json();
    const items: T[] = data?.items?.data || data?.items || data?.data || [];
    if (items.length === 0) break;
    allItems.push(...items);
    const hasNext = !!(data?.links?.next || data?.paginator?.next_page_url ||
      (data?.paginator && data.paginator.current_page < data.paginator.last_page));
    if (!hasNext) break;
    page++;
  }

  return allItems;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ESCAVADOR_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "ESCAVADOR_API_KEY não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let oab_numero: string, oab_uf: string, advogado_id: string | null;

    if (req.method === "POST") {
      const body = await req.json();
      oab_numero = body.oab_numero;
      oab_uf = body.oab_uf;
      advogado_id = body.advogado_id || null;
    } else {
      const { data: settings } = await supabase
        .from("office_settings").select("oab_number, oab_state").limit(1).single();
      if (!settings?.oab_number) {
        return new Response(JSON.stringify({ success: false, error: "OAB não configurada no escritório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      oab_numero = settings.oab_number;
      oab_uf = settings.oab_state || "AM";
      advogado_id = null;
    }

    if (!oab_numero || !oab_uf) {
      return new Response(JSON.stringify({ success: false, error: "oab_numero e oab_uf são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const CUTOFF = cutoffDate();
    console.log(`🔍 [Intimações] OAB/${oab_uf} ${oab_numero} | janela: ${CUTOFF} → hoje`);

    const escavadorHeaders = {
      Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
      "X-Requested-With": "XMLHttpRequest",
    };

    const intimacoes: any[] = [];

    // ── Estratégia 1: V2 advogado/processos — TODAS as páginas ──────────────────
    console.log("📡 [V2] Buscando processos por OAB...");
    const processosResp = await fetch(
      `https://api.escavador.com/api/v2/advogado/processos?oab_numero=${oab_numero}&oab_estado=${oab_uf}&limit=50`,
      { headers: escavadorHeaders }
    );

    if (processosResp.status === 402) {
      return new Response(JSON.stringify({ success: false, error: "Créditos Escavador insuficientes" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (processosResp.ok) {
      const firstPage = await processosResp.json();
      let processos: any[] = firstPage?.items || firstPage?.data || [];
      console.log(`📋 [V2] Página 1: ${processos.length} processos`);

      // Busca TODAS as páginas seguintes
      let nextUrl = firstPage?.links?.next || firstPage?.paginator?.next_page_url;
      let pageNum = 2;
      while (nextUrl && pageNum <= 20) {
        try {
          const pageResp = await fetch(
            nextUrl.startsWith("http") ? nextUrl : `https://api.escavador.com${nextUrl}`,
            { headers: escavadorHeaders }
          );
          if (!pageResp.ok) break;
          const pageData = await pageResp.json();
          const pageItems: any[] = pageData?.items || pageData?.data || [];
          if (pageItems.length === 0) break;
          processos = [...processos, ...pageItems];
          console.log(`📋 [V2] Página ${pageNum}: +${pageItems.length} processos (total: ${processos.length})`);
          nextUrl = pageData?.links?.next || pageData?.paginator?.next_page_url;
          pageNum++;
        } catch (e) {
          console.warn(`⚠️ Erro página ${pageNum}:`, e);
          break;
        }
      }

      console.log(`📊 [V2] Total: ${processos.length} processos a verificar`);

      // Busca movimentações de TODOS os processos
      for (const proc of processos) {
        const cnj = proc.numero_cnj || proc.numero_processo;
        if (!cnj) continue;

        const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0];
        const tribunalSigla = fonteTribunal?.sigla || fonteTribunal?.tribunal?.sigla || fonteTribunal?.nome || "";
        const classeProcesso = fonteTribunal?.capa?.classe || proc.titulo_classe || "";

        try {
          const movResp = await fetch(
            `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?limit=50`,
            { headers: escavadorHeaders }
          );

          if (!movResp.ok) {
            console.warn(`⚠️ Movimentações ${cnj}: ${movResp.status}`);
            continue;
          }

          const movData = await movResp.json();
          const movimentacoes: any[] = movData?.items || [];

          for (const mov of movimentacoes) {
            const movDate = mov.data || "";
            if (movDate && movDate < CUTOFF) continue;

            const conteudo = mov.conteudo || "";
            const tipo = mov.tipo || "";
            const tipoIntimacao = classifyMovimento(conteudo, tipo);
            const tribunal = mov.fonte?.sigla || mov.fonte?.nome || tribunalSigla;

            const dataDisp = movDate || null;
            const dataPub = dataDisp ? nextBusinessDay(dataDisp) : null;
            const dataInt = dataPub ? nextBusinessDay(dataPub) : dataDisp;

            intimacoes.push({
              processo_cnj: cnj,
              processo_titulo: classeProcesso || `${proc.titulo_polo_ativo || ""} X ${proc.titulo_polo_passivo || ""}`,
              tribunal,
              tipo_intimacao: tipoIntimacao,
              conteudo: conteudo.slice(0, 5000),
              data_intimacao: dataInt,
              data_disponibilizacao: dataDisp,
              data_publicacao: dataPub,
              oab_numero,
              oab_uf,
              advogado_id,
              fonte: "escavador_v2",
              raw_json: mov,
            });
          }
        } catch (e) {
          console.warn(`⚠️ Erro movimentações ${cnj}:`, e);
        }
      }
    } else {
      console.warn(`⚠️ [V2] Falhou (${processosResp.status})`);
    }

    console.log(`📊 [V2] ${intimacoes.length} itens. Iniciando V1 diários...`);

    // ── Estratégia 2: V1 diários oficiais — múltiplas buscas + todas as páginas ─
    const searchTerms = [
      `OAB/${oab_uf} ${oab_numero}`,
      `OAB ${oab_uf} ${oab_numero}`,
      `${oab_numero} ${oab_uf}`,
    ];

    for (const term of searchTerms) {
      try {
        const v1Items = await fetchAllPages<any>(
          (page) =>
            `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(term)}&qo=d&limit=50&page=${page}&data_inicio=${CUTOFF}`,
          escavadorHeaders,
          5
        );

        console.log(`📋 [V1] "${term}": ${v1Items.length} resultados`);

        for (const item of v1Items) {
          const conteudo = item.texto || item.conteudo || item.content || "";
          const titulo = item.diario_nome || item.titulo || item.title || "Publicação em Diário Oficial";
          const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
          const tipoIntimacao = classifyMovimento(conteudo, titulo);

          const diarioData = item.diario_data || item.data_publicacao || item.data || "";
          if (diarioData && diarioData < CUTOFF) continue;

          const dataDisp = diarioData || null;
          const dataPub = dataDisp ? nextBusinessDay(dataDisp) : null;
          const dataInt = dataPub ? nextBusinessDay(dataPub) : dataDisp;

          intimacoes.push({
            processo_cnj: cnjMatch ? cnjMatch[1] : "",
            processo_titulo: titulo,
            tribunal: item.diario_sigla || item.fonte?.sigla || item.tribunal || "",
            tipo_intimacao: tipoIntimacao,
            conteudo: conteudo.slice(0, 5000),
            data_intimacao: dataInt,
            data_disponibilizacao: dataDisp,
            data_publicacao: dataPub,
            oab_numero,
            oab_uf,
            advogado_id,
            fonte: "escavador_v1",
            raw_json: item,
          });
        }
      } catch (e) {
        console.warn(`⚠️ Erro V1 "${term}":`, e);
      }
    }

    console.log(`📌 Total bruto: ${intimacoes.length} itens para salvar`);

    // ── Upsert ───────────────────────────────────────────────────────────────────
    let savedCount = 0;
    let updatedCount = 0;

    for (const int of intimacoes) {
      let query = supabase
        .from("intimacoes")
        .select("id, tribunal, data_disponibilizacao, data_publicacao, data_intimacao")
        .eq("oab_numero", oab_numero)
        .eq("oab_uf", oab_uf);

      if (int.processo_cnj) query = query.eq("processo_cnj", int.processo_cnj);
      if (int.tipo_intimacao) query = query.eq("tipo_intimacao", int.tipo_intimacao);

      // Also match by data_disponibilizacao to avoid inserting same event twice
      if (int.data_disponibilizacao) query = query.eq("data_disponibilizacao", int.data_disponibilizacao);

      const { data: existing } = await query.limit(1);

      if (existing && existing.length > 0) {
        const rec = existing[0];
        const updates: Record<string, any> = {};

        if (!rec.tribunal && int.tribunal) updates.tribunal = int.tribunal;

        const allSame = rec.data_disponibilizacao && rec.data_publicacao && rec.data_intimacao &&
          rec.data_disponibilizacao.slice(0, 10) === rec.data_publicacao.slice(0, 10) &&
          rec.data_publicacao.slice(0, 10) === rec.data_intimacao.slice(0, 10);

        if (allSame && int.data_disponibilizacao && int.data_publicacao && int.data_intimacao) {
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
        }
        continue;
      }

      const { error } = await supabase.from("intimacoes").insert(int);
      if (!error) savedCount++;
      else console.warn(`⚠️ Erro ao salvar:`, error.message);
    }

    // ── Notificações ─────────────────────────────────────────────────────────────
    if (savedCount > 0) {
      const { data: adminRoles } = await supabase
        .from("user_roles").select("user_id").in("role", ["Administrador", "Gerente", "Advogado"]);

      const userIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];

      if (userIds.length > 0) {
        const notifications = userIds.map((uid: string) => ({
          user_id: uid,
          titulo: `${savedCount} nova(s) intimação(ões)`,
          mensagem: savedCount === 1
            ? `Nova intimação encontrada: ${intimacoes.find(i => i)?.processo_cnj || "Processo não identificado"}`
            : `Foram encontradas ${savedCount} novas intimações/publicações nos seus processos.`,
          tipo: "alerta",
          lida: false,
          link: "/intimacoes",
          dados: { source: "intimacoes_oab", count: savedCount },
        }));

        await supabase.from("notificacoes_internas").insert(notifications);
        console.log(`🔔 ${notifications.length} notificações criadas`);
      }
    }

    console.log(`✅ ${savedCount} novas | ${updatedCount} atualizadas`);

    return new Response(
      JSON.stringify({ success: true, total: intimacoes.length, saved: savedCount, updated: updatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro nas intimações:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
