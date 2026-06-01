import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ZAPSIGN_BASE = 'https://api.zapsign.com.br/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Webhook endpoint
  if (req.url.includes('/webhook') && req.method === 'POST') {
    try {
      const body = await req.json();
      await handleWebhook(body);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: msg }), {
        headers: { 'Content-Type': 'application/json' }, status: 400,
      });
    }
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    const token = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!token) throw new Error('ZAPSIGN_API_TOKEN não configurado');

    let result: any;
    switch (action) {
      case 'list_documents':  result = await listDocuments(token, params);  break;
      case 'get_document':    result = await getDocument(token, params);    break;
      case 'create_document': result = await createDocument(token, params); break;
      case 'create_envelope': result = await createEnvelope(token, params); break;
      case 'cancel_document': result = await cancelDocument(token, params); break;
      case 'get_sign_url':    result = await getSignUrl(token, params);     break;
      default: throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Zapsign]', message);
    return new Response(
      JSON.stringify({ error: { code: 'ZAPSIGN_ERROR', message } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function zapsignFetch(token: string, path: string, method = 'GET', body?: any) {
  const url = `${ZAPSIGN_BASE}${path}`;
  console.log(`[Zapsign] ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: authHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.detail || data?.message || data?.non_field_errors?.[0] || text || 'Erro na API Zapsign';
    console.error(`[Zapsign] ${res.status}: ${msg}`);
    throw new Error(`Zapsign ${res.status}: ${msg}`);
  }

  return data;
}

function buildSigners(signers: any[]) {
  return signers.map((s: any) => ({
    name:  s.name,
    email: s.email || undefined,
    phone_country: s.phone ? '55' : undefined,
    phone_number:  s.phone ? s.phone.replace(/\D/g, '').slice(-11) : undefined,
    cpf:   s.cpf || undefined,
    auth_mode: 'assinaturaTela',
    send_automatic_email: true,
  }));
}

function normalizeDoc(doc: any) {
  const signers = (doc.signers || []).map((s: any) => ({
    id:        s.token || s.id,
    name:      s.name,
    email:     s.email,
    status:    s.signed_at ? 'signed' : 'pending',
    signed_at: s.signed_at || null,
    sign_url:  s.sign_url || null,
  }));
  return {
    id:         doc.token || doc.id,
    name:       doc.name,
    status:     doc.deleted ? 'cancelled' : doc.signed ? 'signed' : 'pending',
    created_at: doc.created_at,
    updated_at: doc.last_update_date || doc.updated_at || doc.created_at,
    expires_at: doc.expiration_date || null,
    signers,
  };
}

// ── Ações ─────────────────────────────────────────────────────────────────────

async function listDocuments(token: string, params: any) {
  const { page = 1, per_page = 20 } = params;
  const offset = (page - 1) * per_page;
  const data = await zapsignFetch(token, `/docs/?limit=${per_page}&offset=${offset}`);
  const docs = data.results || data.documents || (Array.isArray(data) ? data : []);
  return {
    documents: docs.map(normalizeDoc),
    total: data.count || docs.length,
    page,
    per_page,
  };
}

async function getDocument(token: string, params: any) {
  const { document_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');
  const data = await zapsignFetch(token, `/docs/${document_id}/`);
  return normalizeDoc(data);
}

async function createDocument(token: string, params: any) {
  const { name, signers, file_url, expires_in_days } = params;
  if (!name || !signers?.length || !file_url) {
    throw new Error('name, signers e file_url são obrigatórios');
  }
  const body: any = {
    name,
    url_pdf: file_url,
    signers: buildSigners(signers),
    expires_in_days: expires_in_days || 7,
  };
  const data = await zapsignFetch(token, '/docs/', 'POST', body);
  return normalizeDoc(data);
}

// Envelope: múltiplos docs em um link (via extra-docs)
async function createEnvelope(token: string, params: any) {
  const { docs, signers, expires_in_days } = params;
  // docs = [{ name, file_url }, ...]
  if (!docs?.length || !signers?.length) {
    throw new Error('docs e signers são obrigatórios');
  }

  const results: any[] = [];

  for (let i = 0; i < docs.length; i++) {
    const { name, file_url } = docs[i];
    const body = {
      name,
      url_pdf: file_url,
      signers: buildSigners(signers.map((s: any) => ({
        ...s,
        send_automatic_email: i === 0,
      }))),
      expires_in_days: expires_in_days || 7,
    };
    const data = await zapsignFetch(token, '/docs/', 'POST', body);
    results.push(normalizeDoc(data));

    if (i > 0 && results[0]?.id) {
      try {
        await zapsignFetch(token, `/docs/${results[0].id}/extra-docs/`, 'POST', {
          name,
          doc_token: results[i].id,
        });
      } catch (e) {
        console.warn(`[Zapsign] Falha ao anexar extra-doc: ${e}`);
      }
    }
  }

  return {
    ...results[0],
    envelope_docs: results,
    total_docs: results.length,
  };
}

async function cancelDocument(token: string, params: any) {
  const { document_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');
  await zapsignFetch(token, `/docs/${document_id}/`, 'DELETE');
  return { success: true };
}

async function getSignUrl(token: string, params: any) {
  const { document_id, signer_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');
  const data = await getDocument(token, { document_id });
  const signer = signer_id ? data.signers?.find((s: any) => s.id === signer_id) : data.signers?.[0];
  return { sign_url: signer?.sign_url || null };
}

// ── Webhook ───────────────────────────────────────────────────────────────────

async function handleWebhook(payload: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const docToken = payload.token || payload.document_id;
  const event    = payload.event_action || payload.event || '';
  if (!docToken) return;

  console.log(`[Zapsign Webhook] event=${event} doc=${docToken}`);

  if (event.includes('signed') || payload.signed) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'signed', signed_at: new Date().toISOString() })
      .eq('document_id', docToken);

    const { data: contract } = await supabase.from('contract_reminders_zapsign')
      .select('lead_id').eq('document_id', docToken).maybeSingle();
    if (contract?.lead_id) {
      await supabase.from('leads_juridicos')
        .update({ status: 'Contrato Assinado' }).eq('id', contract.lead_id);
    }
  } else if (event.includes('deleted') || event.includes('cancelled')) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'cancelled' }).eq('document_id', docToken);
  } else if (event.includes('expired')) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'expired' }).eq('document_id', docToken);
  }
}
