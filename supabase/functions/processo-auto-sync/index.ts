import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SyncResult {
  processoId: string;
  cnj: string;
  success: boolean;
  movimentacoesNovas: number;
  skipped?: boolean;
  error?: string;
}

// Priority-based sync intervals (in hours)
const SYNC_INTERVALS: Record<string, number> = {
  "Em Andamento": 72,
  "Suspenso": 72,
  "Arquivado": 720,
  "Ganho": 720,
  "Perdido": 720,
};

// ✅ FIX 1 — Status "Ganho" e "Perdido" definidos manualmente NÃO são sobrescritos.
// O mapStatus() agora só é chamado para status não-manuais.
// A lista de status protegidos é definida aqui e verificada antes do update.
const STATUS_MANUAIS_PROTEGIDOS = new Set(["Ganho", "Perdido"]);

function mapStatus(apiStatus: string): string {
  if (!apiStatus) return "Em Andamento";
  const s = apiStatus.toLowerCase().trim();

  if (s === "ativo" || s === "em andamento") return "Em Andamento";
  if (s === "inativo" || s === "baixado" || s === "arquivado" || s === "transitado em julgado") return "Arquivado";
  if (s === "suspenso") return "Suspenso";

  const statusMap: Record<string, string> = {
    "com sentença": "Em Andamento",
    "em grau recursal": "Em Andamento",
    // Nota: Escavador não retorna "ganho"/"perdido" — esses são definidos manualmente
    // e protegidos pelo guard STATUS_MANUAIS_PROTEGIDOS abaixo.
  };
  return statusMap[s] || "Em Andamento";
}

