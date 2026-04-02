const serve = Deno.serve;
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
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString();
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (match) {
    const [, dd, mm, yyyy, hh, min, ss] = match;
    const iso = `${yyyy}-${mm}-${dd}T${hh || '00'}:${min || '00'}:${ss || '00'}-04:00`;
    const parsed = new Date(iso);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

// ── Z-API helper: send first contact message ──
async function sendZapiFirstContact(supabase: any, telefone: string, nome: string, produto: string) {
  try {
    const { data: zapiConfig } = await supabase
      .from('integrations_config')
      .select('config_json')
      .eq('provider', 'zapi_instances')
      .maybeSingle();

    if (!zapiConfig?.config_json) return;

    const instances = Array.isArray(zapiConfig.config_json) ? zapiConfig.config_json : zapiConfig.config_json.instances || [];
    const trafegoInstance = instances.find((i: any) => i.name === 'trafego_isa' || i.label?.toLowerCase()?.includes('trafego'));

    if (!trafegoInstance?.instance_id || !trafegoInstance?.token) {
      console.log('[Sheets Sync] Z-API trafego instance not found');
      return;
    }

    const message = `Olá, ${nome}! 👋\n\nRecebemos seu cadastro e já estamos analisando seu caso sobre *${produto}*.\n\nNossa equipe especializada em direito bancário entrará em contato em breve para te ajudar a recuperar o que é seu por direito! ⚖️\n\nEnquanto isso, se tiver algum documento como extrato ou contrato, pode deixar separado — vai agilizar muito sua análise gratuita! 📄`;

    const url = `https://api.z-api.io/instances/${trafegoInstance.instance_id}/token/${trafegoInstance.token}/send-text`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (trafegoInstance.client_token) headers['Client-Token'] = trafegoInstance.client_token;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: telefone, message }),
    });

    if (res.ok) {
      console.log(`[Sheets Sync] ✅ Z-API first contact sent to ${telefone}`);
    } else {
      console.error(`[Sheets Sync] Z-API send failed: ${res.status}`);
    }
  } catch (err) {
    console.error('[Sheets Sync] Z-API send error (silent):', err);
  }
}

