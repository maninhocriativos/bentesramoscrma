import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BackfillRequest = {
  limit?: number;
  dryRun?: boolean;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

const getOrigemFromCanal = (canal?: string | null) => {
  const c = (canal || "").toLowerCase();
  if (c === "instagram") return "Instagram";
  if (c === "facebook") return "Facebook";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "telegram") return "Telegram";
  return "ManyChat";
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ status: "error", error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: BackfillRequest = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(body.limit ?? 200, 1000));
    const dryRun = !!body.dryRun;

    const { data: subs, error: subsError } = await supabase
      .from("manychat_subscribers")
      .select("id, subscriber_id, nome, telefone, email, canal, lead_id, created_at")
      .is("lead_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (subsError) throw subsError;

    const results: any[] = [];
    let linkedExisting = 0;
    let created = 0;
    let skipped = 0;
    let errored = 0;

    for (const sub of subs ?? []) {
      try {
        const subscriberId = sub.subscriber_id as string;
        const canal = sub.canal as string | null;
        const origem = getOrigemFromCanal(canal);

        // 1) tentar linkar por telefone/email/nome
        let leadId: string | null = null;

        if (sub.telefone) {
          const telLimpo = normalizePhone(sub.telefone as string);
          const { data: leadByPhone } = await supabase
            .from("leads_juridicos")
            .select("id, nome")
            .or(`telefone.ilike.%${telLimpo.slice(-9)}%,telefone.ilike.%${telLimpo}%`)
            .limit(1)
            .maybeSingle();

          if (leadByPhone?.id) leadId = leadByPhone.id;
        }

        if (!leadId && sub.email) {
          const { data: leadByEmail } = await supabase
            .from("leads_juridicos")
            .select("id, nome")
            .ilike("email", sub.email as string)
            .limit(1)
            .maybeSingle();

          if (leadByEmail?.id) leadId = leadByEmail.id;
        }

        if (!leadId && sub.nome && sub.nome !== "Desconhecido") {
          const { data: leadByName } = await supabase
            .from("leads_juridicos")
            .select("id, nome")
            .ilike("nome", `%${sub.nome}%`)
            .limit(1)
            .maybeSingle();

          if (leadByName?.id) leadId = leadByName.id;
        }

        // 2) se achou lead existente, apenas vincular
        if (leadId) {
          if (!dryRun) {
            await supabase
              .from("manychat_subscribers")
              .update({ lead_id: leadId, updated_at: new Date().toISOString() })
              .eq("id", sub.id);
          }

          linkedExisting++;
          results.push({ subscriber_id: subscriberId, action: "linked_existing", lead_id: leadId });
          continue;
        }

        // 3) criar lead fallback
        const nomeDoLead =
          sub.nome && sub.nome !== "Desconhecido"
            ? (sub.nome as string)
            : sub.telefone
              ? `Contato ${sub.telefone}`
              : `Contato ${origem} #${subscriberId}`;

        if (dryRun) {
          skipped++;
          results.push({ subscriber_id: subscriberId, action: "dry_run_create", nome: nomeDoLead });
          continue;
        }

        const { data: newLead, error: leadError } = await supabase
          .from("leads_juridicos")
          .insert({
            nome: nomeDoLead,
            telefone: (sub.telefone as string | null) ?? null,
            email: (sub.email as string | null) ?? null,
            status: "Lead Frio",
            origem,
            resumo_ia: `Lead criado por backfill ManyChat (${origem}).`,
          })
          .select("id")
          .single();

        if (leadError) throw leadError;

        const newLeadId = newLead.id as string;

        await supabase
          .from("manychat_subscribers")
          .update({ lead_id: newLeadId, updated_at: new Date().toISOString() })
          .eq("id", sub.id);

        await supabase.from("lead_followups").insert({
          lead_id: newLeadId,
          subscriber_id: subscriberId,
          canal: canal ?? "facebook",
          primeiro_contato_em: new Date().toISOString(),
          status: "aguardando",
        });

        await supabase.from("system_events").insert({
          tipo: "lead",
          fonte: "manychat",
          acao: "lead_backfill",
          entidade_tipo: "lead",
          entidade_id: newLeadId,
          lead_id: newLeadId,
          dados: {
            subscriber_id: subscriberId,
            canal,
            origem,
            nome: nomeDoLead,
          },
          processado: true,
        });

        created++;
        results.push({ subscriber_id: subscriberId, action: "created", lead_id: newLeadId });
      } catch (e) {
        errored++;
        results.push({ subscriber_id: sub.subscriber_id, action: "error", error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        dryRun,
        limit,
        found: subs?.length ?? 0,
        linkedExisting,
        created,
        skipped,
        errored,
        results: results.slice(0, 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manychat-backfill-leads error", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
