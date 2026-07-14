import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { stripHtml, classifyMovimento, TIPOS_INTIMACAO } from "../_shared/intimacoes-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const edgeRuntime = globalThis as typeof globalThis & {
  EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
};
function runInBackground(promise: Promise<unknown>) {
  if (edgeRuntime.EdgeRuntime?.waitUntil) { edgeRuntime.EdgeRuntime.waitUntil(promise); return; }
  void promise;
}

const DJEN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

// Busca DJEN por numeroOab não encontra nada do TJAM (confirmado: o TJAM
// alimenta o DJEN nacionalmente mas não marca o advogado destinatário de
// forma confiável). Buscar por numeroProcesso funciona normalmente — como já
// temos o CNJ de cada processo cadastrado, contornamos a lacuna do TJAM sem
// depender de OAB, e de quebra cobrimos qualquer tribunal com a mesma falha.
//
// O DJEN aplica algum bloqueio anti-abuso por IP (confirmado: mesma consulta
// que funciona da minha máquina toma 403 repetido vindo do IP de saída do
// Supabase, sobretudo sob volume). Como este sync bate no DJEN uma vez por
// processo (centenas por varredura, bem mais chamadas que a busca por OAB),
// o retorno distingue "bloqueado" de "sem resultado real" para permitir um
// circuit breaker — se ficarmos bloqueados, insistir em mais 800 processos só
// piora a situação com o provedor.
type DjenResult = { blocked: boolean; items: any[] };

