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

    const intimacoes: any[] = [];

    // ── Estratégia 1: processo_movimentacoes já no banco (DataJud + Escavador) ──
    // Não faz nenhuma chamada externa — usa dados já sincronizados pelo
    // processo-auto-sync que roda diariamente via DataJud.
    {
      const { data: movs, error: movErr } = await supabase
        .from("processo_movimentacoes")
        .select(`
          id, data_movimento, movimento_titulo, movimento_descricao, hash_unico, origem,
          processos!inner(numero_processo, titulo_acao, tribunal)
        `)
        .gte("data_movimento", CUTOFF)
        .order("data_movimento", { ascending: false })
        .limit(500);

      if (movErr) {
        console.warn("⚠️ Erro ao buscar movimentações do banco:", movErr.message);
      } else {
        console.log(`📊 [DB] ${movs?.length || 0} movimentações encontradas`);

        for (const mov of (movs || [])) {
          const titulo = (mov.movimento_titulo || "") as string;
          const descricao = (mov.movimento_descricao || "") as string;
          const tipo = classifyMovimento(descricao, titulo);

          // Incluir tudo exceto movimentações completamente genéricas
          if (tipo === "Movimentação" && !descricao && !titulo) continue;

          const proc = mov.processos as any;
          const dataDisp = mov.data_movimento
            ? (mov.data_movimento as string).split("T")[0]
            : null;
          const dataPub = dataDisp ? nextBusinessDay(dataDisp) : null;
          const dataInt = dataPub ? nextBusinessDay(dataPub) : dataDisp;

          intimacoes.push({
            processo_cnj: proc?.numero_processo || "",
            processo_titulo: proc?.titulo_acao || "",
            tribunal: proc?.tribunal || "",
            tipo_intimacao: tipo,
            conteudo: (descricao || titulo).slice(0, 5000),
            data_intimacao: dataInt,
            data_disponibilizacao: dataDisp,
            data_publicacao: dataPub,
            oab_numero,
            oab_uf,
            advogado_id,
            fonte: (mov.origem as string) || "datajud",
            raw_json: { hash_unico: mov.hash_unico, titulo },
          });
        }

        console.log(`📋 [DB] ${intimacoes.length} itens classificados`);
      }
    }

    // ── Estratégia 2: V1 Escavador — Diário Oficial ───────────────────────────
    // Complementa com publicações em diários que podem não estar no DataJud.
    if (ESCAVADOR_API_KEY) {
      const escavadorHeaders = {
        Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
        "X-Requested-With": "XMLHttpRequest",
      };

      const searchTerms = [
        `OAB/${oab_uf} ${oab_numero}`,
        `OAB ${oab_uf} ${oab_numero}`,
      ];

      for (const term of searchTerms) {
        let page = 1;
        const maxPages = 3;

        while (page <= maxPages) {
          try {
            const url = `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(term)}&qo=d&limit=50&page=${page}&data_inicio=${CUTOFF}`;
            const resp = await fetch(url, {
              headers: escavadorHeaders,
              signal: AbortSignal.timeout(20000),
            });

            if (!resp.ok) {
              console.warn(`⚠️ V1 "${term}" p${page}: ${resp.status}`);
              break;
            }

            const data = await resp.json();
            const items: any[] = data?.items?.data || data?.items || data?.data || [];

            if (items.length === 0) break;
            console.log(`📋 [V1] "${term}" p${page}: ${items.length} itens`);

            for (const item of items) {
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

            const hasNext = !!(
              data?.links?.next ||
              data?.paginator?.next_page_url ||
              (data?.paginator && data.paginator.current_page < data.paginator.last_page)
            );
            if (!hasNext) break;
            page++;
          } catch (e) {
            console.warn(`⚠️ Erro V1 "${term}" p${page}:`, e);
            break;
          }
        }
      }
    } else {
      console.warn("⚠️ ESCAVADOR_API_KEY não configurada — pulando busca em Diários Oficiais");
    }

    console.log(`📌 Total bruto: ${intimacoes.length} itens`);

    if (intimacoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total: 0, saved: 0, updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Deduplicação em memória — 1 SELECT em vez de N queries ───────────────
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
        console.warn(`⚠️ Chunk ${Math.floor(i / CHUNK) + 1} falhou:`, error.message);
        for (const item of chunk) {
          const { error: e2 } = await supabase.from("intimacoes").insert(item);
          if (!e2) savedCount++;
          else console.warn(`⚠️ Item:`, e2.message);
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
            tipo: "alerta",
            lida: false,
            link: "/intimacoes",
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
    console.error("❌ Erro nas intimações:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
