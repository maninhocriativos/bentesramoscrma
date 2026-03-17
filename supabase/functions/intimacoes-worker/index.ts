import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function runInBackground(promise: Promise<unknown>) {
  if (edgeRuntime.EdgeRuntime?.waitUntil) {
    edgeRuntime.EdgeRuntime.waitUntil(promise);
    return;
  }

  void promise;
}

function getRetryRunAfter(attempts: number) {
  const backoffMinutes = Math.min(60, Math.max(5, attempts * 10));
  return new Date(Date.now() + backoffMinutes * 60_000).toISOString();
}

async function triggerNextWorkerPass() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/intimacoes-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "worker-drain" }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.warn(`⚠️ [Intimações Worker] Novo ciclo falhou: ${response.status} - ${errorText}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data: claimedRows, error: claimError } = await supabase.rpc("claim_next_intimacoes_sync_job");

    if (claimError) {
      throw claimError;
    }

    const job = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;

    if (!job) {
      return jsonResponse({ success: true, message: "Nenhum job pendente para processar." });
    }

    console.log(
      `🚀 [Intimações Worker] Processando job ${job.id} para OAB/${job.oab_uf} ${job.oab_numero} (tentativa ${job.attempts}/${job.max_attempts})`,
    );

    const response = await fetch(`${SUPABASE_URL}/functions/v1/intimacoes-oab`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oab_numero: job.oab_numero,
        oab_uf: job.oab_uf,
        advogado_id: job.advogado_id,
        job_id: job.id,
        trigger_source: job.trigger_source,
      }),
    });

    const rawBody = await response.text();
    let result: Record<string, unknown> = {};

    try {
      result = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      result = { rawBody };
    }

    if (!response.ok || !result?.success) {
      const errorMessage =
        (typeof result?.error === "string" && result.error) ||
        rawBody ||
        `Falha ao executar intimacoes-oab (${response.status})`;

      const shouldRetry = job.attempts < job.max_attempts;
      const nextRunAfter = shouldRetry ? getRetryRunAfter(job.attempts) : null;

      const { error: updateError } = await supabase
        .from("intimacoes_sync_jobs")
        .update({
          status: shouldRetry ? "pending" : "failed",
          run_after: nextRunAfter,
          completed_at: shouldRetry ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: errorMessage.slice(0, 1000),
          result_summary: { error: errorMessage, response_status: response.status },
        })
        .eq("id", job.id);

      if (updateError) {
        throw updateError;
      }

      console.error(`❌ [Intimações Worker] Job ${job.id} falhou: ${errorMessage}`);

      return jsonResponse(
        {
          success: false,
          jobId: job.id,
          status: shouldRetry ? "pending" : "failed",
          retryScheduledFor: nextRunAfter,
          error: errorMessage,
        },
        response.ok ? 500 : response.status,
      );
    }

    const { error: completeError } = await supabase
      .from("intimacoes_sync_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
        result_summary: result,
      })
      .eq("id", job.id);

    if (completeError) {
      throw completeError;
    }

    runInBackground(triggerNextWorkerPass());

    return jsonResponse({
      success: true,
      jobId: job.id,
      status: "completed",
      result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ [Intimações Worker] Erro:", msg);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
