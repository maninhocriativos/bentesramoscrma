import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// URL base correta da API Zapsign (v1)
const ZAPSIGN_BASE = 'https://api.zapsign.com.br/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Webhook endpoint — POST /zapsign/webhook
  if (req.url.includes('/webhook') && req.method === 'POST') {
    try {
      const body = await req.json();
      const signature = req.headers.get('X-Zapsign-Signature');
      await handleZapsignWebhook(body, signature);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: msg }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  }

  try {
    const { action, ...params } = await req.json();

    const token = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!token) throw new Error('ZAPSIGN_API_TOKEN não configurado nos secrets');

    let result;
    switch (action) {
      case 'list_documents':   result = await listDocuments(token, params);   break;
      case 'get_document':     result = await getDocument(token, params);     break;
      case 'create_document':  result = await createDocument(token, params);  break;
      case 'cancel_document':  result = await cancelDocument(token, params);  break;
      case 'get_sign_url':     result = await getSignUrl(token, params);      break;
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function headers(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function zapsignFetch(token: string, path: string, method = 'GET', body?: any) {
  const url = `${ZAPSIGN_BASE}${path}`;
  console.log(`[Zapsign] ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.detail || data?.message || data?.non_field_errors?.[0] || text || 'Erro na API Zapsign';
    console.error(`[Zapsign] ${res.status} ${url}: ${msg}`);
    throw new Error(`Zapsign ${res.status}: ${msg}`);
  }

  return data;
}

// ── Ações ─────────────────────────────────────────────────────────────────────

async function listDocuments(token: string, params: any) {
  const page     = params.page     || 1;
  const per_page = params.per_page || 20;
  // Zapsign usa offset-based pagination
  const offset = (page - 1) * per_page;
  const data = await zapsignFetch(token, `/docs/?limit=${per_page}&offset=${offset}`);

  // Normalizar resposta
  const docs = data.results || data.documents || data || [];
  return {
    documents: Array.isArray(docs) ? docs.map(normalizeDoc) : [],
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
  const { name, signers, file_url, expires_in_days, metadata } = params;

  if (!name)             throw new Error('name é obrigatório');
  if (!signers?.length)  throw new Error('signers é obrigatório');
  if (!file_url)         throw new Error('file_url é obrigatório');

  // Montar body conforme docs Zapsign
  const body: any = {
    name,
    url_pdf: file_url,           // campo correto: url_pdf (não file_url)
    signers: signers.map((s: any) => ({
      name:  s.name,
      email: s.email || undefined,
      // Telefone: separar DDI e número
      phone_country: s.phone ? '55' : undefined,
      phone_number:  s.phone ? s.phone.replace(/\D/g, '').slice(-11) : undefined,
      cpf: s.cpf || undefined,
      auth_mode: 'assinaturaTela',   // assinatura por tela (padrão/mais simples)
      send_automatic_email: true,
      lock_email: false,
    })),
  };

  if (expires_in_days) body.expires_in_days = expires_in_days;
  if (metadata?.lead_id) body.external_id = metadata.lead_id;

  const data = await zapsignFetch(token, '/docs/', 'POST', body);
  return normalizeDoc(data);
}

async function cancelDocument(token: string, params: any) {
  const { document_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');
  // Zapsign usa DELETE para cancelar documento
  await zapsignFetch(token, `/docs/${document_id}/`, 'DELETE');
  return { success: true };
}

async function getSignUrl(token: string, params: any) {
  const { document_id, signer_id } = params;
  if (!document_id) throw new Error('document_id é obrigatório');

  // Se tiver signer_id, buscar URL específica; senão buscar o documento
  const data = await getDocument(token, { document_id });
  const signer = signer_id
    ? data.signers?.find((s: any) => s.id === signer_id)
    : data.signers?.[0];

  const sign_url = signer?.sign_url || signer?.token || null;
  return { sign_url };
}

// ── Normalizar documento da API para formato interno ──────────────────────────

function normalizeDoc(doc: any) {
  const signers = (doc.signers || []).map((s: any) => ({
    id:        s.token || s.id,
    name:      s.name,
    email:     s.email,
    phone:     s.phone_number ? `55${s.phone_number}` : undefined,
    status:    mapSignerStatus(s),
    signed_at: s.signed_at || null,
    sign_url:  s.sign_url || null,
  }));

  return {
    id:         doc.token || doc.id,
    name:       doc.name,
    status:     mapDocStatus(doc),
    created_at: doc.created_at,
    updated_at: doc.last_update_date || doc.updated_at || doc.created_at,
    expires_at: doc.expiration_date || null,
    signers,
  };
}

function mapDocStatus(doc: any): string {
  if (doc.deleted)  return 'cancelled';
  if (doc.signed)   return 'signed';
  const status = doc.status?.toLowerCase() || '';
  if (status === 'pending')  return 'pending';
  if (status === 'signed')   return 'signed';
  if (status === 'deleted')  return 'cancelled';
  if (status === 'expired')  return 'expired';
  return 'pending';
}

function mapSignerStatus(signer: any): string {
  if (signer.signed_at || signer.status?.toLowerCase() === 'signed') return 'signed';
  return 'pending';
}

// ── Webhook handlers ──────────────────────────────────────────────────────────

async function handleZapsignWebhook(payload: any, _signature: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase credentials');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Zapsign envia o objeto do documento diretamente no webhook
  const docToken = payload.token || payload.document_id;
  const event    = payload.event_action || payload.event || '';

  console.log(`[Zapsign Webhook] event=${event} doc=${docToken}`);

  if (!docToken) return;

  if (event.includes('signed') || payload.signed) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'signed', signed_at: new Date().toISOString() })
      .eq('document_id', docToken);

    // Atualizar lead
    const { data: contract } = await supabase.from('contract_reminders_zapsign')
      .select('lead_id').eq('document_id', docToken).maybeSingle();
    if (contract?.lead_id) {
      await supabase.from('leads_juridicos')
        .update({ status: 'Contrato Assinado' })
        .eq('id', contract.lead_id);
    }
  } else if (event.includes('deleted') || event.includes('cancelled')) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'cancelled' })
      .eq('document_id', docToken);
  } else if (event.includes('expired')) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'expired' })
      .eq('document_id', docToken);
  }
}
