import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.length === 10 || cleaned.length === 11) cleaned = '55' + cleaned;
  return cleaned;
}

async function getPageAccessToken(pageId: string, userAccessToken: string): Promise<string | null> {
  // Get page access token from user token
  const url = `https://graph.facebook.com/v20.0/${pageId}?fields=access_token&access_token=${userAccessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[Meta Sync] Failed to get page access token:', await res.text());
    return null;
  }
  const data = await res.json();
  return data.access_token || null;
}

async function fetchFormIdsFromPage(pageId: string, accessToken: string): Promise<string[]> {
  const url = `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms?access_token=${accessToken}&fields=id,name,status&limit=50`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[Meta Sync] Failed to fetch forms from page:', await res.text());
    return [];
  }
  const data = await res.json();
  const forms = data.data || [];
  console.log(`[Meta Sync] Found ${forms.length} forms for page ${pageId}`);
  return forms.map((f: any) => f.id);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'META_ACCESS_TOKEN not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    let formIds: string[] = body.form_ids || [];
    const pageId = body.page_id || '61585487574008';

    // Try to get Page Access Token; if it fails, assume the token IS already a page token
    let effectiveToken = accessToken;
    const pageAccessToken = await getPageAccessToken(pageId, accessToken);
    if (pageAccessToken) {
      console.log('[Meta Sync] Got page access token from user token');
      effectiveToken = pageAccessToken;
    } else {
      console.log('[Meta Sync] Using token directly (might already be a page token)');
    }

    // Discover forms from page
    if (formIds.length === 0) {
      formIds = await fetchFormIdsFromPage(pageId, effectiveToken);
      if (formIds.length === 0) {
        formIds = ['806114115222300'];
      }
    }

    let totalSynced = 0;
    let totalNew = 0;
    const errors: string[] = [];

    for (const formId of formIds) {
      console.log(`[Meta Sync] Fetching leads for form ${formId}...`);

      let url: string | null = `https://graph.facebook.com/v20.0/${formId}/leads?access_token=${effectiveToken}&limit=50&fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id`;
      let pageCount = 0;

      while (url && pageCount < 10) {
        pageCount++;
        const res = await fetch(url);
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[Meta Sync] API error for form ${formId}:`, errText);
          errors.push(`Form ${formId}: ${errText}`);
          break;
        }

        const data = await res.json();
        const leads = data.data || [];
        console.log(`[Meta Sync] Page ${pageCount}: ${leads.length} leads`);

        for (const lead of leads) {
          const leadgenId = lead.id;
          if (!leadgenId) continue;

          // Parse field_data
          const fields = lead.field_data || [];
          let nome = null, email = null, telefone = null;
          const formFields: Record<string, string> = {};

          for (const f of fields) {
            const n = (f.name || '').toLowerCase();
            const v = f.values?.[0] || '';
            formFields[f.name || 'unknown'] = v;
            if (n.includes('name') || n.includes('nome') || n === 'full_name') nome = v;
            else if (n.includes('email')) email = v;
            else if (n.includes('phone') || n.includes('telefone') || n === 'phone_number') telefone = v;
          }

          const phoneNorm = normalizePhone(telefone);
          const createdTime = lead.created_time || null;

          // Check if already in meta_form_leads
          const { data: existing } = await supabase
            .from('meta_form_leads')
            .select('id')
            .eq('meta_lead_id', leadgenId)
            .maybeSingle();

          if (!existing) {
            const { error: insertErr } = await supabase
              .from('meta_form_leads')
              .insert({
                meta_lead_id: leadgenId,
                form_id: formId,
                created_time: createdTime,
                nome,
                telefone: phoneNorm,
                email: email?.toLowerCase() || null,
                form_fields: formFields,
                raw: lead,
                status: 'novo',
              });

            if (insertErr) {
              console.error(`[Meta Sync] Insert error:`, insertErr);
            } else {
              totalNew++;
            }
          }

          // Ensure lead exists in leads_juridicos
          const { data: existingLead } = await supabase
            .from('leads_juridicos')
            .select('id')
            .eq('facebook_lead_id', leadgenId)
            .maybeSingle();

          let leadId = existingLead?.id || null;

          if (!leadId && phoneNorm) {
            const { data: phoneMatch } = await supabase
              .from('leads_juridicos')
              .select('id')
              .ilike('telefone', `%${phoneNorm.slice(-9)}%`)
              .maybeSingle();

            if (phoneMatch) {
              leadId = phoneMatch.id;
              await supabase.from('leads_juridicos')
                .update({ facebook_lead_id: leadgenId, tipo_origem: 'trafego', fonte_trafego: 'facebook_lead_ads' })
                .eq('id', leadId);
            }
          }

          if (!leadId && email) {
            const { data: emailMatch } = await supabase
              .from('leads_juridicos')
              .select('id')
              .eq('email', email.toLowerCase())
              .maybeSingle();

            if (emailMatch) {
              leadId = emailMatch.id;
              await supabase.from('leads_juridicos')
                .update({ facebook_lead_id: leadgenId })
                .eq('id', leadId);
            }
          }

          if (!leadId) {
            const { data: newLead } = await supabase
              .from('leads_juridicos')
              .insert({
                nome: nome || 'Lead Facebook',
                telefone: phoneNorm,
                email: email?.toLowerCase() || null,
                facebook_lead_id: leadgenId,
                status: 'Lead Frio',
                lead_state: 'NEW',
                origem: 'Facebook',
                tipo_origem: 'trafego',
                fonte_trafego: 'facebook_lead_ads',
                canal_origem: 'facebook',
              })
              .select('id')
              .single();

            leadId = newLead?.id;
          }

          // Link meta_form_leads to leads_juridicos
          if (leadId) {
            await supabase
              .from('meta_form_leads')
              .update({ linked_lead_id: leadId })
              .eq('meta_lead_id', leadgenId)
              .is('linked_lead_id', null);
          }

          totalSynced++;
        }

        // Pagination
        url = data.paging?.next || null;
      }
    }

    console.log(`[Meta Sync] Done: ${totalSynced} processed, ${totalNew} new`);

    return new Response(JSON.stringify({
      success: true,
      total_processed: totalSynced,
      new_leads: totalNew,
      forms_checked: formIds.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Meta Sync] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
