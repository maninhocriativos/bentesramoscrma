const serve = Deno.serve;
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let n = phone.replace(/\D/g, '');
  if (n.startsWith('0')) n = n.slice(1);
  if (!n.startsWith('55')) n = '55' + n;
  return n;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIXEL_ID    = Deno.env.get('META_PIXEL_ID');
    const ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    const CRM_SOURCE  = Deno.env.get('META_LEAD_EVENT_SOURCE') || 'Bentes Ramos CRM';



    const body = await req.json();
    const {
      lead_id,
      facebook_lead_id,
      email,
      phone,
      nome,
      event_name   = 'Purchase',
      value        = 0,
      status,
      tipo_contrato,
      quantidade_contratos = 1,
      lead_event_source,
      pixel_id:     bodyPixelId,
      access_token: bodyAccessToken,
    } = body;

    const PIXEL_ID_FINAL    = bodyPixelId    || PIXEL_ID;
    const ACCESS_TOKEN_FINAL = bodyAccessToken || ACCESS_TOKEN;

    if (!PIXEL_ID_FINAL || !ACCESS_TOKEN_FINAL) {
      return new Response(
        JSON.stringify({ error: 'pixel_id ou access_token não fornecidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Meta CAPI] Disparando evento:', { event_name, lead_id, hasEmail: !!email, hasPhone: !!phone });

    // ── user_data: campos como arrays conforme especificação Meta CAPI ────────
    const userData: Record<string, unknown> = {};

    if (facebook_lead_id) {
      // lead_id no user_data deve ser numérico (Facebook Lead ID)
      const numericId = typeof facebook_lead_id === 'string'
        ? parseInt(facebook_lead_id, 10)
        : facebook_lead_id;
      if (!isNaN(numericId)) userData.lead_id = numericId;
    }

    if (email) {
      const norm = email.toLowerCase().trim();
      userData.em = [await sha256(norm)];
    }

    if (phone) {
      const norm = normalizePhone(phone);
      if (norm) userData.ph = [await sha256(norm)];
    }

    if (nome) {
      const parts = nome.trim().split(/\s+/);
      const fn = parts[0]?.toLowerCase();
      const ln = parts.slice(1).join(' ').toLowerCase();
      if (fn) userData.fn = [await sha256(fn)];
      if (ln) userData.ln = [await sha256(ln)];
    }

    if (Object.keys(userData).length === 0) {
      console.warn('[Meta CAPI] Nenhum dado de usuário disponível — abortando');
      return new Response(
        JSON.stringify({ success: false, warning: 'Sem dados para matching (email, telefone ou lead_id)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Payload final ─────────────────────────────────────────────────────────
    const eventPayload = {
      data: [
        {
          event_name,
          event_time:    Math.floor(Date.now() / 1000),
          action_source: 'system_generated',
          user_data:     userData,
          custom_data: {
            currency:          'BRL',
            value:             parseFloat(String(value)) || 0,
            event_source:      'crm',
            lead_event_source: lead_event_source || CRM_SOURCE,
            lead_status:       status        || null,
            tipo_contrato:     tipo_contrato  || null,
            num_contratos:     quantidade_contratos,
            internal_lead_id:  lead_id        || null,
          },
        },
      ],
      access_token: ACCESS_TOKEN_FINAL,
    };

    console.log('[Meta CAPI] Payload pronto:', {
      event_name,
      pixel_id: PIXEL_ID_FINAL,
      user_data_fields: Object.keys(userData),
      value: eventPayload.data[0].custom_data.value,
    });

    const metaRes = await fetch(
      `https://graph.facebook.com/v25.0/${PIXEL_ID_FINAL}/events`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(eventPayload),
      }
    );

    const metaResult = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[Meta CAPI] Erro da API Meta:', metaResult);
      return new Response(
        JSON.stringify({ success: false, error: metaResult.error?.message, details: metaResult }),
        { status: metaRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Meta CAPI] Evento enviado com sucesso:', metaResult);

    // ── Log no banco ──────────────────────────────────────────────────────────
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('integration_logs').insert({
        provider:      'meta_capi',
        direction:     'outbound',
        endpoint:      `https://graph.facebook.com/v25.0/${PIXEL_ID_FINAL}/events`,
        status:        'success',
        lead_id:       lead_id || null,
        payload_json:  { event_name, value, status, tipo_contrato, user_data_fields: Object.keys(userData) },
        response_json: metaResult,
      });
    } catch (logErr) {
      console.warn('[Meta CAPI] Falha ao gravar log:', logErr);
    }

    return new Response(
      JSON.stringify({ success: true, events_received: metaResult.events_received, fbtrace_id: metaResult.fbtrace_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[Meta CAPI] Erro inesperado:', err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
