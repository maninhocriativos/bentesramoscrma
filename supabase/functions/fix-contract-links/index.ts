import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKSIGN_API_KEY = Deno.env.get("CLICKSIGN_API_KEY");
const CLICKSIGN_BASE_URL = "https://app.clicksign.com/api/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Buscar todos os contract_reminders com links errados:
    //    (a) /sign/{document_key} — usou a chave errada como signature key;
    //    (b) qualquer link que não seja /sign/{request_signature_key}, ex.:
    //        o fallback /document/{key}, que exige login no ClickSign e
    //        quebra para o cliente.
    const { data: reminders, error } = await supabase
      .from("contract_reminders")
      .select("id, document_key, contract_link");

    if (error) throw error;

    const toFix = (reminders || []).filter(r =>
      r.contract_link === `https://app.clicksign.com/sign/${r.document_key}` ||
      !r.contract_link ||
      !r.contract_link.includes('/sign/')
    );

    console.log(`Total para corrigir: ${toFix.length}`);

    let corrigidos = 0;
    let erros = 0;

    // 2. Para cada um, buscar o request_signature_key correto na API
    for (let i = 0; i < toFix.length; i += 3) {
      const batch = toFix.slice(i, i + 3);
      
      await Promise.all(batch.map(async (reminder) => {
        try {
          const res = await fetch(
            `${CLICKSIGN_BASE_URL}/documents/${reminder.document_key}/lists?access_token=${CLICKSIGN_API_KEY}`,
            { method: "GET" }
          );

          if (!res.ok) {
            console.warn(`Erro ao buscar lists para ${reminder.document_key}: ${res.status}`);
            erros++;
            return;
          }

          const data = await res.json();
          const lists = data.lists || [];
          const firstList = lists.find((l: any) => l.request_signature_key);

          if (firstList?.request_signature_key) {
            const newLink = `https://app.clicksign.com/sign/${firstList.request_signature_key}`;
            
            // Atualizar no banco
            await supabase
              .from("contract_reminders")
              .update({ contract_link: newLink })
              .eq("id", reminder.id);

            console.log(`✅ ${reminder.document_key} → ${newLink}`);
            corrigidos++;
          } else {
            console.warn(`⚠️ Sem request_signature_key para ${reminder.document_key}`);
            erros++;
          }
        } catch (e) {
          console.error(`Erro no doc ${reminder.document_key}:`, e);
          erros++;
        }
      }));

      // Pequena pausa entre lotes para não sobrecarregar a API
      if (i + 3 < toFix.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // 3. Também corrigir leads_juridicos
    const { data: leads } = await supabase
      .from("leads_juridicos")
      .select("id, link_contrato, contract_key")
      .not("contract_key", "is", null);

    const leadsToFix = (leads || []).filter(l =>
      l.link_contrato === `https://app.clicksign.com/sign/${l.contract_key}` ||
      !l.link_contrato ||
      !l.link_contrato.includes('/sign/')
    );

    console.log(`Leads para corrigir: ${leadsToFix.length}`);

    for (const lead of leadsToFix) {
      try {
        // Buscar o link correto do contract_reminders já corrigido
        const { data: reminder } = await supabase
          .from("contract_reminders")
          .select("contract_link")
          .eq("document_key", lead.contract_key)
          .like("contract_link", "%/sign/%")
          .not("contract_link", "eq", `https://app.clicksign.com/sign/${lead.contract_key}`)
          .maybeSingle();

        if (reminder?.contract_link) {
          await supabase
            .from("leads_juridicos")
            .update({ link_contrato: reminder.contract_link })
            .eq("id", lead.id);
        }
      } catch (e) {
        console.error(`Erro no lead ${lead.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: toFix.length,
        corrigidos,
        erros,
        mensagem: `${corrigidos} links corrigidos de ${toFix.length} total`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (err: any) {
    console.error("Erro:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
