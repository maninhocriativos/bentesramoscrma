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
      case 'list_documents':       result = await listDocuments(token, params);       break;
      case 'get_document':         result = await getDocument(token, params);        break;
      case 'create_document':      result = await createDocument(token, params);     break;
      case 'create_from_template': result = await createFromMarkdown(token, params); break;
      case 'create_envelope':      result = await createEnvelope(token, params);     break;
      case 'cancel_document':      result = await cancelDocument(token, params);     break;
      case 'get_sign_url':         result = await getSignUrl(token, params);         break;
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

// ── Conversão .docx → PDF (CloudConvert) ──────────────────────────────────────
// Garante fidelidade total ao layout do escritório (cabeçalho/rodapé/logo),
// que a conversão interna da Zapsign descarta. Recebe base64 do .docx e
// devolve base64 do PDF.
async function convertDocxToPdf(base64Docx: string): Promise<string> {
  const ccToken = Deno.env.get('CLOUDCONVERT_API_KEY');
  if (!ccToken) {
    throw new Error('CLOUDCONVERT_API_KEY não configurado — necessário para converter .docx em PDF');
  }

  const ccHeaders = {
    'Authorization': `Bearer ${ccToken}`,
    'Content-Type': 'application/json',
  };

  // 1) Cria job com import(base64) → convert(pdf) → export(url)
  const jobResp = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: ccHeaders,
    body: JSON.stringify({
      tasks: {
        'import-doc': { operation: 'import/base64', file: base64Docx, filename: 'documento.docx' },
        'convert-doc': { operation: 'convert', input: 'import-doc', input_format: 'docx', output_format: 'pdf' },
        'export-doc': { operation: 'export/url', input: 'convert-doc' },
      },
    }),
  });
  const jobData = await jobResp.json();
  if (!jobResp.ok) {
    throw new Error(`CloudConvert job: ${JSON.stringify(jobData).slice(0, 300)}`);
  }
  const jobId = jobData?.data?.id;
  if (!jobId) throw new Error('CloudConvert: job sem id');

  // 2) Aguarda o job concluir (endpoint síncrono /wait)
  const waitResp = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}/wait`, {
    headers: ccHeaders,
    signal: AbortSignal.timeout(90000),
  });
  const waitData = await waitResp.json();
  if (!waitResp.ok || waitData?.data?.status !== 'finished') {
    throw new Error(`CloudConvert wait: ${JSON.stringify(waitData).slice(0, 300)}`);
  }

  // 3) URL do PDF exportado
  const exportTask = (waitData.data.tasks || []).find(
    (t: any) => t.operation === 'export/url' && t.status === 'finished',
  );
  const fileUrl = exportTask?.result?.files?.[0]?.url;
  if (!fileUrl) throw new Error('CloudConvert: PDF não disponível no export');

  // 4) Baixa o PDF e converte para base64
  const pdfResp = await fetch(fileUrl, { signal: AbortSignal.timeout(60000) });
  const pdfBuffer = new Uint8Array(await pdfResp.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < pdfBuffer.length; i += chunk) {
    binary += String.fromCharCode(...pdfBuffer.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  // O ZapSign indica o status de formas diferentes conforme o endpoint:
  //  • string `status` ("signed" / "pending" / "refused") — vem na listagem
  //  • booleano `signed` — vem em alguns detalhes
  //  • `signed_at` em cada signatário — sinal mais confiável
  // Antes só líamos o booleano `doc.signed`, que NÃO vem na listagem → tudo
  // aparecia como "pending" (0 assinados). Agora cobrimos as 3 formas.
  const rawStatus = String(doc.status ?? '').toLowerCase();
  const allSignersSigned = signers.length > 0 && signers.every((s) => s.status === 'signed');
  const isCancelled = doc.deleted === true ||
    ['refused', 'cancelled', 'canceled', 'rejected'].includes(rawStatus);
  const isSigned = !isCancelled &&
    (doc.signed === true || rawStatus === 'signed' || allSignersSigned);

  return {
    id:         doc.token || doc.id,
    name:       doc.name,
    status:     isCancelled ? 'cancelled' : isSigned ? 'signed' : 'pending',
    created_at: doc.created_at,
    updated_at: doc.last_update_date || doc.updated_at || doc.created_at,
    expires_at: doc.expiration_date || null,
    signers,
  };
}

// ── Ações ─────────────────────────────────────────────────────────────────────

async function listDocuments(token: string, _params: any) {
  // ATENÇÃO: o ZapSign pagina com ?page=N (estilo DRF, ~25 por página) e IGNORA
  // limit/offset. Antes líamos só a 1ª página → documentos assinados em páginas
  // seguintes NUNCA apareciam. Agora percorremos TODAS as páginas.
  const raw: any[] = [];
  let page = 1;
  let count = Infinity;
  const MAX_PAGES = 60; // trava de segurança
  while (raw.length < count && page <= MAX_PAGES) {
    const data = await zapsignFetch(token, `/docs/?page=${page}`);
    const docs = data.results || data.documents || (Array.isArray(data) ? data : []);
    if (typeof data.count === 'number') count = data.count;
    if (!docs.length) break;
    raw.push(...docs);
    if (!data.next) break;
    page++;
  }

  // A listagem NÃO traz os signatários (signers: []). Para saber o status REAL
  // (assinado), buscamos o DETALHE de cada documento (que traz signed_at de cada
  // signatário). Feito em lotes para não estourar o rate limit da API.
  const BATCH = 8;
  const enriched: any[] = [];
  for (let i = 0; i < raw.length; i += BATCH) {
    const slice = raw.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (d: any) => {
        const tk = d.token || d.id;
        if (!tk) return normalizeDoc(d);
        try {
          const full = await zapsignFetch(token, `/docs/${tk}/`);
          return normalizeDoc(full);
        } catch (e) {
          console.warn(`[Zapsign] detalhe falhou p/ ${tk}: ${e}`);
          return normalizeDoc(d); // fallback para o resumo
        }
      }),
    );
    enriched.push(...results);
  }

  return {
    documents: enriched,
    total: count === Infinity ? raw.length : count,
    page: 1,
    per_page: enriched.length,
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

// Criar documento a partir de markdown, HTML ou .docx (base64)
async function createFromMarkdown(token: string, params: any) {
  const { name, markdown_text, html_text, base64_docx, signers, expires_in_days } = params;
  if (!name || (!markdown_text && !html_text && !base64_docx) || !signers?.length) {
    throw new Error('name, (markdown_text, html_text ou base64_docx) e signers são obrigatórios');
  }
  const body: any = {
    name,
    signers: buildSigners(signers),
    expires_in_days: expires_in_days || 7,
  };

  // Prioridade: .docx (layout exato) → convertido p/ PDF via CloudConvert > HTML > markdown
  if (base64_docx) {
    console.log('[Zapsign] Convertendo .docx → PDF (CloudConvert)');
    body.base64_pdf = await convertDocxToPdf(base64_docx);
  } else if (html_text) {
    body.html_text = html_text;
  } else if (markdown_text) {
    body.markdown_text = markdown_text;
  }

  const data = await zapsignFetch(token, '/docs/', 'POST', body);
  return normalizeDoc(data);
}

// Envelope: múltiplos docs em UM único link de assinatura.
// O 1º documento é o principal (POST /docs/). Os demais são anexados a ele
// como documentos extras (POST /docs/{token}/upload-extra-doc/), que herdam
// os signatários e ficam no mesmo link. A Zapsign aceita só PDF no extra-doc,
// então convertemos cada .docx em PDF antes (CloudConvert).
async function createEnvelope(token: string, params: any) {
  const { docs, signers, expires_in_days } = params;
  // docs = [{ name, base64_docx | html_text | markdown_text }, ...]
  if (!docs?.length || !signers?.length) {
    throw new Error('docs e signers são obrigatórios');
  }

  // Converte todos os .docx em PDF (base64) de uma vez
  const pdfs: { name: string; base64_pdf?: string; html_text?: string; markdown_text?: string }[] = [];
  for (const d of docs) {
    if (d.base64_docx) {
      console.log(`[Zapsign] Envelope: convertendo "${d.name}" .docx → PDF`);
      pdfs.push({ name: d.name, base64_pdf: await convertDocxToPdf(d.base64_docx) });
    } else {
      pdfs.push({ name: d.name, html_text: d.html_text, markdown_text: d.markdown_text });
    }
  }

  // 1) Documento principal
  const mainBody: any = {
    name: pdfs[0].name,
    signers: buildSigners(signers),
    expires_in_days: expires_in_days || 7,
  };
  if (pdfs[0].base64_pdf) mainBody.base64_pdf = pdfs[0].base64_pdf;
  else if (pdfs[0].html_text) mainBody.html_text = pdfs[0].html_text;
  else if (pdfs[0].markdown_text) mainBody.markdown_text = pdfs[0].markdown_text;

  const mainDoc = normalizeDoc(await zapsignFetch(token, '/docs/', 'POST', mainBody));
  const results: any[] = [mainDoc];

  // 2) Documentos extras anexados ao principal (mesmo link)
  for (let i = 1; i < pdfs.length; i++) {
    if (!pdfs[i].base64_pdf) {
      console.warn(`[Zapsign] Extra "${pdfs[i].name}" ignorado: upload-extra-doc só aceita PDF`);
      continue;
    }
    try {
      const extra = await zapsignFetch(token, `/docs/${mainDoc.id}/upload-extra-doc/`, 'POST', {
        name: pdfs[i].name,
        base64_pdf: pdfs[i].base64_pdf,
      });
      results.push(normalizeDoc(extra));
    } catch (e) {
      console.warn(`[Zapsign] Falha ao anexar extra-doc "${pdfs[i].name}": ${e}`);
    }
  }

  return {
    ...mainDoc,
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
  // ZapSign envia o token do documento no topo do payload; o evento vem em
  // event_type (ex.: "doc_signed"), com fallback para outros formatos.
  const docToken = payload.token || payload.document_id || payload.doc_token || payload.doc?.token;
  const event    = String(payload.event_type || payload.event_action || payload.event || '').toLowerCase();
  const status   = String(payload.status || payload.doc?.status || '').toLowerCase();
  if (!docToken) {
    console.warn('[Zapsign Webhook] payload sem token de documento', JSON.stringify(payload).slice(0, 300));
    return;
  }

  console.log(`[Zapsign Webhook] event=${event} status=${status} doc=${docToken}`);

  const isSigned    = event.includes('signed') || payload.signed === true || status === 'signed';
  const isCancelled = event.includes('deleted') || event.includes('cancel') || status === 'cancelled';
  const isExpired   = event.includes('expired') || status === 'expired';

  if (isSigned) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'signed', signed_at: new Date().toISOString() })
      .eq('document_id', docToken);

    const { data: contract } = await supabase.from('contract_reminders_zapsign')
      .select('lead_id').eq('document_id', docToken).maybeSingle();
    if (contract?.lead_id) {
      await supabase.from('leads_juridicos')
        .update({ status: 'Contrato Assinado' }).eq('id', contract.lead_id);
    }
  } else if (isCancelled) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'cancelled' }).eq('document_id', docToken);
  } else if (isExpired) {
    await supabase.from('contract_reminders_zapsign')
      .update({ status: 'expired' }).eq('document_id', docToken);
  }
}
