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

async function resolveOfficeOab() {
  const { data, error } = await supabase
    .from("office_settings")
    .select("oab_number, oab_state")
    .limit(1)
    .single();

  if (error || !data?.oab_number) {
    throw new Error("OAB não configurada no escritório");
  }

  return {
    oabNumero: data.oab_number,
    oabUf: data.oab_state || "AM",
  };
}

async function triggerWorker() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/intimacoes-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: "intimacoes-scheduler" }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.warn(`⚠️ [Intimações Scheduler] Worker retornou ${response.status}: ${errorText}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("⏰ [Intimações Scheduler] Recebida solicitação de sincronização");

    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    let oabNumero = typeof body.oab_numero === "string" ? body.oab_numero : "";
    let oabUf = typeof body.oab_uf === "string" ? body.oab_uf : "";
    const advogadoId = typeof body.advogado_id === "string" ? body.advogado_id : null;
    const triggerSource = req.method === "GET" ? "cron" : "manual";

    if (!oabNumero || !oabUf) {
      const officeOab = await resolveOfficeOab();
      oabNumero = oabNumero || officeOab.oabNumero;
      oabUf = oabUf || officeOab.oabUf;
    }

    if (!oabNumero || !oabUf) {
      return jsonResponse({ success: false, error: "oab_numero e oab_uf são obrigatórios" }, 400);
    }

    const { data: existingJob, error: existingJobError } = await supabase
      .from("intimacoes_sync_jobs")
      .select("id, status, attempts, max_attempts, run_after")
      .eq("job_type", "fetch_intimacoes")
      .eq("oab_numero", oabNumero)
      .eq("oab_uf", oabUf)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJobError) {
      throw existingJobError;
    }

    if (existingJob) {
      console.log(`ℹ️ [Intimações Scheduler] Job já existente: ${existingJob.id} (${existingJob.status})`);
      runInBackground(triggerWorker());

      return jsonResponse({
        success: true,
        queued: true,
        deduplicated: true,
        jobId: existingJob.id,
        status: existingJob.status,
        message: "Já existe uma sincronização pendente ou em processamento para esta OAB.",
      });
    }

    const payload = {
      requested_at: new Date().toISOString(),
      source: triggerSource,
      requested_by: advogadoId,
    };

    const { data: job, error: insertError } = await supabase
      .from("intimacoes_sync_jobs")
      .insert({
        job_type: "fetch_intimacoes",
        status: "pending",
        trigger_source: triggerSource,
        oab_numero: oabNumero,
        oab_uf: oabUf,
        advogado_id: advogadoId,
        payload,
      })
      .select("id, status, created_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ [Intimações Scheduler] Job enfileirado: ${job.id}`);
    runInBackground(triggerWorker());

    return jsonResponse(
      {
        success: true,
        queued: true,
        jobId: job.id,
        status: job.status,
        message: "Sincronização enfileirada com sucesso.",
      },
      202,
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ [Intimações Scheduler] Erro:", msg);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
