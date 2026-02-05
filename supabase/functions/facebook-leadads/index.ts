import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // GET: Facebook Webhook Verification
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
      
      // Manual sync route
      if (payload.action === 'sync' && Array.isArray(payload.leads)) {
        const results = await handleManualSync(supabase, payload.leads);
        return new Response(JSON.stringify(results), { 
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // Standard Facebook webhook
      const result = await handleFacebookWebhook(supabase, payload);
      return new Response(JSON.stringify(result), { 
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('[FB Lead Ads] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleManualSync(supabase: any, leads: any[]) {
  console.log('[FB Lead Ads] 🔄 Manual sync for', leads.length, 'leads');
  const results = [];
  
  for (const fbLead of leads) {
    const nome = fbLead.nome || fbLead.name || fbLead.nome_completo || fbLead.full_name;
    const email = fbLead.email?.toLowerCase();
    const telefone = normalizePhone(fbLead.telefone || fbLead.phone);
    
    if (!nome && !email && !telefone) {
      results.push({ success: false, error: 'Nenhum dado fornecido' });
      continue;
    }
    
    const result = await findOrCreateLead(supabase, { nome, email, telefone });
    results.push(result);
  }
  
  return { 
    success: true, 
    synced: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results 
  };
}

async function handleFacebookWebhook(supabase: any, payload: any) {
  console.log('[FB Lead Ads] 📥 Received webhook');
  const entries = payload.entry || [];
  let leadsProcessed = 0;

  for (const entry of entries) {
    const changes = entry.changes || [];
    
    for (const change of changes) {
      if (change.field !== 'leadgen') continue;
      
      const { leadgen_id, form_id, page_id, ad_id, adgroup_id, created_time } = change.value || {};
      if (!leadgen_id) continue;

      const accessToken = Deno.env.get('META_ACCESS_TOKEN');
      
      if (!accessToken) {
        await supabase.from('integration_logs').insert({
          provider: 'facebook_leadads', direction: 'inbound', endpoint: '/facebook-leadads',
          status: 'pending', payload_json: { leadgen_id, form_id, page_id, ad_id, needs_fetch: true }
        });
        continue;
      }

      const leadResponse = await fetch(`https://graph.facebook.com/v20.0/${leadgen_id}?access_token=${accessToken}`);
      
      if (!leadResponse.ok) {
        const error = await leadResponse.json();
        await supabase.from('integration_logs').insert({
          provider: 'facebook_leadads', direction: 'inbound', endpoint: `graph.facebook.com/${leadgen_id}`,
          status: 'error', error_message: error.error?.message, payload_json: { leadgen_id, form_id }
        });
        continue;
      }

      const leadData = await leadResponse.json();
      const { nome, email, telefone, formFieldsMap } = extractLeadFields(leadData);
      const telefoneNormalizado = normalizePhone(telefone);

      // Save to meta_form_leads
      const { data: existingMetaLead } = await supabase
        .from('meta_form_leads').select('id').eq('meta_lead_id', leadgen_id).maybeSingle();

      if (!existingMetaLead) {
        await supabase.from('meta_form_leads').insert({
          meta_lead_id: leadgen_id, form_id, ad_id, campaign_id: adgroup_id,
          created_time: created_time ? new Date(created_time * 1000).toISOString() : null,
          nome, telefone: telefoneNormalizado, email: email?.toLowerCase(),
          form_fields: formFieldsMap, raw: leadData, status: 'novo',
        });
      }

      // Find or create in leads_juridicos
      const { data: existingLead } = await supabase
        .from('leads_juridicos').select('id').eq('facebook_lead_id', leadgen_id).maybeSingle();

      if (existingLead) {
        leadsProcessed++;
        continue;
      }

      const result = await findOrCreateLeadWithFbId(supabase, {
        nome, email, telefone: telefoneNormalizado, leadgen_id, form_id
      });

      await supabase.from('integration_logs').insert({
        provider: 'facebook_leadads', direction: 'inbound', endpoint: '/facebook-leadads',
        status: 'success', lead_id: result.lead_id,
        payload_json: { leadgen_id, form_id, page_id, ad_id, nome, email, telefone: telefoneNormalizado },
        response_json: { lead_id: result.lead_id, action: result.matched_by === 'created' ? 'created' : 'updated' }
      });

      leadsProcessed++;
    }
  }

  return { success: true, leads_processed: leadsProcessed };
}

function extractLeadFields(leadData: any) {
  const fieldData = leadData.field_data || [];
  let nome: string | null = null, email: string | null = null, telefone: string | null = null;
  const formFieldsMap: Record<string, string> = {};

  for (const field of fieldData) {
    const fieldName = field.name?.toLowerCase() || '';
    const value = field.values?.[0] || null;
    formFieldsMap[field.name || 'unknown'] = value || '';

    if (fieldName.includes('name') || fieldName.includes('nome') || fieldName === 'full_name') nome = value;
    else if (fieldName.includes('email')) email = value;
    else if (fieldName.includes('phone') || fieldName.includes('telefone') || fieldName.includes('whatsapp')) telefone = value;
  }

  return { nome, email, telefone, formFieldsMap };
}

async function findOrCreateLead(supabase: any, { nome, email, telefone }: { nome: string | null, email: string | null, telefone: string | null }) {
  let leadId: string | null = null;
  let matchedBy: string | null = null;

  // Search by phone
  if (telefone) {
    const phoneSuffix = telefone.slice(-9);
    const { data: leadByPhone } = await supabase
      .from('leads_juridicos').select('id, email, nome').ilike('telefone', `%${phoneSuffix}%`).maybeSingle();
    
    if (leadByPhone) {
      leadId = leadByPhone.id;
      matchedBy = 'telefone';
      const updates: any = { updated_at: new Date().toISOString() };
      if (email && !leadByPhone.email) updates.email = email;
      if (nome && (!leadByPhone.nome || leadByPhone.nome.startsWith('Contato') || leadByPhone.nome === 'Desconhecido')) updates.nome = nome;
      if (Object.keys(updates).length > 1) await supabase.from('leads_juridicos').update(updates).eq('id', leadId);
    }
  }

  // Search by email
  if (!leadId && email) {
    const { data: leadByEmail } = await supabase.from('leads_juridicos').select('id, telefone').eq('email', email).maybeSingle();
    if (leadByEmail) {
      leadId = leadByEmail.id;
      matchedBy = 'email';
      if (telefone && !leadByEmail.telefone) {
        await supabase.from('leads_juridicos').update({ telefone, updated_at: new Date().toISOString() }).eq('id', leadId);
      }
    }
  }

  // Create new lead
  if (!leadId) {
    const { data: newLead, error } = await supabase.from('leads_juridicos').insert({
      nome: nome || 'Lead Facebook', telefone, email,
      status: 'Lead Frio', lead_state: 'NEW', origem: 'Facebook',
      tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads', canal_origem: 'facebook',
      resumo_ia: `Lead importado do Facebook Lead Ads em ${new Date().toLocaleDateString('pt-BR')}.`
    }).select('id').single();
    
    if (error) return { success: false, error: error.message, nome };
    leadId = newLead.id;
    matchedBy = 'created';
  }

  return { success: true, lead_id: leadId, matched_by: matchedBy, nome, email, telefone };
}

async function findOrCreateLeadWithFbId(supabase: any, { nome, email, telefone, leadgen_id, form_id }: any) {
  let leadId: string | null = null;
  let matchedBy: string | null = null;

  if (telefone) {
    const phoneSuffix = telefone.slice(-9);
    const { data: leadByPhone } = await supabase
      .from('leads_juridicos').select('id, email, nome').ilike('telefone', `%${phoneSuffix}%`).maybeSingle();
    
    if (leadByPhone) {
      leadId = leadByPhone.id;
      matchedBy = 'telefone';
      const updates: any = { facebook_lead_id: leadgen_id, tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads', updated_at: new Date().toISOString() };
      if (email && !leadByPhone.email) updates.email = email.toLowerCase();
      if (nome && (!leadByPhone.nome || leadByPhone.nome.startsWith('Contato') || leadByPhone.nome === 'Desconhecido')) updates.nome = nome;
      await supabase.from('leads_juridicos').update(updates).eq('id', leadId);
    }
  }

  if (!leadId && email) {
    const { data: leadByEmail } = await supabase.from('leads_juridicos').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (leadByEmail) {
      leadId = leadByEmail.id;
      matchedBy = 'email';
      await supabase.from('leads_juridicos').update({ 
        facebook_lead_id: leadgen_id, tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads', updated_at: new Date().toISOString() 
      }).eq('id', leadId);
    }
  }

  if (!leadId) {
    const { data: newLead } = await supabase.from('leads_juridicos').insert({
      nome: nome || 'Lead Facebook', telefone, email: email?.toLowerCase(),
      facebook_lead_id: leadgen_id, status: 'Lead Frio', lead_state: 'NEW',
      origem: 'Facebook', tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads', canal_origem: 'facebook',
      resumo_ia: `Lead captado via Facebook Lead Ads em ${new Date().toLocaleDateString('pt-BR')}. Formulário: ${form_id || 'N/A'}.`
    }).select('id').single();
    leadId = newLead?.id;
    matchedBy = 'created';
  }

  return { lead_id: leadId, matched_by: matchedBy };
}
