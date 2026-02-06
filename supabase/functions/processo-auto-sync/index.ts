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
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const forceAll = body.force_all || false;
    const processoId = body.processo_id;

    console.log(`🔄 [Auto-Sync] Iniciando... force_all=${forceAll}, processo_id=${processoId || 'todos'}`);

    // Buscar processos que precisam de atualização (última consulta > 24h)
    let query = supabase
      .from("processos")
      .select("id, numero_processo, cnj_normalizado, cliente_id, titulo_acao, status")
      .eq("notificacao_ativa", true)
      .not("numero_processo", "is", null);

    if (processoId) {
      query = query.eq("id", processoId);
    } else if (!forceAll) {
      // Processos que não foram consultados nas últimas 24h
      const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`ultima_consulta_api_at.is.null,ultima_consulta_api_at.lt.${threshold}`);
    }

    const { data: processos, error: fetchError } = await query.limit(50);

    if (fetchError) {
      throw new Error(`Erro ao buscar processos: ${fetchError.message}`);
    }

    if (!processos || processos.length === 0) {
      console.log("📭 Nenhum processo precisa de atualização");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum processo para atualizar", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 ${processos.length} processo(s) para sincronizar`);

    const results: SyncResult[] = [];

    for (const processo of processos) {
      try {
        console.log(`🔍 Sincronizando: ${processo.numero_processo}`);

        // Chamar a edge function de consulta com force_refresh e persistir
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

        const consultaData = await consultaResponse.json();

        if (consultaData.success && consultaData.encontrado) {
          const proc = consultaData.processo;

          // Atualizar processo com dados completos
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
          };

          const { error: updateError } = await supabase
            .from("processos")
            .update(updateData)
            .eq("id", processo.id);

          if (updateError) {
            throw new Error(`Erro ao atualizar: ${updateError.message}`);
          }

          results.push({
            processoId: processo.id,
            cnj: processo.numero_processo,
            success: true,
            movimentacoesNovas: consultaData.movimentacoesNovas || 0,
          });

          console.log(`✅ ${processo.numero_processo} atualizado com ${(proc.movimentos || []).length} movimentações`);
        } else {
          results.push({
            processoId: processo.id,
            cnj: processo.numero_processo,
            success: false,
            movimentacoesNovas: 0,
            error: consultaData.error || "Não encontrado",
          });
        }

        // Rate limiting entre requisições
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`❌ Erro no processo ${processo.numero_processo}:`, errorMessage);
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
    const failed = results.filter((r) => !r.success).length;
    const totalMovimentacoes = results.reduce((sum, r) => sum + r.movimentacoesNovas, 0);

    console.log(`📊 Sync completo: ${successful} sucesso, ${failed} falhas, ${totalMovimentacoes} movimentações`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successful,
        failed,
        totalMovimentacoes,
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
  // Converte DD/MM/YYYY para ISO
  const match = dataBR.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}T00:00:00Z`;
  }
  return new Date().toISOString();
}
