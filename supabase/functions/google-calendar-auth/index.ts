import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRM_URL = 'https://bentesramoscrm.com.br';
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-auth/callback`;

async function getGoogleCredentials(supabase: any) {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

  const s = (data || []).reduce((acc: any, item: any) => { acc[item.key] = item.value; return acc; }, {});
  return { clientId: s['GOOGLE_OAUTH_CLIENT_ID'] || null, clientSecret: s['GOOGLE_OAUTH_CLIENT_SECRET'] || null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const action = url.searchParams.get('action');

    console.log('[google-calendar-auth] Path:', pathname, '| Action:', action);

    const { clientId, clientSecret } = await getGoogleCredentials(supabase);

    // ═══════════════════════════════════════════════════════════════════════
    // CALLBACK — Google redireciona aqui após o usuário autorizar
    // ═══════════════════════════════════════════════════════════════════════
    if (pathname.endsWith('/callback')) {
      const code  = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const state = url.searchParams.get('state'); // user_id

      console.log('[callback] code:', code ? 'present' : 'missing', '| error:', error, '| state:', state);

      if (error) {
        return Response.redirect(`${CRM_URL}/google-auth-callback?google_auth=error&reason=${encodeURIComponent(error)}`, 302);
      }

      if (!code) {
        return Response.redirect(`${CRM_URL}/google-auth-callback?google_auth=error&reason=no_code`, 302);
      }

      if (!clientId || !clientSecret) {
        return Response.redirect(`${CRM_URL}/google-auth-callback?google_auth=error&reason=no_credentials`, 302);
      }

      // Trocar code por tokens
      console.log('[callback] Exchanging code for tokens...');
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     clientId,
          client_secret: clientSecret,
          redirect_uri:  REDIRECT_URI,
          grant_type:    'authorization_code',
        }),
      });

      const tokens = await tokenRes.json();
      console.log('[callback] Token exchange:', tokenRes.ok ? 'success' : 'failed', tokens.error || '');

      if (!tokenRes.ok) {
        return Response.redirect(`${CRM_URL}/google-auth-callback?google_auth=error&reason=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`, 302);
      }

      // Salvar tokens diretamente no banco usando service role
      if (state) {
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
        const { error: dbErr } = await supabase
          .from('google_calendar_tokens')
          .upsert({
            user_id:       state,
            access_token:  tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            expires_at:    expiresAt,
          }, { onConflict: 'user_id' });

        if (dbErr) {
          console.error('[callback] Error saving tokens:', dbErr);
          return Response.redirect(`${CRM_URL}/google-auth-callback?google_auth=error&reason=db_error`, 302);
        }
        console.log('[callback] Tokens saved to DB for user:', state);
      }

      return Response.redirect(`${CRM_URL}/google-auth-callback?google_auth=success`, 302);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET AUTH URL
    // ═══════════════════════════════════════════════════════════════════════
    if (action === 'get_auth_url') {
      if (!clientId) {
        return new Response(JSON.stringify({
          error: 'Google OAuth não configurado. Configure as credenciais em Configurações > Integrações.'
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Extrair user_id do JWT de autorização
      let userId = '';
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        try {
          const jwt = authHeader.replace('Bearer ', '');
          const { data } = await supabase.auth.getUser(jwt);
          userId = data.user?.id || '';
        } catch {}
      }

      console.log('[get_auth_url] userId:', userId, '| redirect_uri:', REDIRECT_URI);

      const scope = 'https://www.googleapis.com/auth/calendar.events';
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(userId)}`;

      return new Response(JSON.stringify({ authUrl, redirect_uri: REDIRECT_URI }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REFRESH TOKEN
    // ═══════════════════════════════════════════════════════════════════════
    if (req.method === 'POST') {
      const body = await req.json();
      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return new Response(JSON.stringify({ error: 'refresh_token não fornecido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id:     clientId,
          client_secret: clientSecret,
          grant_type:    'refresh_token',
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: tokens.error_description || 'Falha ao renovar token' }), {
          status: tokenRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(tokens), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[google-calendar-auth] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
