import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VERIFY_TOKEN = Deno.env.get('FB_LEADADS_VERIFY_TOKEN') || 'bentes_ramos_crm_2024';

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 0) return null;
  if (cleaned.startsWith('p')) cleaned = cleaned.substring(1);
  if (cleaned.length === 10 || cleaned.length === 11) cleaned = '55' + cleaned;
  return cleaned;
}

serve(async (req) => {
  const url = new URL(req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[FB Lead Ads] ✅ Webhook verified');
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      return new Response('Forbidden', { status: 403 });
    }

    if (req.method === 'POST') {
      const payload = await req.json();
      
      if (payload.action === 'sync' && Array.isArray(payload.leads)) {
        const results = [];
        for (const lead of payload.leads) {
          const nome = lead.nome || lead.name;
          const email = lead.email?.toLowerCase();
          const telefone = normalizePhone(lead.telefone || lead.phone);
          if (!nome && !email && !telefone) { results.push({ success: false }); continue; }
          
          let leadId = null;
          if (telefone) {
            const { data } = await supabase.from('leads_juridicos').select('id').ilike('telefone', `%${telefone.slice(-9)}%`).maybeSingle();
            if (data) leadId = data.id;
          }
          if (!leadId && email) {
            const { data } = await supabase.from('leads_juridicos').select('id').eq('email', email).maybeSingle();
            if (data) leadId = data.id;
          }
          if (!leadId) {
            const { data } = await supabase.from('leads_juridicos').insert({
              nome: nome || 'Lead Facebook', telefone, email, status: 'Lead Frio', lead_state: 'NEW',
              origem: 'Facebook', tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads'
            }).select('id').single();
            leadId = data?.id;
          }
          results.push({ success: true, lead_id: leadId });
        }
        return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const entries = payload.entry || [];
      let processed = 0;

      for (const entry of entries) {
        for (const change of (entry.changes || [])) {
          if (change.field !== 'leadgen') continue;
          const { leadgen_id, form_id, ad_id, adgroup_id, created_time } = change.value || {};
          if (!leadgen_id) continue;

          const accessToken = Deno.env.get('META_ACCESS_TOKEN');
          if (!accessToken) {
            await supabase.from('integration_logs').insert({ provider: 'facebook_leadads', direction: 'inbound', status: 'pending', payload_json: { leadgen_id, needs_fetch: true } });
            continue;
          }

          const res = await fetch(`https://graph.facebook.com/v20.0/${leadgen_id}?access_token=${accessToken}`);
          if (!res.ok) continue;

          const leadData = await res.json();
          const fields = leadData.field_data || [];
          let nome = null, email = null, telefone = null;
          const formFields: Record<string, string> = {};

          for (const f of fields) {
            const n = f.name?.toLowerCase() || '';
            const v = f.values?.[0];
            formFields[f.name || 'unknown'] = v || '';
            if (n.includes('name') || n.includes('nome')) nome = v;
            else if (n.includes('email')) email = v;
            else if (n.includes('phone') || n.includes('telefone')) telefone = v;
          }

          const phoneNorm = normalizePhone(telefone);

          const { data: existing } = await supabase.from('meta_form_leads').select('id').eq('meta_lead_id', leadgen_id).maybeSingle();
          if (!existing) {
            await supabase.from('meta_form_leads').insert({
              meta_lead_id: leadgen_id, form_id, ad_id, campaign_id: adgroup_id,
              created_time: created_time ? new Date(created_time * 1000).toISOString() : null,
              nome, telefone: phoneNorm, email: email?.toLowerCase(), form_fields: formFields, raw: leadData, status: 'novo'
            });
          }

          const { data: existingLead } = await supabase.from('leads_juridicos').select('id').eq('facebook_lead_id', leadgen_id).maybeSingle();
          if (existingLead) { processed++; continue; }

          let leadId = null;
          if (phoneNorm) {
            const { data } = await supabase.from('leads_juridicos').select('id').ilike('telefone', `%${phoneNorm.slice(-9)}%`).maybeSingle();
            if (data) {
              leadId = data.id;
              await supabase.from('leads_juridicos').update({ facebook_lead_id: leadgen_id, tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads' }).eq('id', leadId);
            }
          }
          if (!leadId && email) {
            const { data } = await supabase.from('leads_juridicos').select('id').eq('email', email.toLowerCase()).maybeSingle();
            if (data) {
              leadId = data.id;
              await supabase.from('leads_juridicos').update({ facebook_lead_id: leadgen_id }).eq('id', leadId);
            }
          }
          if (!leadId) {
            const { data } = await supabase.from('leads_juridicos').insert({
              nome: nome || 'Lead Facebook', telefone: phoneNorm, email: email?.toLowerCase(),
              facebook_lead_id: leadgen_id, status: 'Lead Frio', lead_state: 'NEW',
              origem: 'Facebook', tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads', canal_origem: 'facebook'
            }).select('id').single();
            leadId = data?.id;
          }

          await supabase.from('integration_logs').insert({ provider: 'facebook_leadads', direction: 'inbound', status: 'success', lead_id: leadId, payload_json: { leadgen_id } });
          processed++;
        }
      }

      return new Response(JSON.stringify({ success: true, leads_processed: processed }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('[FB Lead Ads] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
