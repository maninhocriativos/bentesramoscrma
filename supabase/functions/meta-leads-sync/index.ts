import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

async function fetchWithToken(url: string, token: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: { message: res.statusText } }));
      const msg = errData?.error?.message || res.statusText;
      return { ok: false, error: msg };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');

  if (!accessToken) {
    return new Response(JSON.stringify({ 
      error: 'META_ACCESS_TOKEN não configurado. Configure nas secrets do Supabase.',
      error_type: 'missing_token',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    let pageId = body.page_id || null;

    // Resolve page id dynamically from token (/me), and fallback when a stale page_id is provided
    const resolvePageFromMe = async () => {
      const meResult = await fetchWithToken(
        `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${accessToken}`,
        accessToken
      );
      return meResult.ok && meResult.data?.id ? meResult.data : null;
    };

    const mePage = await resolvePageFromMe();
    if (!pageId && mePage?.id) {
      pageId = mePage.id;
      console.log(`[Meta Sync] Page resolved from /me: ${mePage.name} (${mePage.id})`);
    }

    if (!pageId) {
      return new Response(JSON.stringify({
        error: 'Não foi possível identificar a página da Meta a partir do token. Gere um Page Access Token válido e selecione a página correta.',
        error_type: 'invalid_page_token',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Try to get Page Access Token from User token
    let effectiveToken = accessToken;
    let tokenType = 'direct';

    let pageResult = await fetchWithToken(
      `https://graph.facebook.com/v20.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`,
      accessToken
    );

    // If provided/stored page id is stale, fallback to /me page id
    if (!pageResult.ok && mePage?.id && mePage.id !== pageId) {
      console.log(`[Meta Sync] page_id ${pageId} inválido. Fallback para /me: ${mePage.id}`);
      pageId = mePage.id;
      pageResult = await fetchWithToken(
        `https://graph.facebook.com/v20.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`,
        accessToken
      );
    }

    if (pageResult.ok && pageResult.data?.access_token) {
      effectiveToken = pageResult.data.access_token;
      tokenType = 'page_from_user';
      console.log(`[Meta Sync] Got page token for: ${pageResult.data.name}`);
    } else {
      console.log(`[Meta Sync] Using token directly for page ${pageId}. Page lookup result: ${pageResult.error}`);
    }

    // Step 2: Discover forms
    let formIds: string[] = body.form_ids || [];
    const formNames: Record<string, string> = {};
    
    if (formIds.length === 0) {
      const formsResult = await fetchWithToken(
        `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms?access_token=${effectiveToken}&fields=id,name,status&limit=50`,
        effectiveToken
      );
      
      if (formsResult.ok && formsResult.data?.data?.length > 0) {
        const forms = formsResult.data.data;
        formIds = forms.map((f: any) => f.id);
        forms.forEach((f: any) => { formNames[f.id] = f.name || f.id; });
        console.log(`[Meta Sync] Found ${formIds.length} forms`);
      } else {
        // If can't discover forms, the token likely lacks permissions
        const errorMsg = formsResult.error || 'Nenhum formulário encontrado';
        const isPermissionError = errorMsg.includes('permission') || errorMsg.includes('nonexisting field') || errorMsg.includes('does not exist');
        
        return new Response(JSON.stringify({
          error: isPermissionError
            ? 'Token sem permissão para acessar formulários da página. Gere um novo Page Access Token com as permissões: pages_read_engagement, leads_retrieval, pages_manage_ads'
            : `Erro ao buscar formulários: ${errorMsg}`,
          error_type: isPermissionError ? 'permission_error' : 'api_error',
          details: errorMsg,
          help: 'Acesse https://developers.facebook.com/tools/explorer/ para gerar um novo token',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Step 3: Fetch leads from each form
    let totalSynced = 0;
    let totalNew = 0;
    const errors: string[] = [];
    const formStats: Record<string, { total: number; new: number; name: string }> = {};

    for (const formId of formIds) {
      const formName = formNames[formId] || formId;
      formStats[formId] = { total: 0, new: 0, name: formName };
      console.log(`[Meta Sync] Fetching leads for form "${formName}" (${formId})...`);

      let url: string | null = `https://graph.facebook.com/v20.0/${formId}/leads?access_token=${effectiveToken}&limit=50&fields=id,created_time,field_data,ad_id,adset_id,campaign_id,form_id`;
      let pageCount = 0;

      while (url && pageCount < 10) {
        pageCount++;
        const result = await fetchWithToken(url, effectiveToken);
        
        if (!result.ok) {
          const errMsg = result.error || 'Unknown error';
          console.error(`[Meta Sync] API error for form ${formId}:`, errMsg);
          
          if (errMsg.includes('leads_retrieval')) {
            errors.push(`Permissão "leads_retrieval" necessária para o formulário "${formName}"`);
          } else {
            errors.push(`${formName}: ${errMsg}`);
          }
          break;
        }

        const leads = result.data?.data || [];
        console.log(`[Meta Sync] Page ${pageCount}: ${leads.length} leads`);

        for (const lead of leads) {
          const leadgenId = lead.id;
          if (!leadgenId) continue;

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
              formStats[formId].new++;
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
          formStats[formId].total++;
        }

        url = result.data?.paging?.next || null;
      }
    }

    console.log(`[Meta Sync] Done: ${totalSynced} processed, ${totalNew} new`);

    return new Response(JSON.stringify({
      success: true,
      total_processed: totalSynced,
      new_leads: totalNew,
      forms_checked: formIds.length,
      form_stats: formStats,
      token_type: tokenType,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Meta Sync] Error:', error);
    return new Response(JSON.stringify({ 
      error: String(error),
      error_type: 'internal_error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