// ✅ FIX 2 — data_distribuicao e data_ajuizamento agora têm fontes distintas.
// parseDataBR e parseDataISO permanecem iguais.
function parseDataBR(dataBR: string): string {
  const match = dataBR.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}T00:00:00Z`;
  return new Date().toISOString();
}

function parseDataISO(val: string): string | null {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return val.slice(0, 10);
  const ptBr = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ptBr) return `${ptBr[3]}-${ptBr[2]}-${ptBr[1]}`;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* ignore */ }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const forceAll = body.force_all || false;
    const processoId = body.processo_id;
    const maxProcessos = body.max || 20;

    console.log(`🔄 [Auto-Sync] Iniciando... force_all=${forceAll}, max=${maxProcessos}`);

    const ESCAVADOR_API_KEY = Deno.env.get("ESCAVADOR_API_KEY");
    if (!ESCAVADOR_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "ESCAVADOR_API_KEY não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase
      .from("processos")
      .select("id, numero_processo, cliente_id, titulo_acao, status, ultima_consulta_api_at, sync_priority, sync_error_count, notificacao_ativa")
      .not("numero_processo", "is", null);

    if (processoId) query = query.eq("id", processoId);

    const { data: allProcessos, error: fetchError } = await query
      .order("ultima_consulta_api_at", { ascending: true, nullsFirst: true })
      .order("status", { ascending: true })
      .limit(500);

    if (fetchError) throw new Error(`Erro ao buscar processos: ${fetchError.message}`);

    if (!allProcessos || allProcessos.length === 0) {
      console.log("📭 Nenhum processo encontrado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum processo para atualizar", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = Date.now();
    const needsSync = forceAll || processoId
      ? allProcessos
      : allProcessos.filter((p) => {
          const status = p.status || "Em Andamento";
          const intervalHours = SYNC_INTERVALS[status] || 24;
          const thresholdMs = intervalHours * 60 * 60 * 1000;
          if (!p.ultima_consulta_api_at) return true;
          const lastSync = new Date(p.ultima_consulta_api_at).getTime();
          if ((p.sync_error_count || 0) >= 5) {
            console.log(`⏭️ Skipping ${p.numero_processo} (${p.sync_error_count} errors)`);
            return false;
          }
          return (now - lastSync) > thresholdMs;
        });

    const processos = needsSync.slice(0, maxProcessos);

    console.log(`📋 ${allProcessos.length} total → ${needsSync.length} precisam sync → ${processos.length} serão atualizados`);

    if (processos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os processos estão atualizados", synced: 0, total: allProcessos.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: SyncResult[] = [];

    for (const processo of processos) {
      try {
        console.log(`🔍 Sincronizando: ${processo.numero_processo} (${processo.status})`);

        let hasUpdates = true;

        if (!forceAll && processo.ultima_consulta_api_at) {
          try {
            const statusResp = await fetch(
              `https://api.escavador.com/api/v2/processos/numero_cnj/${encodeURIComponent(processo.numero_processo)}/status-atualizacao`,
              {
                headers: {
                  Authorization: `Bearer ${ESCAVADOR_API_KEY}`,
                  "X-Requested-With": "XMLHttpRequest",
                },
              }
            );

            if (statusResp.ok) {
              const statusData = await statusResp.json();
              if (statusData.status === "ATUALIZADO") {
                const updatedAt = statusData.ultima_atualizacao ? new Date(statusData.ultima_atualizacao).getTime() : 0;
                const lastSync = new Date(processo.ultima_consulta_api_at).getTime();
                if (updatedAt <= lastSync) {
                  hasUpdates = false;
                  console.log(`⏭️ ${processo.numero_processo} - sem atualizações desde último sync`);
                }
              }
            } else if (statusResp.status === 402) {
              console.error("💳 Créditos Escavador insuficientes! Abortando sync.");
              results.push({ processoId: processo.id, cnj: processo.numero_processo, success: false, movimentacoesNovas: 0, error: "Créditos insuficientes" });
              break;
            }
          } catch (e) {
            console.log(`⚠️ Erro ao verificar status, prosseguindo com fetch completo`);
          }
        }

        if (!hasUpdates) {
          await supabase
            .from("processos")
            .update({ ultima_consulta_api_at: new Date().toISOString(), sync_error_count: 0 })
            .eq("id", processo.id);

          results.push({ processoId: processo.id, cnj: processo.numero_processo, success: true, movimentacoesNovas: 0, skipped: true });
          continue;
        }

        const consultaResponse = await fetch(`${SUPABASE_URL}/functions/v1/consulta-processos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            numeroProcesso: processo.numero_processo,
            force_refresh: true,
            persistir: true,
          }),
        });

        if (consultaResponse.status === 402) {
          console.error("💳 Créditos insuficientes! Parando sync.");
          break;
        }

        const consultaData = await consultaResponse.json();

        if (consultaData.success && consultaData.encontrado) {
          const proc = consultaData.processo;

          const oldMovCount = (await supabase
            .from("processos")
            .select("movimentos_json")
            .eq("id", processo.id)
            .single()).data?.movimentos_json?.length || 0;

          // ✅ FIX 1 — Proteger status "Ganho" e "Perdido" definidos manualmente.
          // Se o status atual é manual (Ganho/Perdido), preserva — não sobrescreve.
          const statusAtual = processo.status;
          const statusDoSync = mapStatus(proc.status);
          const statusFinal = STATUS_MANUAIS_PROTEGIDOS.has(statusAtual)
            ? statusAtual
            : statusDoSync;

          if (STATUS_MANUAIS_PROTEGIDOS.has(statusAtual) && statusAtual !== statusDoSync) {
            console.log(`🛡️ Status protegido para ${processo.numero_processo}: mantendo "${statusAtual}" (sync retornou "${statusDoSync}")`);
          }

          const updateData: Record<string, unknown> = {
            titulo_acao:              proc.classe || processo.titulo_acao,
            status:                   statusFinal,  // ← usa status protegido
            tribunal:                 proc.tribunal,
            orgao_julgador:           proc.orgaoJulgador,
            grau:                     proc.grau,
            assunto:                  proc.assuntos?.[0]?.nome,
            valor_causa:              proc.valorCausa,
            partes_json:              proc.partes || [],

            // ✅ FIX 3 — movimentos_json sem slice extra (já limitado a 100 no consulta-processos)
            movimentos_json:          proc.movimentos || [],

            dados_datajud:            proc.fonteRaw,
            fonte_preferida:          proc.fonte,
            data_ultima_atualizacao:  proc.ultimaAtualizacao !== "Não informado"
                                        ? parseDataBR(proc.ultimaAtualizacao)
                                        : new Date().toISOString(),
            ultima_consulta_api_at:   new Date().toISOString(),
            updated_at:               new Date().toISOString(),
            sync_error_count:         0,
            last_sync_error:          null,

            classe_cnj:               proc.classe || null,
            assunto_cnj:              proc.assuntos?.[0]?.codigo?.toString() || proc.assuntos?.[0]?.nome || null,
            vara_comarca:             proc.orgaoJulgador || null,
            status_detalhado:         proc.statusDetalhado || null,
            segredo_justica:          proc.nivelSigilo === "Segredo de Justiça",
            sistema_judicial:         proc.sistemaProcessual || null,
            tipo_orgao_julgador:      proc.orgaoJulgador || null,

            // ✅ FIX 2 — data_ajuizamento e data_distribuicao com fontes distintas
            data_ajuizamento:         proc.dataAjuizamento    ? parseDataISO(proc.dataAjuizamento)    : null,
            data_distribuicao:        proc.dataDistribuicao   ? parseDataISO(proc.dataDistribuicao)
                                      : proc.dataAjuizamento  ? parseDataISO(proc.dataAjuizamento)    : null,
          };

          // Auto-populate nome_cliente das partes se estiver vazio
          if (proc.partes && Array.isArray(proc.partes)) {
            const parteAutor = proc.partes.find((p: any) =>
              p.tipo === "Autor" || p.polo?.toUpperCase() === "AT" || p.polo?.toUpperCase() === "PA"
            );
            if (parteAutor?.nome) {
              const { data: current } = await supabase
                .from("processos")
                .select("nome_cliente")
                .eq("id", processo.id)
                .single();
              if (!current?.nome_cliente) {
                updateData.nome_cliente = parteAutor.nome.toUpperCase();
              }
              if (parteAutor.documento) {
                const cpfDigits = (parteAutor.documento || "").replace(/\D/g, "");
                if (cpfDigits.length >= 11) updateData.cpf_cliente = cpfDigits;
              }
            }
          }

          await supabase.from("processos").update(updateData).eq("id", processo.id);

          const newMovCount = (proc.movimentos || []).length;
          const movimentacoesNovas = Math.max(0, newMovCount - oldMovCount);

          if (processo.cliente_id && processo.notificacao_ativa) {
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/processo-status-notify`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  processoId: processo.id,
                  tipo: movimentacoesNovas > 0 ? "movimento" : "status_update",
                }),
              });
              console.log(`📱 Notificação enviada para processo ${processo.numero_processo} (${movimentacoesNovas} novas movs)`);
            } catch (notifyErr) {
              console.error(`⚠️ Falha ao notificar:`, notifyErr);
            }
          }

          results.push({ processoId: processo.id, cnj: processo.numero_processo, success: true, movimentacoesNovas });
          console.log(`✅ ${processo.numero_processo} atualizado (+${movimentacoesNovas} movs, status=${statusFinal})`);
        } else {
          await supabase
            .from("processos")
            .update({
              sync_error_count: (processo.sync_error_count || 0) + 1,
              last_sync_error: consultaData.error || "Não encontrado",
              ultima_consulta_api_at: new Date().toISOString(),
            })
            .eq("id", processo.id);

          results.push({ processoId: processo.id, cnj: processo.numero_processo, success: false, movimentacoesNovas: 0, error: consultaData.error || "Não encontrado" });
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`❌ Erro no processo ${processo.numero_processo}:`, errorMessage);

        await supabase
          .from("processos")
          .update({
            sync_error_count: (processo.sync_error_count || 0) + 1,
            last_sync_error: errorMessage,
          })
          .eq("id", processo.id);

        results.push({ processoId: processo.id, cnj: processo.numero_processo, success: false, movimentacoesNovas: 0, error: errorMessage });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    const totalMovimentacoes = results.reduce((sum, r) => sum + r.movimentacoesNovas, 0);

    console.log(`📊 Sync completo: ${successful} sucesso (${skipped} pulados), ${failed} falhas, ${totalMovimentacoes} novas movimentações`);

    return new Response(
      JSON.stringify({ success: true, synced: successful, skipped, failed, totalMovimentacoes, creditsSaved: skipped, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ Erro geral no auto-sync:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
