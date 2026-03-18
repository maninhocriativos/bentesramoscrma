const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { leads } = await req.json();
    const results = { inserted: 0, skipped: 0, errors: [] as string[] };

    for (const lead of leads) {
      // Check for duplicate by facebook_lead_id
      const { data: existing } = await supabase
        .from('leads_juridicos')
        .select('id')
        .eq('facebook_lead_id', lead.facebook_lead_id)
        .maybeSingle();

      if (existing) {
        results.skipped++;
        // Link meta_form_leads if needed
        if (lead.meta_form) {
          await supabase.from('meta_form_leads')
            .upsert({ ...lead.meta_form, linked_lead_id: existing.id }, { onConflict: 'meta_lead_id' });
        }
        continue;
      }

      // Insert lead
      const { data: newLead, error } = await supabase
        .from('leads_juridicos')
        .insert(lead.juridico)
        .select('id')
        .single();

      if (error) {
        results.errors.push(`${lead.juridico.nome}: ${error.message}`);
        continue;
      }

      // Insert meta_form_leads
      if (lead.meta_form && newLead) {
        await supabase.from('meta_form_leads').upsert(
          { ...lead.meta_form, linked_lead_id: newLead.id },
          { onConflict: 'meta_lead_id' }
        );
      }

      // Create manychat_subscriber for chat
      if (newLead && lead.juridico.telefone) {
        const subId = `zapi_${lead.juridico.telefone}`;
        await supabase.from('manychat_subscribers').upsert({
          subscriber_id: subId,
          nome: lead.juridico.nome,
          telefone: lead.juridico.telefone,
          email: lead.juridico.email,
          lead_id: newLead.id,
          canal: 'whatsapp',
          linha_whatsapp: 'trafego_isa',
          empresa_tag: 'TRAFEGO',
        }, { onConflict: 'subscriber_id' });
      }

      results.inserted++;
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
