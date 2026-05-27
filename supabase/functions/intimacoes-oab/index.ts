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

    // Resolve nome do advogado para busca nominal no Diário Oficial
    let advogadoNome: string | null = null;
    if (advogado_id) {
      const { data: perfil } = await supabase
        .from("perfis")
        .select("nome, sobrenome")
        .eq("id", advogado_id)
        .single();
      if (perfil?.nome) {
        advogadoNome = `${perfil.nome} ${perfil.sobrenome || ""}`.trim().toUpperCase();
      }
    }

    const CUTOFF = cutoffDate(); // 90 dias atrás

    console.log(`🔍 [Intimações] OAB/${oab_uf} ${oab_numero} | advogado: ${advogadoNome || "desconhecido"} | janela: ${CUTOFF}`);

    const intimacoes: any[] = [];

    if (!ESCAVADOR_API_KEY) {
      console.warn("⚠️ ESCAVADOR_API_KEY não configurada — pulando busca no Escavador");
    } else {
      const esc = {
        Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
        "X-Requested-With": "XMLHttpRequest",
      };

      // Helper: extrai array de qualquer estrutura de resposta Escavador
      function parseItems(data: any): any[] {
        const candidates = [
          data?.items,
          data?.items?.data,
          data?.data,
          data?.publicacoes,
          data?.publicacoes?.data,
          data?.result,
          data?.result?.data,
          data?.records,
          data?.movimentacoes,
        ];
        return candidates.find((c) => Array.isArray(c) && c.length > 0) ?? [];
      }

      // ── Estratégia 1b: V1 Publicações por ID interno do advogado ────────────
      let escavadorAdvId: number | null = null;
      try {
        // Tenta múltiplas queries para encontrar o ID: por OAB e por nome
        const idSearchTerms: string[] = [
          `${oab_numero}/${oab_uf}`,
          `${oab_numero} ${oab_uf}`,
        ];
        if (advogadoNome) idSearchTerms.push(advogadoNome);

        for (const term of idSearchTerms) {
          if (escavadorAdvId) break;
          const searchUrl = `https://api.escavador.com/api/v1/advogados/busca?q=${encodeURIComponent(term)}&limit=10`;
          const searchResp = await fetch(searchUrl, { headers: esc, signal: AbortSignal.timeout(10000) });
          if (!searchResp.ok) {
            console.warn(`⚠️ [V1-id] busca "${term}" → HTTP ${searchResp.status}`);
            continue;
          }
          const searchData = await searchResp.json();
          // Log da estrutura raw para diagnóstico (somente primeira vez)
          if (term === idSearchTerms[0]) {
            console.log(`🔎 [V1-id] raw keys: ${Object.keys(searchData || {}).join(", ")}`);
          }
          const advs: any[] = parseItems(searchData);
          for (const adv of advs) {
            const num = String(adv.oab_numero || adv.numero_oab || adv.numero || "").replace(/\D/g, "");
            const uf = String(adv.oab_uf || adv.estado_oab || adv.uf || adv.estado || "").toUpperCase();
            if (num === oab_numero && uf === oab_uf) {
              escavadorAdvId = adv.id || adv.advogado_id || adv.entity_id || adv.pessoa_id || null;
              console.log(`✅ [V1-id] OAB match via "${term}" → id=${escavadorAdvId}`);
              break;
            }
          }
          // fallback: único resultado → assume que é o advogado correto
          if (!escavadorAdvId && advs.length === 1) {
            escavadorAdvId = advs[0]?.id || advs[0]?.advogado_id || advs[0]?.entity_id || null;
            console.log(`✅ [V1-id] único resultado via "${term}" → id=${escavadorAdvId}`);
          }
        }
        if (!escavadorAdvId) console.warn("⚠️ [V1-id] ID do advogado não encontrado em nenhuma query");
      } catch (e) {
        console.warn("⚠️ [V1-id] Erro ao buscar ID:", e);
      }

      if (escavadorAdvId) {
        let idPubCount = 0;
        try {
          for (let page = 1; page <= 20; page++) {
            try {
              const resp = await fetch(
                `https://api.escavador.com/api/v1/advogados/${escavadorAdvId}/publicacoes?data_inicio=${CUTOFF}&limit=50&page=${page}&order_direction=desc`,
                { headers: esc, signal: AbortSignal.timeout(15000) }
              );
              if (!resp.ok) {
                const errText = await resp.text().catch(() => "");
                console.warn(`⚠️ [V1-id] publicacoes p${page} → HTTP ${resp.status}: ${errText.slice(0, 200)}`);
                break;
              }
              const data = await resp.json();
              if (page === 1) console.log(`🔎 [V1-id] publicacoes raw keys: ${Object.keys(data || {}).join(", ")}`);
              const items: any[] = parseItems(data);
              if (items.length === 0) break;

              for (const item of items) {
                const conteudo = item.texto || item.conteudo || item.content || "";
                const titulo = item.diario_nome || item.titulo || "Publicação em Diário Oficial";
                const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
                const dataDisp = item.data_disponibilizacao || item.diario_data || item.data_publicacao || item.data || "";
                if (dataDisp && dataDisp < CUTOFF) continue;
                const tipoRaw = classifyMovimento(conteudo, titulo);
                const tipo = TIPOS_INTIMACAO.has(tipoRaw) ? tipoRaw : "Publicação";
                intimacoes.push(makeItem({
                  cnj: cnjMatch ? cnjMatch[1] : "",
                  titulo,
                  tribunal: item.diario_sigla || item.fonte?.sigla || item.tribunal?.sigla || "",
                  tipo, conteudo, dataDisp: dataDisp || null,
                  oab_numero, oab_uf, advogado_id,
                  fonte: "escavador_v1_id",
                  raw: item,
                }));
                idPubCount++;
              }
              if (items.length < 50) break;
            } catch (err) {
              console.error(`📋 [V1-id] Erro na página:`, err);
              break;
            }
          }
          console.log(`📋 [V1-id] ${idPubCount} publicações via ID do advogado`);
        } catch (e) {
          console.warn("⚠️ [V1-id] Erro geral:", e);
        }
      }

      // ── Estratégia 2: V2 Escavador — todos os processos + movimentações recentes
      try {
        const processos: any[] = [];
        for (let procPage = 1; procPage <= 5; procPage++) {
          try {
            const procResp = await fetch(
              `https://api.escavador.com/api/v2/advogado/processos?oab_numero=${oab_numero}&oab_estado=${oab_uf}&limit=50&page=${procPage}`,
              { headers: esc, signal: AbortSignal.timeout(15000) }
            );
            if (!procResp.ok) break;
            const procData = await procResp.json();
            const pageItems: any[] = parseItems(procData);
            processos.push(...pageItems);
            console.log(`📋 [V2] Página ${procPage}: ${pageItems.length} processos`);
            if (pageItems.length < 50) break;
          } catch (err) {
            console.error(`📋 [V2] Erro na página ${procPage}:`, err);
            break;
          }
        }

        console.log(`📋 [V2] ${processos.length} processos total`);

        let v2Count = 0;
        const PARALLEL_BATCH = 5;

        for (let i = 0; i < processos.length; i += PARALLEL_BATCH) {
          const batch = processos.slice(i, i + PARALLEL_BATCH);

          const batchResults = await Promise.allSettled(batch.map(async (proc) => {
            const cnj = proc.numero_cnj || proc.numero_processo;
            if (!cnj) return [];

            const fonteTribunal = proc.fontes?.find((f: any) => f.tipo === "TRIBUNAL") || proc.fontes?.[0];
            const tribunalSigla = fonteTribunal?.sigla || fonteTribunal?.tribunal?.sigla || fonteTribunal?.nome || "";
            const procTitulo = `${proc.titulo_polo_ativo || ""} X ${proc.titulo_polo_passivo || ""}`.trim().replace(/^X\s*/, "").replace(/\s*X$/, "");

            // data_inicio filtra server-side + order_direction=desc garante as mais recentes primeiro
            const movResp = await fetch(
              `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(cnj)}/movimentacoes?limit=100&data_inicio=${CUTOFF}&order_direction=desc`,
              { headers: esc, signal: AbortSignal.timeout(12000) }
            );
            if (!movResp.ok) return [];

            const movData = await movResp.json();
            const found: any[] = [];

            for (const mov of parseItems(movData)) {
              const movDate = (mov.data || mov.data_publicacao || "").split("T")[0];
              if (movDate && movDate < CUTOFF) continue;

              const conteudo = mov.conteudo || mov.texto || "";
              const tipo = classifyMovimento(conteudo, mov.tipo || mov.titulo || "");
              if (!TIPOS_INTIMACAO.has(tipo)) continue;

              found.push(makeItem({
                cnj,
                titulo: procTitulo || fonteTribunal?.capa?.classe || "",
                tribunal: mov.fonte?.sigla || mov.tribunal?.sigla || tribunalSigla,
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

        console.log(`📋 [V2] ${v2Count} intimações de movimentações`);
      } catch (e) {
        console.warn("⚠️ [V2] Erro geral:", e);
      }

      // ── Estratégia 3: V2 Publicações por OAB — endpoint dedicado ─────────────
      let v2PubCount = 0;
      try {
        for (let page = 1; page <= 20; page++) {
          try {
            const resp = await fetch(
              `https://api.escavador.com/api/v2/advogado/publicacoes?oab_numero=${oab_numero}&oab_estado=${oab_uf}&limit=50&page=${page}&data_inicio=${CUTOFF}&order_direction=desc`,
              { headers: esc, signal: AbortSignal.timeout(15000) }
            );
            if (!resp.ok) {
              const errText = await resp.text().catch(() => "");
              console.log(`📋 [V2-pub] HTTP ${resp.status}: ${errText.slice(0, 200)}`);
              break;
            }
            const data = await resp.json();
            if (page === 1) console.log(`🔎 [V2-pub] raw keys: ${Object.keys(data || {}).join(", ")}`);
            const items: any[] = parseItems(data);
            if (items.length === 0) break;

            for (const item of items) {
              const conteudo = item.texto || item.conteudo || item.content || "";
              const titulo = item.diario_nome || item.titulo || item.fonte_nome || "Publicação em Diário Oficial";
              const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
              const dataDisp = item.data_disponibilizacao || item.diario_data || item.data_publicacao || item.data || "";
              if (dataDisp && dataDisp < CUTOFF) continue;
              const tipoRaw = classifyMovimento(conteudo, titulo);
              const tipo = TIPOS_INTIMACAO.has(tipoRaw) ? tipoRaw : "Publicação";
              intimacoes.push(makeItem({
                cnj: cnjMatch ? cnjMatch[1] : "",
                titulo,
                tribunal: item.tribunal?.sigla || item.fonte?.sigla || item.diario_sigla || "",
                tipo, conteudo, dataDisp: dataDisp || null,
                oab_numero, oab_uf, advogado_id,
                fonte: "escavador_v2_pub",
                raw: item,
              }));
              v2PubCount++;
            }
            if (items.length < 50) break;
          } catch (err) {
            console.error(`📋 [V2-pub] Erro na página:`, err);
            break;
          }
        }
        console.log(`📋 [V2-pub] ${v2PubCount} publicações diretas por OAB`);
      } catch (e) {
        console.warn("⚠️ [V2-pub] Erro geral:", e);
      }

      // ── Estratégia 4: V1 Busca no Diário Oficial — por nome e OAB ────────────
      // Busca textual como fallback / complemento. Prioriza o nome completo do
      // advogado, que aparece em publicações sem o número OAB.
      const nameTerms: string[] = [];
      if (advogadoNome) {
        nameTerms.push(advogadoNome); // nome completo em maiúsculas
        const parts = advogadoNome.split(" ").filter((p: string) => p.length > 2);
        if (parts.length >= 4) {
          // Ex: "ANDREY BENTES RAMOS" (primeiro + dois últimos)
          nameTerms.push(`${parts[0]} ${parts.slice(-2).join(" ")}`);
        }
        if (parts.length >= 2) {
          // Ex: "ANDREY RAMOS" (primeiro + último)
          nameTerms.push(`${parts[0]} ${parts[parts.length - 1]}`);
        }
      }
      const oabTerms = [
        `OAB/${oab_uf} ${oab_numero}`,
        `OAB ${oab_uf} ${oab_numero}`,
        `${oab_numero}/${oab_uf}`,
      ];
      // Nome primeiro (principal) → OAB como complemento
      const searchTerms = [...nameTerms, ...oabTerms];
      let v1Count = 0;

      for (const term of searchTerms) {
        for (let page = 1; page <= 5; page++) {
          try {
            // Sem qo=d para não restringir operador de busca
            const url = `https://api.escavador.com/api/v1/busca?q=${encodeURIComponent(term)}&limit=50&page=${page}&data_inicio=${CUTOFF}`;
            const resp = await fetch(url, { headers: esc, signal: AbortSignal.timeout(15000) });
            if (!resp.ok) break;

            const data = await resp.json();
            // A estrutura do V1 pode variar: items.data (paginado) ou items (array direto)
            const items: any[] = Array.isArray(data?.items) ? data.items
              : Array.isArray(data?.items?.data) ? data.items.data
              : Array.isArray(data?.data) ? data.data
              : [];
            if (items.length === 0) break;

            for (const item of items) {
              const conteudo = item.texto || item.conteudo || item.content || "";
              const titulo = item.diario_nome || item.titulo || "Publicação em Diário Oficial";
              const cnjMatch = conteudo.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
              const tipoRaw = classifyMovimento(conteudo, titulo);
              const tipo = TIPOS_INTIMACAO.has(tipoRaw) ? tipoRaw : "Publicação";
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
            if (items.length < 50) break; // sem mais páginas
          } catch (err) {
            console.error(`📋 [V1] Erro:`, err);
            break;
          }
        }
      }
      console.log(`📋 [V1] ${v1Count} publicações no Diário Oficial`);
    }

    // ── Estratégia 5: DataJud CNJ — publicações e intimações do DJe ────────────
    // DataJud é a base oficial do CNJ alimentada pelo próprio tribunal.
    // Usamos somente movimentos que correspondem a publicações no DJe
    // ou intimações formais — excluindo atualizações processuais genéricas.
    //
    // Códigos CNJ (TPU) relevantes:
    //   11009 = Publicação no DJe
    //   60    = Citação
    //   106   = Intimação
    //   108   = Notificação
    //   11010 = Intimação por Carta
    //   11012 = Citação por Edital
    // Nomes mapeados em português para match textual quando código não está disponível.
    try {
      const datajudKey = Deno.env.get("DATAJUD_API_KEY")
        ?? "cDZHYzlZa0JadVREZDJCendFbzFob2s6SDJmQnRuMHFmSW0tWXZnWGpYcU1JZw==";

      const tjIndex = `api-publica-tj${oab_uf.toLowerCase()}`;

      // Codigos CNJ de publicação no DJe / intimação / citação / notificação
      const CODIGOS_DJE = new Set([11009, 11010, 11011, 11012, 60, 106, 108, 230]);

      const djBody = {
        query: {
          bool: {
            must: [
              {
                nested: {
                  path: "partes",
                  query: {
                    nested: {
                      path: "partes.advogados",
                      query: {
                        bool: {
                          must: [
                            { term: { "partes.advogados.OABNumero": oab_numero } },
                            { term: { "partes.advogados.OABEstado": oab_uf } },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              // Filtra por processos com movimentos recentes de publicação
              {
                nested: {
                  path: "movimentos",
                  query: {
                    bool: {
                      should: [
                        // Por código CNJ (mais confiável)
                        { terms: { "movimentos.codigo": [...CODIGOS_DJE] } },
                        // Por nome (fallback quando código não corresponde)
                        { match: { "movimentos.nome": "DJe" } },
                        { match: { "movimentos.nome": "publicação" } },
                        { match: { "movimentos.nome": "intimação" } },
                        { match: { "movimentos.nome": "citação" } },
                        { match: { "movimentos.nome": "notificação" } },
                      ],
                      minimum_should_match: 1,
                    },
                  },
                },
              },
              { range: { dataHoraUltimaAtualizacao: { gte: "now-90d" } } },
            ],
          },
        },
        size: 100,
        _source: [
          "numeroProcesso", "movimentos", "classeProcessual",
          "tribunal", "dataHoraUltimaAtualizacao",
        ],
        sort: [{ dataHoraUltimaAtualizacao: { order: "desc" } }],
      };

      const djResp = await fetch(
        `https://api-publica.datajud.cnj.jus.br/${tjIndex}/_search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `ApiKey ${datajudKey}`,
          },
          body: JSON.stringify(djBody),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!djResp.ok) {
        const errTxt = await djResp.text().catch(() => "");
        console.warn(`⚠️ [DataJud] HTTP ${djResp.status}: ${errTxt.slice(0, 200)}`);
      } else {
        const djData = await djResp.json();
        const hits: any[] = djData?.hits?.hits ?? [];
        let djCount = 0;

        console.log(`🔎 [DataJud] ${hits.length} processos encontrados no ${tjIndex}`);

        for (const hit of hits) {
          const proc = hit._source;
          const cnj = (proc.numeroProcesso as string) ?? "";
          const procTribunal = proc.tribunal?.sigla ?? oab_uf;
          const classeNome = proc.classeProcessual?.nome ?? "";

          for (const mov of (proc.movimentos as any[]) ?? []) {
            const movCodigo = Number(mov.codigo ?? 0);
            const movNome = String(mov.nome ?? "").toLowerCase();
            const movData = String(mov.dataHora ?? "").split("T")[0];

            if (movData && movData < CUTOFF) continue;

            // Aceita apenas movimentos de publicação DJe / intimação / citação / notificação
            const isDjeOuIntimacao =
              CODIGOS_DJE.has(movCodigo) ||
              movNome.includes("dje") ||
              movNome.includes("diário") ||
              movNome.includes("diario") ||
              movNome.includes("publicaç") ||
              movNome.includes("publicac") ||
              movNome.includes("intima") ||
              movNome.includes("citaç") ||
              movNome.includes("citac") ||
              movNome.includes("notifica");
            if (!isDjeOuIntimacao) continue;

            // Monta conteúdo com complemento (pode conter texto do DJe)
            const complementos = ((mov.complementosTabelados as any[]) ?? [])
              .map((c: any) => `${c.nome ?? ""}: ${c.valor ?? ""}`.trim())
              .filter(Boolean)
              .join(" | ");
            const conteudo = [mov.nome, complementos].filter(Boolean).join(" — ");
            const tipo = classifyMovimento(conteudo, mov.nome ?? "");

            intimacoes.push(makeItem({
              cnj,
              titulo: classeNome || cnj,
              tribunal: procTribunal,
              tipo: TIPOS_INTIMACAO.has(tipo) ? tipo : "Publicação",
              conteudo,
              dataDisp: movData || null,
              oab_numero,
              oab_uf,
              advogado_id,
              fonte: "datajud_cnj",
              raw: { codigo: mov.codigo, nome: mov.nome, dataHora: mov.dataHora, cnj },
            }));
            djCount++;
          }
        }

        console.log(`📋 [DataJud] ${djCount} pub/intimações | ${hits.length} processos | ${tjIndex}`);
      }
    } catch (e) {
      console.warn("⚠️ [DataJud] Erro:", e);
    }

    // ── Estratégia 6: DJe TJAM direto via ESAJ ──────────────────────────────
    // Acessa o portal público do TJAM para publicações do dia atual e dos 2
    // dias úteis anteriores — cobrindo exatamente o gap do Escavador (≈2-3 dias).
    try {
      // Monta lista dos últimos 3 dias úteis
      const djesForDates: Array<{ iso: string; br: string }> = [];
      for (let d = 0; d <= 5 && djesForDates.length < 3; d++) {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        if (dt.getDay() === 0 || dt.getDay() === 6) continue; // pula fds
        const iso = dt.toISOString().split("T")[0];
        if (iso < CUTOFF) break;
        djesForDates.push({
          iso,
          br: `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`,
        });
      }

      // Termo de busca: primeiros dois nomes do advogado OU OAB
      const djeTerm = advogadoNome
        ? advogadoNome.split(" ").slice(0, 2).join(" ")
        : `OAB/${oab_uf} ${oab_numero}`;

      let djeCount = 0;

      for (const dt of djesForDates) {
        try {
          // URL padrão ESAJ para DJe caderno judicial
          const djeUrl =
            `https://consultasaj.tjam.jus.br/cdjpublico/listaPublicacoesDetalhadas.do` +
            `?cdCaderno=2&dtDiario=${encodeURIComponent(dt.br)}` +
            `&nmAdvogado=${encodeURIComponent(djeTerm)}&nuSeqpagina=1`;

          const djeResp = await fetch(djeUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
              "Accept-Language": "pt-BR,pt;q=0.9",
            },
            signal: AbortSignal.timeout(12000),
          });

          console.log(`🔎 [DJe-TJAM] ${dt.br} → HTTP ${djeResp.status}`);
          if (!djeResp.ok) continue;

          const html = await djeResp.text();

          // Sem resultado — vários textos possíveis
          if (
            html.includes("Nenhuma publicação") ||
            html.includes("nenhum resultado") ||
            html.length < 1000
          ) {
            console.log(`📋 [DJe-TJAM] ${dt.br} sem publicações`);
            continue;
          }

          // Remove tags HTML para trabalhar com texto puro
          const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

          // Encontra CNJ numbers no texto
          const cnjRe = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
          const allCnjs = [...new Set([...text.matchAll(cnjRe)].map(m => m[0]))];
          console.log(`📋 [DJe-TJAM] ${dt.br}: ${allCnjs.length} CNJs encontrados`);

          const seenCnj = new Set<string>();
          for (const cnj of allCnjs) {
            if (seenCnj.has(cnj)) continue;
            seenCnj.add(cnj);

            // Extrai ~2000 chars em torno do CNJ como conteúdo da publicação
            const idx = text.indexOf(cnj);
            const snippet = text.slice(Math.max(0, idx - 200), idx + 2000).trim();
            const tipo = classifyMovimento(snippet, "Publicação");

            intimacoes.push(makeItem({
              cnj,
              titulo: `DJe TJAM ${dt.br}`,
              tribunal: "TJAM",
              tipo: TIPOS_INTIMACAO.has(tipo) ? tipo : "Publicação",
              conteudo: snippet.slice(0, 5000),
              dataDisp: dt.iso,
              oab_numero,
              oab_uf,
              advogado_id,
              fonte: "dje_tjam",
              raw: { date: dt.iso, searchTerm: djeTerm, cnj },
            }));
            djeCount++;
          }
        } catch (err) {
          console.warn(`⚠️ [DJe-TJAM] Erro ${dt.br}:`, err);
        }
      }

      console.log(`📋 [DJe-TJAM] Total: ${djeCount} publicações diretas do DJe`);
    } catch (e) {
      console.warn("⚠️ [DJe-TJAM] Erro geral:", e);
    }

    // ── Estratégia 7: JusBrasil DJe — agrega DJe de todos os tribunais BR ────
    // JusBrasil indexa publicações de praticamente todos os tribunais com
    // latência de horas (muito mais rápido que o Escavador). Acesso público,
    // sem autenticação. Complementa os dados do TJAM com outros tribunais.
    try {
      // Termos de busca: nome completo primeiro, OAB como fallback
      const jbTerms = advogadoNome
        ? [advogadoNome, `OAB/${oab_uf} ${oab_numero}`]
        : [`OAB/${oab_uf} ${oab_numero}`];

      let jbCount = 0;

      for (const term of jbTerms) {
        try {
          const jbUrl =
            `https://www.jusbrasil.com.br/diarios/busca/?` +
            `q=${encodeURIComponent(term)}&periodo=semana`;

          const jbResp = await fetch(jbUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
              "Accept-Language": "pt-BR,pt;q=0.9",
              "Referer": "https://www.jusbrasil.com.br/",
            },
            signal: AbortSignal.timeout(15000),
          });

          console.log(`🔎 [JusBrasil] "${term}" → HTTP ${jbResp.status}`);
          if (!jbResp.ok) continue;

          const html = await jbResp.text();

          // 1) Tenta JSON embutido pelo Next.js (__NEXT_DATA__)
          const nextMatch = html.match(
            /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
          );
          if (nextMatch) {
            try {
              const pageData = JSON.parse(nextMatch[1]);
              const results: any[] =
                pageData?.props?.pageProps?.searchResults ??
                pageData?.props?.pageProps?.results ??
                pageData?.props?.pageProps?.diarios ??
                [];

              for (const item of results) {
                const conteudo = item.texto ?? item.content ?? item.snippet ?? "";
                const titulo =
                  item.titulo ?? item.title ?? item.diario ?? "Publicação JusBrasil";
                const dataRaw =
                  item.data ?? item.date ?? item.dataPublicacao ?? "";
                let dataDisp: string | null = null;
                if (dataRaw) {
                  const d = new Date(dataRaw);
                  if (!isNaN(d.getTime())) dataDisp = d.toISOString().split("T")[0];
                }
                if (dataDisp && dataDisp < CUTOFF) continue;

                const cnjMatch = conteudo.match(
                  /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/
                );
                const tipo = classifyMovimento(conteudo, titulo);

                intimacoes.push(makeItem({
                  cnj: cnjMatch?.[1] ?? "",
                  titulo,
                  tribunal: item.tribunal ?? item.sigla ?? "",
                  tipo: TIPOS_INTIMACAO.has(tipo) ? tipo : "Publicação",
                  conteudo: conteudo.slice(0, 5000),
                  dataDisp,
                  oab_numero, oab_uf, advogado_id,
                  fonte: "jusbrasil",
                  raw: { term, titulo, dataRaw },
                }));
                jbCount++;
              }
            } catch (_) { /* JSON mal-formado — usa fallback HTML */ }
          }

          // 2) Fallback: extrai CNJ diretamente do HTML
          if (jbCount === 0) {
            const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
            const cnjRe = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
            const allCnjs = [...new Set([...text.matchAll(cnjRe)].map(m => m[0]))];

            // Tenta extrair a data mais próxima no texto
            const brDateRe = /(\d{2})\/(\d{2})\/(\d{4})/;
            const brDateMatch = text.match(brDateRe);
            let dataDisp: string | null = null;
            if (brDateMatch) {
              dataDisp = `${brDateMatch[3]}-${brDateMatch[2]}-${brDateMatch[1]}`;
              if (dataDisp < CUTOFF) dataDisp = null;
            }

            const seenCnj = new Set<string>();
            for (const cnj of allCnjs) {
              if (seenCnj.has(cnj)) continue;
              seenCnj.add(cnj);

              const idx = text.indexOf(cnj);
              const snippet = text.slice(Math.max(0, idx - 150), idx + 2000).trim();
              const tipo = classifyMovimento(snippet, "Publicação");

              intimacoes.push(makeItem({
                cnj,
                titulo: "Publicação JusBrasil",
                tribunal: "",
                tipo: TIPOS_INTIMACAO.has(tipo) ? tipo : "Publicação",
                conteudo: snippet.slice(0, 5000),
                dataDisp,
                oab_numero, oab_uf, advogado_id,
                fonte: "jusbrasil",
                raw: { term, cnj },
              }));
              jbCount++;
            }
          }

          // Se encontrou resultados, não repete com o próximo termo
          if (jbCount > 0) break;
        } catch (err) {
          console.warn(`⚠️ [JusBrasil] Erro "${term}":`, err);
        }
      }

      console.log(`📋 [JusBrasil] ${jbCount} publicações encontradas`);
    } catch (e) {
      console.warn("⚠️ [JusBrasil] Erro geral:", e);
    }

    // Contagem de publicações de hoje encontradas pelas APIs
    const todayStr = new Date().toISOString().split("T")[0];
    const foundToday = intimacoes.filter(i => (i.data_disponibilizacao || "").startsWith(todayStr)).length;
    const latestDate = intimacoes
      .map(i => i.data_disponibilizacao || "")
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    console.log(`📌 Total bruto: ${intimacoes.length} itens | ${foundToday} com data_disponibilizacao de hoje (${todayStr}) | mais recente: ${latestDate}`);

    if (intimacoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total: 0, saved: 0, updated: 0, by_strategy: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agrupa por fonte para breakdown no response
    const byStrategyRaw: Record<string, number> = {};
    for (const i of intimacoes) {
      byStrategyRaw[i.fonte] = (byStrategyRaw[i.fonte] || 0) + 1;
    }

    // ── Deduplicação em memória ───────────────────────────────────────────────
    // Limit alto para não perder registros em escritórios com muitas intimações
    const { data: existing } = await supabase
      .from("intimacoes")
      .select("id, processo_cnj, tipo_intimacao, data_disponibilizacao, tribunal, data_publicacao, data_intimacao, conteudo")
      .eq("oab_numero", oab_numero)
      .eq("oab_uf", oab_uf)
      .gte("created_at", new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
      .limit(5000);

    // Itens com CNJ: chave por processo+tipo+data (processo identificado com precisão)
    // Itens sem CNJ (V1/Diário): chave inclui início do conteúdo para distinguir publicações
    // diferentes no mesmo dia da mesma fonte
    const dedupeKey = (item: { processo_cnj?: string | null; tipo_intimacao?: string | null; data_disponibilizacao?: string | null; conteudo?: string | null }) => {
      const date = item.data_disponibilizacao?.slice(0, 10) || "";
      if (item.processo_cnj) return `cnj|${item.processo_cnj}|${item.tipo_intimacao || ""}|${date}`;
      return `nocnj|${item.tipo_intimacao || ""}|${date}|${(item.conteudo || "").slice(0, 200)}`;
    };

    const existingMap = new Map<string, any>();
    for (const e of (existing || [])) {
      existingMap.set(dedupeKey(e), e);
    }

    const toInsert: any[] = [];
    let updatedCount = 0;

    for (const int of intimacoes) {
      const key = dedupeKey(int);
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

    // Breakdown por estratégia no toInsert
    const newByStrategy: Record<string, number> = {};
    for (const i of toInsert) {
      newByStrategy[i.fonte] = (newByStrategy[i.fonte] || 0) + 1;
    }

    console.log(`✅ ${savedCount} novas | ${updatedCount} atualizadas | hoje=${foundToday} | por fonte:`, JSON.stringify(byStrategyRaw));

    return new Response(
      JSON.stringify({
        success: true,
        total: intimacoes.length,
        saved: savedCount,
        updated: updatedCount,
        found_today: foundToday,
        today_date: todayStr,
        latest_date: latestDate,
        by_strategy: byStrategyRaw,
        new_by_strategy: newByStrategy,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
