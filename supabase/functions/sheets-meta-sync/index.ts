import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY')!;

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.length === 10 || cleaned.length === 11) return '55' + cleaned;
  return cleaned;
}

function generateDedupeKey(email: string | null, phone: string | null, createdTime: string | null, name: string | null): string {
  const parts: string[] = [];
  if (email) parts.push(email.toLowerCase());
  if (phone) parts.push(phone.replace(/\D/g, ''));
  if (!email && !phone && name) parts.push(name.toLowerCase().trim());
  parts.push(createdTime || 'unknown');
  return parts.join('|');
}

function findField(row: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase().includes(lower) && v && v.trim()) return v.trim();
    }
  }
  return null;
}

function parseSheetDate(value: string | null): string | null {
  if (!value) return null;
  // Try ISO first
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try DD/MM/YYYY HH:mm:ss
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    const iso = `${yyyy}-${mm}-${dd}T${hh || '00'}:${min || '00'}:${ss || '00'}-04:00`;
    const parsed = new Date(iso);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!GOOGLE_SHEETS_API_KEY) {
    return new Response(JSON.stringify({ error: 'GOOGLE_SHEETS_API_KEY não configurada' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get sync state
    const { data: state, error: stateErr } = await supabase
      .from('integrations_state')
      .select('*')
      .eq('provider', 'google_sheets_meta_leads')
      .maybeSingle();

    if (stateErr) throw stateErr;

    const spreadsheetId = state?.spreadsheet_id || '1x3EQ2WAWlT1rhAjZhLQlEQYOlIQ9cT6dnx7Ydj9TC9A';
    const sheetName = state?.sheet_name || 'Página1';
    const lastRow = state?.last_row || 1;
    const stateId = state?.id;

    // Fetch all data from sheet - try with sheet name first, fallback to first sheet
    let range = encodeURIComponent(`${sheetName}!A1:Z`);
    let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;
    
    console.log(`[Sheets Sync] spreadsheetId=${spreadsheetId}, sheetName=${sheetName}, apiKey=${GOOGLE_SHEETS_API_KEY?.substring(0, 8)}...`);
    console.log(`[Sheets Sync] URL: ${url}`);
    console.log(`[Sheets Sync] Fetching from row ${lastRow + 1}...`);
    
    let res = await fetch(url);
    
    // If sheet name fails (404), try without sheet name (uses first sheet)
    if (!res.ok && res.status === 404) {
      console.log(`[Sheets Sync] Sheet "${sheetName}" not found, trying first sheet...`);
      range = encodeURIComponent('A1:Z');
      url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;
      res = await fetch(url);
    }
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('[Sheets Sync] API error:', errText);
      return new Response(JSON.stringify({ 
        error: `Erro ao acessar Google Sheets: ${res.status}. Verifique se a planilha está compartilhada como "Qualquer pessoa com o link".`,
        details: errText,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetData = await res.json();
    const allRows: string[][] = sheetData.values || [];

    if (allRows.length <= 1) {
      return new Response(JSON.stringify({ success: true, message: 'Planilha vazia ou só com cabeçalho', new_leads: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = allRows[0].map(h => h.trim());
    const newRows = allRows.slice(Math.max(lastRow, 1)); // Skip header and already-processed rows

    if (newRows.length === 0) {
      console.log('[Sheets Sync] No new rows');
      // Update last_sync_at
      if (stateId) {
        await supabase.from('integrations_state').update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', stateId);
      }
      return new Response(JSON.stringify({ success: true, new_leads: 0, total_rows: allRows.length - 1 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Sheets Sync] Processing ${newRows.length} new rows`);

    let newLeads = 0;
    let duplicates = 0;
    let errors = 0;

    for (const row of newRows) {
      try {
        // Map row to object using headers
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });

        const nome = findField(obj, 'full_name', 'nome', 'Nome completo', 'name') || null;
        const email = findField(obj, 'email', 'e-mail') || null;
        const telefoneRaw = findField(obj, 'phone_number', 'telefone', 'celular', 'phone', 'whatsapp') || null;
        const createdTimeRaw = findField(obj, 'created_time', 'data', 'data_criacao', 'timestamp') || null;
        const campaignName = findField(obj, 'campaign_name', 'campanha') || null;
        const adsetName = findField(obj, 'adset_name', 'conjunto') || null;
        const adName = findField(obj, 'ad_name', 'anuncio', 'anúncio') || null;

        if (!nome && !email && !telefoneRaw) {
          console.log('[Sheets Sync] Skipping empty row');
          continue;
        }

        const telefone = normalizePhone(telefoneRaw);
        const createdTime = parseSheetDate(createdTimeRaw);
        const dedupeKey = generateDedupeKey(email, telefone, createdTime, nome);

        // Check if lead already exists in leads_juridicos (by phone or email)
        let existingLeadId: string | null = null;

        if (telefone) {
          const { data: phoneMatch } = await supabase
            .from('leads_juridicos')
            .select('id')
            .ilike('telefone', `%${telefone.slice(-9)}%`)
            .maybeSingle();
          if (phoneMatch) existingLeadId = phoneMatch.id;
        }

        if (!existingLeadId && email) {
          const { data: emailMatch } = await supabase
            .from('leads_juridicos')
            .select('id')
            .eq('email', email.toLowerCase())
            .maybeSingle();
          if (emailMatch) existingLeadId = emailMatch.id;
        }

        // Skip if lead already exists - no need to create meta_form_leads entry
        if (existingLeadId) {
          duplicates++;
          continue;
        }

        // Upsert into meta_form_leads (only for truly new leads)
        const { data: inserted, error: insertErr } = await supabase
          .from('meta_form_leads')
          .upsert({
            meta_lead_id: `sheets_${dedupeKey}`,
            dedupe_key: dedupeKey,
            source: 'google_sheets',
            form_id: 'google_sheets',
            nome,
            telefone,
            email: email?.toLowerCase() || null,
            created_time: createdTime,
            campaign_name: campaignName,
            adset_name: adsetName,
            ad_name: adName,
            form_fields: obj,
            raw: obj,
            status: 'novo',
          }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('id')
          .maybeSingle();

        if (insertErr) {
          if (insertErr.code === '23505') {
            duplicates++;
          } else {
            console.error('[Sheets Sync] Insert error:', insertErr);
            errors++;
          }
          continue;
        }

        if (!inserted) {
          duplicates++;
          continue;
        }

        newLeads++;

        // Create new lead in leads_juridicos
        const { data: newLead } = await supabase
          .from('leads_juridicos')
          .insert({
            nome: nome || 'Lead Google Sheets',
            telefone,
            email: email?.toLowerCase() || null,
            status: 'Lead Frio',
            lead_state: 'NEW',
            origem: 'Facebook',
            tipo_origem: 'trafego',
            fonte_trafego: 'facebook_lead_ads',
            canal_origem: 'facebook',
            linha_whatsapp: 'trafego_isa',
            empresa_tag: null,
            isa_ativa: true,
          })
          .select('id')
          .single();
        const leadId = newLead?.id || null;

        // Link meta_form_leads to leads_juridicos
        if (leadId && inserted?.id) {
          await supabase
            .from('meta_form_leads')
            .update({ linked_lead_id: leadId })
            .eq('id', inserted.id);
        }

        // Create subscriber for chat access
        if (leadId && telefone) {
          const subscriberId = `zapi_${telefone}`;
          await supabase.from('manychat_subscribers').upsert({
            subscriber_id: subscriberId,
            nome: nome || 'Lead',
            telefone,
            telefone_normalizado: telefone,
            lead_id: leadId,
            canal: 'whatsapp',
            linha_whatsapp: 'trafego_isa',
          }, { onConflict: 'subscriber_id', ignoreDuplicates: true });

          // Trigger Isa first contact for Sheets leads
          // NOTE: isa-auto-process handles BOTH the AI response AND sending via Z-API
          // We do NOT send separately here to avoid double-sends
          try {
            console.log(`[Sheets Sync] 🤖 Triggering Isa first contact for lead ${leadId}`);
            const { data: isaResult, error: isaError } = await supabase.functions.invoke('isa-auto-process', {
              body: {
                lead_id: leadId,
                mensagem: `Novo lead de tráfego (Google Sheets): ${nome || 'Sem nome'}. Telefone: ${telefone}`,
                lead_state: 'NEW',
                canal: 'zapi',
                subscriber_id: subscriberId,
                subscriber_nome: nome || 'Lead',
                tipo_mensagem: 'text',
                is_first_contact: true,
              }
            });

            if (isaError) {
              console.error('[Sheets Sync] Isa first contact error:', isaError);
            } else {
              console.log(`[Sheets Sync] ✅ Isa processed lead ${leadId}:`, isaResult?.resposta_enviada ? 'response sent' : 'no response');
            }
          } catch (isaErr) {
            console.error('[Sheets Sync] Error triggering Isa:', isaErr);
          }
        }

      } catch (rowErr) {
        console.error('[Sheets Sync] Row error:', rowErr);
        errors++;
      }
    }

    // Update sync state
    const newLastRow = allRows.length; // total rows including header
    if (stateId) {
      await supabase.from('integrations_state').update({
        last_row: newLastRow,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', stateId);
    } else {
      await supabase.from('integrations_state').insert({
        provider: 'google_sheets_meta_leads',
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        last_row: newLastRow,
        last_sync_at: new Date().toISOString(),
      });
    }

    // Log execution
    await supabase.from('integration_logs').insert({
      provider: 'google_sheets_meta_leads',
      direction: 'inbound',
      endpoint: `sheets/${spreadsheetId}`,
      status: errors > 0 ? 'partial' : 'success',
      payload_json: { last_row_before: lastRow, last_row_after: newLastRow, new_rows: newRows.length },
      response_json: { new_leads: newLeads, duplicates, errors },
    });

    console.log(`[Sheets Sync] Done: ${newLeads} new, ${duplicates} duplicates, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      new_leads: newLeads,
      duplicates,
      errors,
      total_rows: allRows.length - 1,
      last_row: newLastRow,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Sheets Sync] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