// ── Process original spreadsheet (existing logic) ──
async function syncOriginalSheet(supabase: any) {
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

  let range = encodeURIComponent(`${sheetName}!A1:Z`);
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;

  console.log(`[Sheets Sync Original] Fetching from row ${lastRow + 1}...`);

  let res = await fetch(url);

  if (!res.ok && res.status === 404) {
    range = encodeURIComponent('A1:Z');
    url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;
    res = await fetch(url);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Sheets Sync Original] API error:', errText);
    return { new_leads: 0, duplicates: 0, errors: 1, error_msg: `Sheets API ${res.status}` };
  }

  const sheetData = await res.json();
  const allRows: string[][] = sheetData.values || [];

  if (allRows.length <= 1) {
    return { new_leads: 0, duplicates: 0, errors: 0 };
  }

  const headers = allRows[0].map(h => h.trim());
  const newRows = allRows.slice(Math.max(lastRow, 1));

  if (newRows.length === 0) {
    if (stateId) {
      await supabase.from('integrations_state').update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', stateId);
    }
    return { new_leads: 0, duplicates: 0, errors: 0 };
  }

  console.log(`[Sheets Sync Original] Processing ${newRows.length} new rows`);

  let newLeads = 0;
  let duplicates = 0;
  let errors = 0;

  for (const row of newRows) {
    try {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });

      const nome = findField(obj, 'full_name', 'nome', 'Nome completo', 'name') || null;
      const email = findField(obj, 'email', 'e-mail') || null;
      const telefoneRaw = findField(obj, 'phone_number', 'telefone', 'celular', 'phone', 'whatsapp') || null;
      const createdTimeRaw = findField(obj, 'created_time', 'data', 'data_criacao', 'timestamp') || null;
      const campaignName = findField(obj, 'campaign_name', 'campanha') || null;
      const adsetName = findField(obj, 'adset_name', 'conjunto') || null;
      const adName = findField(obj, 'ad_name', 'anuncio', 'anúncio') || null;

      if (!nome && !email && !telefoneRaw) continue;

      const telefone = normalizePhone(telefoneRaw);
      const createdTime = parseSheetDate(createdTimeRaw);
      const dedupeKey = generateDedupeKey(email, telefone, createdTime, nome);

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

      if (existingLeadId) {
        duplicates++;
        continue;
      }

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
        if (insertErr.code === '23505') { duplicates++; } else { console.error('[Sheets Sync Original] Insert error:', insertErr); errors++; }
        continue;
      }

      if (!inserted) { duplicates++; continue; }

      newLeads++;

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

      if (leadId && inserted?.id) {
        await supabase.from('meta_form_leads').update({ linked_lead_id: leadId }).eq('id', inserted.id);
      }

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

        try {
          console.log(`[Sheets Sync Original] 🤖 Triggering Isa for lead ${leadId}`);
          const { error: isaError } = await supabase.functions.invoke('isa-auto-process', {
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
          if (isaError) console.error('[Sheets Sync Original] Isa error:', isaError);
        } catch (isaErr) {
          console.error('[Sheets Sync Original] Error triggering Isa:', isaErr);
        }
      }

    } catch (rowErr) {
      console.error('[Sheets Sync Original] Row error:', rowErr);
      errors++;
    }
  }

  const newLastRow = allRows.length;
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

  await supabase.from('integration_logs').insert({
    provider: 'google_sheets_meta_leads',
    direction: 'inbound',
    endpoint: `sheets/${spreadsheetId}`,
    status: errors > 0 ? 'partial' : 'success',
    payload_json: { last_row_before: lastRow, last_row_after: newLastRow, new_rows: newRows.length },
    response_json: { new_leads: newLeads, duplicates, errors },
  });

  console.log(`[Sheets Sync Original] Done: ${newLeads} new, ${duplicates} dup, ${errors} err`);
  return { new_leads: newLeads, duplicates, errors };
}

// ── Normalize phone for Venda Casada (handles p:+ from Meta) ──
function normalizarTelefone(tel: string): string {
  let num = tel.replace('p:+', '').replace(/\D/g, '');
  if (!num) return '';
  if (!num.startsWith('55')) {
    num = '55' + num;
  }
  return num;
}

