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

const TIPOS_INTIMACAO = new Set(["Intimação", "Citação", "Notificação", "Publicação"]);

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
  if (c.includes("publicação") || c.includes("publicacao")) return "Publicação";
  if (c.includes("despacho")) return "Despacho";
  if (c.includes("sentença") || c.includes("sentenca")) return "Sentença";
  if (c.includes("decisão") || c.includes("decisao")) return "Decisão";
  if (c.includes("audiência") || c.includes("audiencia")) return "Audiência";
  if (c.includes("petição") || c.includes("peticao")) return "Petição";
  if (c.includes("recurso")) return "Recurso";
  return "Movimentação";
}

function makeItem(fields: {
  cnj: string; titulo: string; tribunal: string; tipo: string;
  conteudo: string; dataDisp: string | null;
  oab_numero: string; oab_uf: string; advogado_id: string | null;
  fonte: string; raw: unknown;
}) {
  const { cnj, titulo, tribunal, tipo, conteudo, dataDisp, oab_numero, oab_uf, advogado_id, fonte, raw } = fields;
  const dataPub = dataDisp ? nextBusinessDay(dataDisp) : null;
  const dataInt = dataPub ? nextBusinessDay(dataPub) : dataDisp;
  return {
    processo_cnj: cnj,
    processo_titulo: titulo,
    tribunal,
    tipo_intimacao: tipo,
    conteudo: conteudo.slice(0, 5000),
    data_intimacao: dataInt,
    data_disponibilizacao: dataDisp,
    data_publicacao: dataPub,
    oab_numero,
    oab_uf,
    advogado_id,
    fonte,
    raw_json: raw,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
        return new Response(JSON.stringify({ success: false, error: "OAB não configurada" }),
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

    const CUTOFF = cutoffDate(); // 90 dias atrás

    console.log(`🔍 [Intimações] OAB/${oab_uf} ${oab_numero} | janela: ${CUTOFF}`);

    const intimacoes: any[] = [];

    // ── Estratégia 1: processo_movimentacoes do banco (DataJud já sincronizado) ─
    {
      const { data: movs } = await supabase
        .from("processo_movimentacoes")
        .select(`
          id, data_movimento, movimento_titulo, movimento_descricao, hash_unico, origem,
          processos!inner(numero_processo, titulo_acao, tribunal)
        `)
        .gte("data_movimento", CUTOFF)
        .or(
          "movimento_titulo.ilike.%intima%," +
          "movimento_titulo.ilike.%cita%," +
          "movimento_titulo.ilike.%notifica%," +
          "movimento_titulo.ilike.%publicac%," +
          "movimento_titulo.ilike.%publicaç%," +
          "movimento_descricao.ilike.%intima%," +
          "movimento_descricao.ilike.%cita%," +
          "movimento_descricao.ilike.%notifica%"
        )
        .order("data_movimento", { ascending: false })
        .limit(500);

      let dbCount = 0;
      for (const mov of (movs || [])) {
        const titulo = (mov.movimento_titulo || "") as string;
        const descricao = (mov.movimento_descricao || "") as string;
        const tipo = classifyMovimento(descricao, titulo);
        if (!TIPOS_INTIMACAO.has(tipo)) continue;

        const proc = mov.processos as any;
        const dataDisp = mov.data_movimento
          ? (mov.data_movimento as string).split("T")[0] : null;

        intimacoes.push(makeItem({
          cnj: proc?.numero_processo || "",
          titulo: proc?.titulo_acao || "",
          tribunal: proc?.tribunal || "",
          tipo, conteudo: descricao || titulo, dataDisp,
          oab_numero, oab_uf, advogado_id,
          fonte: (mov.origem as string) || "datajud",
          raw: { hash_unico: mov.hash_unico, titulo },
        }));
        dbCount++;
      }
      console.log(`📊 [DB] ${dbCount} intimações do banco`);
    }

    if (!ESCAVADOR_API_KEY) {
      console.warn("⚠️ ESCAVADOR_API_KEY não configurada — pulando busca no Escavador");
    } else {
      const esc = {
        Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
        "X-Requested-With": "XMLHttpRequest",
      };

      // ── Estratégia 2: V2 Escavador — todos os processos ativos com paginação ─
      try {
        // Busca até 3 páginas = 150 processos para garantir cobertura completa
        const processos: any[] = [];
        for (let procPage = 1; procPage <= 3; procPage++) {
          try {
            const procResp = await fetch(
              `https://api.escavador.com/api/v2/advogado/processos?oab_numero=${oab_numero}&oab_estado=${oab_uf}&limit=50&page=${procPage}`,
              { headers: esc, signal: AbortSignal.timeout(15000) }
            );
            if (!procResp.ok) break;
            const procData = await procResp.json();
            const pageItems: any[] = procData?.items || procData?.data || [];
            processos.push(...pageItems);
            console.log(`📋 [V2] Página ${procPage}: ${pageItems.length} processos`);
            if (pageItems.length < 50) break; // não há mais páginas
          } catch {
            break;
          }
        }

        // Filtro usando o mesmo CUTOFF de 90 dias (antes era 60 dias — perdia processos)
        const ativos = processos.filter((p: any) => {
          const fonte = p.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || p.fontes?.[0];
          const lastMov = fonte?.data_ultima_movimentacao || p.data_ultima_movimentacao;
          return !lastMov || lastMov >= CUTOFF;
        });

        console.log(`📋 [V2] ${processos.length} processos total, ${ativos.length} com atividade nos últimos 90 dias`);

        // Busca movimentações em batches paralelos de 5 para maximizar velocidade
        let v2Count = 0;
        const PARALLEL_BATCH = 5;
        const maxProcessos = Math.min(ativos.length, 60); // até 60 processos

        for (let i = 0; i < maxProcessos; i += PARALLEL_BATCH) {
          const batch = ativos.slice(i, i + PARALLEL_BATCH);

          const batchResults = await Promise.allSettled(batch.map(async (proc) => {
            const cnj = proc.numero_cnj || proc.numero_processo;
            if (!cnj) return [];

            const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0];
            const tribunalSigla = fonteTribunal?.sigla || fonteTribunal?.tribunal?.sigla || fonteTribunal?.nome || "";
            const procTitulo = `${proc.titulo_polo_ativo || ""} X ${proc.titulo_polo_passivo || ""}`.trim().replace(/^X\s*/, "").replace(/\s*X$/, "");

            const movResp = await fetch(
              `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?limit=30`,
              { headers: esc, signal: AbortSignal.timeout(12000) }
            );
            if (!movResp.ok) return [];

            const movData = await movResp.json();
            const found: any[] = [];

            for (const mov of (movData?.items || [])) {
              const movDate = (mov.data || "").split("T")[0];
              if (movDate && movDate < CUTOFF) continue;

              const conteudo = mov.conteudo || "";
              const tipo = classifyMovimento(conteudo, mov.tipo || "");
              if (!TIPOS_INTIMACAO.has(tipo)) continue;

              found.push(makeItem({
                cnj,
                titulo: procTitulo || fonteTribunal?.capa?.classe || "",
                tribunal: mov.fonte?.sigla || tribunalSigla,
                tipo, conteudo, dataDisp: movDate || null,
                oab_numero, oab_uf, advogado_id,
                fonte: "escavador_v2",
                raw: mov,
              }));
            }
            return found;
          }));

          for (const result of batchResults) {
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              for (const item of result.value) {
                intimacoes.push(item);
                v2Count++;
              }
            }
          }
        }

        console.log(`📋 [V2] ${v2Count} intimações de processos ativos`);
      } catch (e) {
        console.warn("⚠️ [V2] Erro geral:", e);
      }

      // ── Estratégia 3: V1 Escavador — Diário Oficial (5 páginas por termo) ──
      const searchTerms = [`OAB/${oab_uf} ${oab_numero}`, `OAB ${oab_uf} ${oab_numero}`];
      let v1Count = 0;

      for (const term of searchTerms) {
        for (let page = 1; page <= 5; page++) {
          try {
            const url = `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(term)}&qo=d&limit=50&page=${page}&data_inicio=${CUTOFF}`;
            const resp = await fetch(url, { headers: esc, signal: AbortSignal.timeout(15000) });
            if (!resp.ok) break;

            const data = await resp.json();
            const items: any[] = data?.items?.data || data?.items || data?.data || [];
            if (items.length === 0) break;

            for (const item of items) {
              const conteudo = item.texto || item.conteudo || item.content || "";
              const titulo = item.diario_nome || item.titulo || "Publicação em Diário Oficial";
              const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
              const tipo = classifyMovimento(conteudo, titulo);
              if (!TIPOS_INTIMACAO.has(tipo)) continue;

              const diarioData = item.diario_data || item.data_publicacao || item.data || "";
              if (diarioData && diarioData < CUTOFF) continue;

              intimacoes.push(makeItem({
                cnj: cnjMatch ? cnjMatch[1] : "",
                titulo,
                tribunal: item.diario_sigla || item.fonte?.sigla || "",
                tipo, conteudo, dataDisp: diarioData || null,
                oab_numero, oab_uf, advogado_id,
                fonte: "escavador_v1",
                raw: item,
              }));
              v1Count++;
            }

            const hasNext = !!(data?.links?.next ||
              data?.paginator?.next_page_url ||
              (data?.paginator && data.paginator.current_page < data.paginator.last_page));
            if (!hasNext) break;
          } catch {
            break;
          }
        }
      }
      console.log(`📋 [V1] ${v1Count} intimações do Diário Oficial`);
    }

    console.log(`📌 Total bruto: ${intimacoes.length} itens`);

    if (intimacoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total: 0, saved: 0, updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Deduplicação em memória ───────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("intimacoes")
      .select("id, processo_cnj, tipo_intimacao, data_disponibilizacao, tribunal, data_publicacao, data_intimacao")
      .eq("oab_numero", oab_numero)
      .eq("oab_uf", oab_uf)
      .gte("created_at", new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString());

    const existingMap = new Map<string, any>();
    for (const e of (existing || [])) {
      const key = `${e.processo_cnj || ""}|${e.tipo_intimacao || ""}|${e.data_disponibilizacao?.slice(0, 10) || ""}`;
      existingMap.set(key, e);
    }

    const toInsert: any[] = [];
    let updatedCount = 0;

    for (const int of intimacoes) {
      const key = `${int.processo_cnj || ""}|${int.tipo_intimacao || ""}|${int.data_disponibilizacao?.slice(0, 10) || ""}`;
      const rec = existingMap.get(key);

      if (rec) {
        const updates: Record<string, any> = {};
        if (!rec.tribunal && int.tribunal) updates.tribunal = int.tribunal;
        if (!rec.data_publicacao && int.data_publicacao) updates.data_publicacao = int.data_publicacao;
        if (!rec.data_intimacao && int.data_intimacao) updates.data_intimacao = int.data_intimacao;
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase.from("intimacoes").update(updates).eq("id", rec.id);
          updatedCount++;
        }
      } else {
        toInsert.push(int);
        existingMap.set(key, { id: "pending", ...int });
      }
    }

    // ── Insert em lote ────────────────────────────────────────────────────────
    let savedCount = 0;
    const CHUNK = 50;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error } = await supabase.from("intimacoes").insert(chunk);
      if (error) {
        for (const item of chunk) {
          const { error: e2 } = await supabase.from("intimacoes").insert(item);
          if (!e2) savedCount++;
        }
      } else {
        savedCount += chunk.length;
      }
    }

    // ── Notificações ──────────────────────────────────────────────────────────
    if (savedCount > 0) {
      const { data: adminRoles } = await supabase
        .from("user_roles").select("user_id").in("role", ["Administrador", "Gerente", "Advogado"]);
      const userIds = [...new Set((adminRoles || []).map((r: any) => r.user_id as string))];
      if (userIds.length > 0) {
        await supabase.from("notificacoes_internas").insert(
          userIds.map((uid) => ({
            user_id: uid,
            titulo: `${savedCount} nova(s) intimação(ões)`,
            mensagem: savedCount === 1
              ? `Nova intimação: ${toInsert[0]?.processo_cnj || "Processo não identificado"}`
              : `${savedCount} novas intimações/publicações encontradas.`,
            tipo: "alerta", lida: false, link: "/intimacoes",
            dados: { source: "intimacoes_oab", count: savedCount },
          }))
        );
      }
    }

    console.log(`✅ ${savedCount} novas | ${updatedCount} atualizadas`);

    return new Response(
      JSON.stringify({ success: true, total: intimacoes.length, saved: savedCount, updated: updatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
