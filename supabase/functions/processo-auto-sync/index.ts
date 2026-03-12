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
  "Em Andamento": 24,    // Daily
  "Suspenso": 168,       // Weekly (7 days)
  "Arquivado": 720,      // Monthly (30 days)
  "Ganho": 720,          // Monthly
  "Perdido": 720,        // Monthly
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const forceAll = body.force_all || false;
    const processoId = body.processo_id;
    const maxProcessos = body.max || 20; // Limit per run to save credits

    console.log(`🔄 [Auto-Sync] Iniciando... force_all=${forceAll}, max=${maxProcessos}`);

    // Step 1: Check Escavador credit status first (avoid wasting calls)
    const ESCAVADOR_API_KEY = Deno.env.get("ESCAVADOR_API_KEY");
    if (!ESCAVADOR_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "ESCAVADOR_API_KEY não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Build query with priority-based filtering
    let query = supabase
      .from("processos")
      .select("id, numero_processo, cliente_id, titulo_acao, status, ultima_consulta_api_at, sync_priority, sync_error_count, notificacao_ativa")
      .not("numero_processo", "is", null);

    if (processoId) {
      query = query.eq("id", processoId);
    } else if (!forceAll) {
      // Only get processes that need sync based on their status priority
      query = query.eq("notificacao_ativa", true);
    }

    const { data: allProcessos, error: fetchError } = await query
      .order("status", { ascending: true }) // Em Andamento first
      .order("ultima_consulta_api_at", { ascending: true, nullsFirst: true })
      .limit(100);

    if (fetchError) {
      throw new Error(`Erro ao buscar processos: ${fetchError.message}`);
    }

    if (!allProcessos || allProcessos.length === 0) {
      console.log("📭 Nenhum processo encontrado");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum processo para atualizar", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Filter by priority interval (skip recently synced)
    const now = Date.now();
    const needsSync = forceAll || processoId
      ? allProcessos
      : allProcessos.filter((p) => {
          const status = p.status || "Em Andamento";
          const intervalHours = SYNC_INTERVALS[status] || 24;
          const thresholdMs = intervalHours * 60 * 60 * 1000;

          if (!p.ultima_consulta_api_at) return true; // Never synced
          
          const lastSync = new Date(p.ultima_consulta_api_at).getTime();
          const shouldSync = (now - lastSync) > thresholdMs;
          
          // Skip processes with too many consecutive errors
          if ((p.sync_error_count || 0) >= 5) {
            console.log(`⏭️ Skipping ${p.numero_processo} (${p.sync_error_count} errors)`);
            return false;
          }

          return shouldSync;
        });

    // Step 4: Limit to maxProcessos to save credits
    const processos = needsSync.slice(0, maxProcessos);

    console.log(`📋 ${allProcessos.length} total → ${needsSync.length} precisam sync → ${processos.length} serão atualizados`);

    if (processos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos os processos estão atualizados", synced: 0, total: allProcessos.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: SyncResult[] = [];

    // Step 5: Use Escavador status-atualizacao endpoint first (cheaper - checks if there are updates)
    for (const processo of processos) {
      try {
        console.log(`🔍 Sincronizando: ${processo.numero_processo} (${processo.status})`);

        // Check if update exists before doing full fetch (saves credits)
        let hasUpdates = true; // Default: assume updates exist
        
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
              // If status is ATUALIZADO and last update is before our last sync, skip
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
              results.push({
                processoId: processo.id,
                cnj: processo.numero_processo,
                success: false,
                movimentacoesNovas: 0,
                error: "Créditos insuficientes",
              });
              break; // Stop all syncs
            }
          } catch (e) {
            console.log(`⚠️ Erro ao verificar status, prosseguindo com fetch completo`);
          }
        }

        if (!hasUpdates) {
          // Update timestamp without consuming full fetch credits
          await supabase
            .from("processos")
            .update({
              ultima_consulta_api_at: new Date().toISOString(),
              sync_error_count: 0,
            })
            .eq("id", processo.id);

          results.push({
            processoId: processo.id,
            cnj: processo.numero_processo,
            success: true,
            movimentacoesNovas: 0,
            skipped: true,
          });
          continue;
        }

        // Full fetch via consulta-processos
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

          const updateData: Record<string, unknown> = {
            titulo_acao: proc.classe || processo.titulo_acao,
            status: mapStatus(proc.status),
            tribunal: proc.tribunal,
            orgao_julgador: proc.orgaoJulgador,
            grau: proc.grau,
            assunto: proc.assuntos?.[0]?.nome,
            valor_causa: proc.valorCausa,
            partes_json: proc.partes || [],
            movimentos_json: (proc.movimentos || []).slice(0, 50),
            dados_datajud: proc.fonteRaw,
            fonte_preferida: proc.fonte,
            data_ultima_atualizacao: proc.ultimaAtualizacao !== "Não informado"
              ? parseDataBR(proc.ultimaAtualizacao)
              : new Date().toISOString(),
            ultima_consulta_api_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sync_error_count: 0,
            last_sync_error: null,
          };

          await supabase.from("processos").update(updateData).eq("id", processo.id);

          const newMovCount = (proc.movimentos || []).length;
          const movimentacoesNovas = Math.max(0, newMovCount - oldMovCount);

          // If there are new movimentações and client has WhatsApp, notify via ISA
          if (movimentacoesNovas > 0 && processo.cliente_id && processo.notificacao_ativa) {
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/processo-status-notify`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  processoId: processo.id,
                  tipo: "movimento",
                }),
              });
              console.log(`📱 Notificação enviada para cliente do processo ${processo.numero_processo}`);
            } catch (notifyErr) {
              console.error(`⚠️ Falha ao notificar:`, notifyErr);
            }
          }

          results.push({
            processoId: processo.id,
            cnj: processo.numero_processo,
            success: true,
            movimentacoesNovas,
          });

          console.log(`✅ ${processo.numero_processo} atualizado (+${movimentacoesNovas} movs)`);
        } else {
          await supabase
            .from("processos")
            .update({
              sync_error_count: (processo.sync_error_count || 0) + 1,
              last_sync_error: consultaData.error || "Não encontrado",
              ultima_consulta_api_at: new Date().toISOString(),
            })
            .eq("id", processo.id);

          results.push({
            processoId: processo.id,
            cnj: processo.numero_processo,
            success: false,
            movimentacoesNovas: 0,
            error: consultaData.error || "Não encontrado",
          });
        }

        // Rate limiting - 1.5s between requests
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

        results.push({
          processoId: processo.id,
          cnj: processo.numero_processo,
          success: false,
          movimentacoesNovas: 0,
          error: errorMessage,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    const totalMovimentacoes = results.reduce((sum, r) => sum + r.movimentacoesNovas, 0);

    console.log(`📊 Sync completo: ${successful} sucesso (${skipped} pulados), ${failed} falhas, ${totalMovimentacoes} novas movimentações`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successful,
        skipped,
        failed,
        totalMovimentacoes,
        creditsSaved: skipped, // Quantos créditos economizados
        results,
      }),
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

function mapStatus(apiStatus: string): string {
  const statusMap: Record<string, string> = {
    "Em Andamento": "Em Andamento",
    Arquivado: "Arquivado",
    Suspenso: "Suspenso",
    "Transitado em Julgado": "Arquivado",
    "Com Sentença": "Em Andamento",
    "Em Grau Recursal": "Em Andamento",
  };
  return statusMap[apiStatus] || "Em Andamento";
}

function parseDataBR(dataBR: string): string {
  const match = dataBR.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}T00:00:00Z`;
  }
  return new Date().toISOString();
}