async function fetchDjenPorProcesso(cnjNorm: string): Promise<DjenResult> {
  try {
    const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${cnjNorm}&itensPorPagina=50&pagina=1`;
    const resp = await fetch(url, { headers: DJEN_HEADERS, signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const data = await resp.json();
      return { blocked: false, items: Array.isArray(data?.items) ? data.items : [] };
    }
    // 403/429 já visto bloqueando o IP do Supabase mesmo na primeira tentativa
    // (teste em produção: circuit breaker disparou com apenas 5 chamadas) —
    // reter/retentar na hora só piora, melhor marcar bloqueado e deixar o
    // próximo ciclo do cron (20 min depois) tentar de novo.
    if (resp.status === 403 || resp.status === 429) return { blocked: true, items: [] };
    return { blocked: false, items: [] };
  } catch {
    return { blocked: true, items: [] };
  }
}

async function analisarNovasIntimacoes(rows: Array<Record<string, any>>) {
  const BATCH = 3;
  for (let i = 0; i < rows.length; i += BATCH) {
    const lote = rows.slice(i, i + BATCH);
    await Promise.allSettled(lote.map(async (row) => {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/intimacoes-analise`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            intimacao_id: row.id,
            conteudo: row.conteudo,
            tipo_intimacao: row.tipo_intimacao,
            tribunal: row.tribunal,
            processo_cnj: row.processo_cnj,
            processo_titulo: row.processo_titulo,
            data_publicacao: row.data_publicacao,
          }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (e) {
        console.warn(`⚠️ [Auto-análise] ${row.id} falhou:`, e);
      }
    }));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const maxProcessos: number = body.max || 80;

    console.log(`🔄 [Processo-DJEN-Sync] Iniciando... max=${maxProcessos}`);

    const { data: processos, error: fetchError } = await supabase
      .from("processos")
      .select("id, numero_processo, cnj_normalizado")
      .not("cnj_normalizado", "is", null)
      .in("status", ["Em Andamento", "Suspenso"])
      .order("ultima_consulta_djen_at", { ascending: true, nullsFirst: true })
      .limit(maxProcessos);

    if (fetchError) throw new Error(`Erro ao buscar processos: ${fetchError.message}`);
    if (!processos || processos.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum processo para verificar", processados: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // intimacoes.oab_numero é NOT NULL — como aqui buscamos por CNJ (não por
    // advogado), tentamos extrair o advogado destinatário do próprio item do
    // DJEN (destinatarioadvogados); sem isso, cai na OAB genérica do escritório
    // (mesmo fallback usado no sync por OAB).
    const { data: officeSettings } = await supabase.from("office_settings").select("oab_number, oab_state").limit(1).maybeSingle();
    const oabFallback = { numero: officeSettings?.oab_number || "0", uf: officeSettings?.oab_state || "AM" };

    function resolverOabDoItem(item: any): { oab_numero: string; oab_uf: string } {
      const advs: any[] = Array.isArray(item?.destinatarioadvogados) ? item.destinatarioadvogados : [];
      const primeiro = advs.find((a) => a?.advogado?.numero_oab)?.advogado;
      if (primeiro) return { oab_numero: String(primeiro.numero_oab), oab_uf: primeiro.uf_oab || "AM" };
      return { oab_numero: oabFallback.numero, oab_uf: oabFallback.uf };
    }

    const startTime = Date.now();
    const TIME_BUDGET_MS = 100_000;
    let processados = 0, novas = 0, comErro = 0, tempoEsgotado = false, bloqueadoPeloDjen = false;
    let bloqueiosConsecutivos = 0;
    const BLOQUEIOS_MAX = 3; // teste em produção: DJEN já bloqueou com só 5 chamadas — para cedo, não desperdiça o resto do lote
    const novasInseridas: any[] = [];

    for (const processo of processos) {
      if (Date.now() - startTime > TIME_BUDGET_MS) { tempoEsgotado = true; break; }
      if (bloqueiosConsecutivos >= BLOQUEIOS_MAX) { bloqueadoPeloDjen = true; break; }

      try {
        const { blocked, items } = await fetchDjenPorProcesso(processo.cnj_normalizado);
        processados++;
        bloqueiosConsecutivos = blocked ? bloqueiosConsecutivos + 1 : 0;
        console.log(`🔎 [DJEN] ${processo.numero_processo}: blocked=${blocked} items=${items.length}`);
        if (blocked) {
          // não marca ultima_consulta_djen_at — não verificamos de verdade, tenta de novo no próximo ciclo
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (items.length > 0) {
          const { data: existentes } = await supabase
            .from("intimacoes")
            .select("tipo_intimacao, data_disponibilizacao")
            .eq("processo_id", processo.id);
          const existingKeys = new Set(
            (existentes || []).map((e: any) => `${e.tipo_intimacao || ""}|${(e.data_disponibilizacao || "").slice(0, 10)}`)
          );

          for (const item of items) {
            const dataDisp: string = item.data_disponibilizacao || "";
            const tipoRaw = classifyMovimento(item.texto || "", item.tipoComunicacao || "");
            const tipo = TIPOS_INTIMACAO.has(tipoRaw) ? tipoRaw : "Publicação";
            const key = `${tipo}|${dataDisp.slice(0, 10)}`;
            if (existingKeys.has(key)) continue;

            const conteudo = stripHtml(item.texto || "");
            const { oab_numero, oab_uf } = resolverOabDoItem(item);
            const { data: inserted, error: insertError } = await supabase
              .from("intimacoes")
              .insert({
                processo_id: processo.id,
                processo_cnj: item.numeroprocessocommascara || processo.numero_processo,
                processo_titulo: item.nomeClasse || null,
                tribunal: item.siglaTribunal || null,
                tipo_intimacao: tipo,
                conteudo,
                data_disponibilizacao: dataDisp || null,
                data_publicacao: dataDisp || null,
                oab_numero,
                oab_uf,
                fonte: "djen_processo",
                raw_json: item,
              })
              .select("id, conteudo, tipo_intimacao, tribunal, processo_cnj, processo_titulo, data_publicacao")
              .single();

            if (!insertError && inserted) {
              novas++;
              novasInseridas.push(inserted);
              existingKeys.add(key);
            } else if (insertError) {
              console.error(`❌ Erro ao inserir intimação (processo ${processo.numero_processo}):`, insertError.message);
            }
          }
        }

        await supabase.from("processos").update({ ultima_consulta_djen_at: new Date().toISOString() }).eq("id", processo.id);
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: unknown) {
        comErro++;
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`❌ Erro no processo ${processo.numero_processo}:`, msg);
        await supabase.from("processos").update({ ultima_consulta_djen_at: new Date().toISOString() }).eq("id", processo.id);
      }
    }

    if (novasInseridas.length > 0) {
      runInBackground(analisarNovasIntimacoes(novasInseridas));

      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").in("role", ["Administrador", "Gerente", "Advogado"]);
      const userIds = [...new Set((adminRoles || []).map((r: any) => r.user_id as string))];
      if (userIds.length > 0) {
        await supabase.from("notificacoes_internas").insert(
          userIds.map((uid) => ({
            user_id: uid,
            titulo: `${novasInseridas.length} nova(s) intimação(ões) (DJEN por processo)`,
            mensagem: `${novasInseridas.length} nova(s) intimação(ões)/publicação(ões) encontradas via DJEN, vinculadas a processos já cadastrados.`,
            tipo: "alerta", lida: false, link: "/intimacoes",
            dados: { source: "processo_djen_sync", count: novasInseridas.length },
          }))
        );
      }
    }

    console.log(`📊 Processo-DJEN-Sync completo: ${processados} processos verificados, ${novas} novas intimações, ${comErro} erros${tempoEsgotado ? " (parou por tempo)" : ""}${bloqueadoPeloDjen ? " (parou por bloqueio do DJEN)" : ""}`);

    return new Response(
      JSON.stringify({ success: true, processados, novas, comErro, total: processos.length, tempoEsgotado, bloqueadoPeloDjen }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro geral no processo-djen-sync:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
