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

interface OabCredential {
  oabNumero: string;
  oabUf: string;
  advogadoId: string | null;
}

/** Resolve all OAB credentials: office + each advogado with OAB in perfis */
async function resolveAllOabs(): Promise<OabCredential[]> {
  const credentials: OabCredential[] = [];
  const seen = new Set<string>();

  // 1. Office-level OAB
  const { data: office } = await supabase
    .from("office_settings")
    .select("oab_number, oab_state")
    .limit(1)
    .single();

  if (office?.oab_number) {
    const key = `${office.oab_number}-${office.oab_state || "AM"}`;
    if (!seen.has(key)) {
      seen.add(key);
      credentials.push({
        oabNumero: office.oab_number,
        oabUf: office.oab_state || "AM",
        advogadoId: null,
      });
    }
  }

  // 2. Advogados (cargo = 'Advogado') com OAB configurado — exclui Secretaria/Administrador
  const { data: advogados } = await supabase
    .from("perfis")
    .select("id, oab_numero, oab_uf")
    .eq("cargo", "Advogado")
    .not("oab_numero", "is", null)
    .neq("oab_numero", "");

  if (advogados) {
    for (const adv of advogados) {
      const uf = adv.oab_uf || "AM";
      const key = `${adv.oab_numero}-${uf}`;
      if (!seen.has(key)) {
        seen.add(key);
        credentials.push({
          oabNumero: adv.oab_numero,
          oabUf: uf,
          advogadoId: adv.id,
        });
      }
    }
  }

  return credentials;
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

    const manualOab = typeof body.oab_numero === "string" ? body.oab_numero : "";
    const manualUf = typeof body.oab_uf === "string" ? body.oab_uf : "";
    const manualAdvId = typeof body.advogado_id === "string" ? body.advogado_id : null;
    const triggerSource = typeof body.source === "string" ? body.source : (req.method === "GET" ? "cron" : "manual");

    // If manual call with specific OAB, process only that one
    let oabs: OabCredential[];
    if (manualOab && manualUf) {
      oabs = [{ oabNumero: manualOab, oabUf: manualUf, advogadoId: manualAdvId }];
    } else {
      // Cron or no specific OAB: iterate ALL advogados
      oabs = await resolveAllOabs();
    }

    if (oabs.length === 0) {
      return jsonResponse({ success: false, error: "Nenhuma OAB configurada no sistema" }, 400);
    }

    console.log(`📋 [Intimações Scheduler] ${oabs.length} OAB(s) para sincronizar`);

    const results: Array<{ oab: string; uf: string; jobId?: string; status: string; deduplicated?: boolean }> = [];

    // Só deduplica jobs criados nos últimos 20 minutos — jobs mais antigos são considerados travados
    const deduplicationWindow = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    for (const cred of oabs) {
      // Check for existing pending/processing job (dentro da janela de 20 min)
      const { data: existingJob } = await supabase
        .from("intimacoes_sync_jobs")
        .select("id, status")
        .eq("job_type", "fetch_intimacoes")
        .eq("oab_numero", cred.oabNumero)
        .eq("oab_uf", cred.oabUf)
        .in("status", ["pending", "processing"])
        .gte("created_at", deduplicationWindow)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingJob) {
        console.log(`ℹ️ Job existente para OAB/${cred.oabUf} ${cred.oabNumero}: ${existingJob.id}`);
        results.push({ oab: cred.oabNumero, uf: cred.oabUf, jobId: existingJob.id, status: existingJob.status, deduplicated: true });
        continue;
      }

      const { data: job, error: insertError } = await supabase
        .from("intimacoes_sync_jobs")
        .insert({
          job_type: "fetch_intimacoes",
          status: "pending",
          trigger_source: triggerSource,
          oab_numero: cred.oabNumero,
          oab_uf: cred.oabUf,
          advogado_id: cred.advogadoId,
          payload: {
            requested_at: new Date().toISOString(),
            source: triggerSource,
            requested_by: cred.advogadoId,
          },
        })
        .select("id, status")
        .single();

      if (insertError) {
        console.error(`❌ Erro ao criar job para OAB/${cred.oabUf} ${cred.oabNumero}:`, insertError.message);
        results.push({ oab: cred.oabNumero, uf: cred.oabUf, status: "error" });
        continue;
      }

      console.log(`✅ Job enfileirado para OAB/${cred.oabUf} ${cred.oabNumero}: ${job.id}`);
      results.push({ oab: cred.oabNumero, uf: cred.oabUf, jobId: job.id, status: job.status });
    }

    // Trigger worker to start processing
    runInBackground(triggerWorker());

    const queued = results.filter(r => r.status === "pending").length;
    const deduplicated = results.filter(r => r.deduplicated).length;

    return jsonResponse({
      success: true,
      total_oabs: oabs.length,
      queued,
      deduplicated,
      results,
      message: `${queued} job(s) enfileirado(s), ${deduplicated} já em processamento.`,
    }, 202);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ [Intimações Scheduler] Erro:", msg);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