// ── Process Venda Casada spreadsheet (NEW) ──
async function syncVendaCasadaSheet(supabase: any) {
  const SPREADSHEET_ID = '11Ml-lw-ijAiqno6Xr2HxmVn7E89E0UOWx8SjOak-pkE';
  const SHEET_NAME = 'Tabela_1';
  const PROVIDER = 'google_sheets_venda_casada';

  console.log('=== SYNC VENDA CASADA INICIADO ===');

  // VERIFICAÇÃO 1: Estado de sincronização
  const { data: state, error: stateErr } = await supabase
    .from('integrations_state')
    .select('*')
    .eq('provider', PROVIDER)
    .maybeSingle();

  if (stateErr) throw stateErr;

  let lastRow = 1;
  let stateId = state?.id || null;

  if (!state) {
    console.log('[Sheets Sync VendaCasada] Creating new integration state');
    const { data: newState, error: insertStateErr } = await supabase.from('integrations_state').insert({
      provider: PROVIDER,
      spreadsheet_id: SPREADSHEET_ID,
      sheet_name: SHEET_NAME,
      last_row: 1,
      last_sync_at: new Date().toISOString(),
    }).select('id').single();
    if (insertStateErr) throw insertStateErr;
    stateId = newState?.id;
    lastRow = 1;
  } else {
    lastRow = state.last_row || 1;
    if (lastRow === 0) {
      console.log('[Sheets Sync VendaCasada] Correcting last_row from 0 to 1');
      await supabase.from('integrations_state').update({ last_row: 1 }).eq('id', stateId);
      lastRow = 1;
    }
  }

  // VERIFICAÇÃO 2: URL correta — try with sheet name, fallback without
  let range = encodeURIComponent(`${SHEET_NAME}!A1:V`);
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_SHEETS_API_KEY}`;

  console.log(`[Sheets Sync VendaCasada] Fetching from row ${lastRow + 1}...`);
  console.log(`[Sheets Sync VendaCasada] URL: ${url}`);

  let res = await fetch(url);

  // Fallback: try without sheet name if 404 or 400
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    console.log('[Sheets Sync VendaCasada] Sheet name not found, trying without sheet name...');
    url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent('A1:V')}?key=${GOOGLE_SHEETS_API_KEY}`;
    res = await fetch(url);
  }

  // Fallback 2: try Página1
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    console.log('[Sheets Sync VendaCasada] Trying Página1...');
    url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent('Página1!A1:V')}?key=${GOOGLE_SHEETS_API_KEY}`;
    res = await fetch(url);
  }

  // Fallback 3: try Sheet1
  if (!res.ok && (res.status === 404 || res.status === 400)) {
    console.log('[Sheets Sync VendaCasada] Trying Sheet1...');
    url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent('Sheet1!A1:V')}?key=${GOOGLE_SHEETS_API_KEY}`;
    res = await fetch(url);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Sheets Sync VendaCasada] API error:', errText);
    return { new_leads: 0, duplicates: 0, errors: 1, error_msg: `Sheets API ${res.status}: ${errText}` };
  }

  const sheetData = await res.json();
  const allRows: string[][] = sheetData.values || [];

  console.log(`[Sheets Sync VendaCasada] Total de linhas na planilha: ${allRows.length}`);
  console.log(`[Sheets Sync VendaCasada] Última linha processada: ${lastRow}`);
  console.log(`[Sheets Sync VendaCasada] Linhas novas a processar: ${allRows.length - lastRow}`);

  if (allRows.length <= 1) {
    console.log('[Sheets Sync VendaCasada] No data rows found');
    return { new_leads: 0, duplicates: 0, errors: 0, total_linhas: allRows.length };
  }

  // Log header for debugging
  console.log(`[Sheets Sync VendaCasada] Headers: ${JSON.stringify(allRows[0])}`);

  const newRows = allRows.slice(Math.max(lastRow, 1));

  if (newRows.length === 0) {
    if (stateId) {
      await supabase.from('integrations_state').update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', stateId);
    }
    console.log('[Sheets Sync VendaCasada] No new rows to process');
    return { new_leads: 0, duplicates: 0, errors: 0, total_linhas: allRows.length };
  }

  console.log(`[Sheets Sync VendaCasada] Processing ${newRows.length} new rows`);

  let newLeads = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    try {
      // VERIFICAÇÃO 3: Mapeamento de colunas
      const nome = row[19] || '';
      const telefoneRaw = row[20] || '';

      console.log(`[Sheets Sync VendaCasada] Processando linha ${lastRow + i}: nome="${nome}" tel="${telefoneRaw}"`);

      if (!nome && !telefoneRaw) {
        console.log(`[Sheets Sync VendaCasada] Skipping empty row ${lastRow + i}`);
        continue;
      }

      const telefone = normalizarTelefone(telefoneRaw);
      if (!telefone) {
        console.log(`[Sheets Sync VendaCasada] Skipping row ${lastRow + i}: invalid phone`);
        continue;
      }

      // VERIFICAÇÃO 4: Deduplicação em AMBAS as tabelas
      const { data: existeMeta } = await supabase
        .from('meta_form_leads')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();

      const { data: existeLead } = await supabase
        .from('leads_juridicos')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();

      if (existeMeta || existeLead) {
        console.log(`[Sheets Sync VendaCasada] Lead duplicado ignorado: ${telefone}`);
        duplicates++;
        continue;
      }

      // VERIFICAÇÃO 5: Inserção completa
      const { data: inserted, error: insertErr } = await supabase
        .from('meta_form_leads')
        .upsert({
          meta_lead_id: row[0] || `sheets_vc_${Date.now()}_${i}`,
          nome,
          telefone,
          created_time: row[1] || new Date().toISOString(),
          ad_id: row[2] || null,
          ad_name: row[3] || null,
          adset_id: row[4] || null,
          adset_name: row[5] || null,
          campaign_id: row[6] || null,
          campaign_name: row[7] || null,
          form_id: row[8] || null,
          source: 'google_sheets',
          status: 'novo',
          dedupe_key: `vc_${telefone}`,
          form_fields: {
            produto: row[12] || '',
            urgencia: row[13] || '',
            valor_cobrado: row[14] || '',
            tentou_resolver: row[15] || '',
            aposentado: row[16] || '',
            acesso_contrato: row[17] || '',
            documentos: row[18] || '',
          },
          raw: { planilha: 'venda_casada', row },
        }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle();

      if (insertErr) {
        if (insertErr.code === '23505') {
          console.log(`[Sheets Sync VendaCasada] Dedupe conflict: ${telefone}`);
          duplicates++;
        } else {
          console.error('[Sheets Sync VendaCasada] Insert error:', insertErr);
          errors++;
        }
        continue;
      }

      if (!inserted) {
        console.log(`[Sheets Sync VendaCasada] Upsert ignored (duplicate): ${telefone}`);
        duplicates++;
        continue;
      }

      newLeads++;

      const resumoIa = `Lead de Venda Casada\nProduto: ${row[12] || 'não informado'}\nUrgência: ${row[13] || 'não informado'}\nJá tentou resolver: ${row[15] || 'não informado'}\nAposentado: ${row[16] || 'não informado'}\nAcesso ao contrato: ${row[17] || 'não informado'}\nDocumentos: ${row[18] || 'não informado'}`;

      const { data: newLead } = await supabase
        .from('leads_juridicos')
        .insert({
          nome: nome || 'Lead Venda Casada',
          telefone,
          status: 'Lead Frio',
          lead_state: 'NEW',
          origem: 'Facebook',
          tipo_origem: 'trafego',
          fonte_trafego: 'facebook_lead_ads',
          canal_origem: row[11] === 'ig' ? 'instagram' : 'facebook',
          linha_whatsapp: 'trafego_isa',
          empresa_tag: 'bentes_ramos',
          owner_tipo: 'isa',
          isa_ativa: true,
          tipo_acao: 'Direito Bancário - Venda Casada',
          resumo_ia: resumoIa,
          facebook_lead_id: row[0] || null,
        })
        .select('id')
        .single();
      const leadId = newLead?.id || null;

      if (leadId && inserted?.id) {
        await supabase.from('meta_form_leads').update({ linked_lead_id: leadId }).eq('id', inserted.id);
      }

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

        // VERIFICAÇÃO 6: Mensagem automática Z-API
        try {
          const { data: zapiConfig } = await supabase
            .from('integrations_config')
            .select('config_json')
            .eq('provider', 'zapi_instances')
            .maybeSingle();

          if (zapiConfig?.config_json) {
            const instances = Array.isArray(zapiConfig.config_json) ? zapiConfig.config_json : zapiConfig.config_json.instances || [];
            const trafegoInstance = instances.find((inst: any) => inst.name === 'trafego_isa' || inst.label?.toLowerCase()?.includes('trafego'));

            if (trafegoInstance?.instance_id && trafegoInstance?.token) {
              const produto = row[12] || 'seu produto bancário';
              const mensagem = `Olá, ${nome}! 👋\n\nRecebemos seu cadastro e já estamos analisando seu caso sobre *${produto}*.\n\nNossa equipe especializada em direito bancário entrará em contato em breve para te ajudar a recuperar o que é seu por direito! ⚖️\n\nEnquanto isso, se tiver algum documento como extrato ou contrato, pode deixar separado — vai agilizar muito sua análise gratuita! 📄`;

              const zapiUrl = `https://api.z-api.io/instances/${trafegoInstance.instance_id}/token/${trafegoInstance.token}/send-text`;
              const zapiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
              if (trafegoInstance.client_token) zapiHeaders['Client-Token'] = trafegoInstance.client_token;

              const zapiRes = await fetch(zapiUrl, {
                method: 'POST',
                headers: zapiHeaders,
                body: JSON.stringify({ phone: telefone, message: mensagem }),
              });
              console.log(`[Sheets Sync VendaCasada] Z-API send: ${zapiRes.ok ? '✅' : '❌'} ${zapiRes.status}`);
            } else {
              console.log('[Sheets Sync VendaCasada] Z-API trafego instance not found');
            }
          }
        } catch (zapiErr) {
          console.error('[Sheets Sync VendaCasada] Z-API error (silent):', zapiErr);
        }

        // Trigger Isa first contact
        try {
          console.log(`[Sheets Sync VendaCasada] 🤖 Triggering Isa for lead ${leadId}`);
          const { error: isaError } = await supabase.functions.invoke('isa-auto-process', {
            body: {
              lead_id: leadId,
              mensagem: `Novo lead de Venda Casada (Google Sheets): ${nome || 'Sem nome'}. Telefone: ${telefone}. Produto: ${row[12] || 'N/A'}. Urgência: ${row[13] || 'N/A'}`,
              lead_state: 'NEW',
              canal: 'zapi',
              subscriber_id: subscriberId,
              subscriber_nome: nome || 'Lead',
              tipo_mensagem: 'text',
              is_first_contact: true,
            }
          });
          if (isaError) console.error('[Sheets Sync VendaCasada] Isa error:', isaError);
        } catch (isaErr) {
          console.error('[Sheets Sync VendaCasada] Error triggering Isa:', isaErr);
        }
      }

      console.log(`[Sheets Sync VendaCasada] Resultado linha ${lastRow + i}: INSERIDO ✅`);

    } catch (rowErr) {
      console.error(`[Sheets Sync VendaCasada] Row ${lastRow + i} error:`, rowErr);
      errors++;
    }
  }

  // Update sync state
  const newLastRow = allRows.length;
  await supabase.from('integrations_state').update({
    last_row: newLastRow,
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', stateId);

  await supabase.from('integration_logs').insert({
    provider: PROVIDER,
    direction: 'inbound',
    endpoint: `sheets/${SPREADSHEET_ID}`,
    status: errors > 0 ? 'partial' : 'success',
    payload_json: { last_row_before: lastRow, last_row_after: newLastRow, new_rows: newRows.length },
    response_json: { new_leads: newLeads, duplicates, errors },
  });

  console.log(`=== SYNC VENDA CASADA FINALIZADO: ${newLeads} inseridos, ${duplicates} duplicados, ${errors} erros ===`);
  return { new_leads: newLeads, duplicates, errors, total_linhas: allRows.length, ultima_linha: newLastRow };
}

// ── Main handler ──
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
    const body = await req.json().catch(() => ({}));
    const syncAll = body?.sync_all === true;

    // Always sync original sheet
    const originalResult = await syncOriginalSheet(supabase);

    // Sync Venda Casada sheet (always on sync_all, or by default too)
    let vendaCasadaResult = { new_leads: 0, duplicates: 0, errors: 0 };
    if (syncAll || !body?.sheet_only) {
      vendaCasadaResult = await syncVendaCasadaSheet(supabase);
    }

    const totalNew = originalResult.new_leads + vendaCasadaResult.new_leads;
    const totalDup = originalResult.duplicates + vendaCasadaResult.duplicates;
    const totalErr = originalResult.errors + vendaCasadaResult.errors;

    console.log(`[Sheets Sync] Total: ${totalNew} new, ${totalDup} dup, ${totalErr} err`);

    return new Response(JSON.stringify({
      success: true,
      new_leads: totalNew,
      duplicates: totalDup,
      errors: totalErr,
      original: originalResult,
      venda_casada: vendaCasadaResult,
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
