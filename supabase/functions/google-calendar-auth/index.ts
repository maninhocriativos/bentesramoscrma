import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// IMPORTANT: The redirect_uri MUST match exactly what's registered in Google Cloud Console
// Register this URL in Google Cloud Console: https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/google-calendar-auth/callback
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-auth/callback`;

// Helper function to get Google credentials from app_settings
async function getGoogleCredentials(supabase: any): Promise<{ clientId: string | null; clientSecret: string | null }> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);

  if (error) {
    console.error('Error fetching Google credentials:', error);
    return { clientId: null, clientSecret: null };
  }

  const settings = data.reduce((acc: Record<string, string>, item: { key: string; value: string }) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  return {
    clientId: settings['GOOGLE_OAUTH_CLIENT_ID'] || null,
    clientSecret: settings['GOOGLE_OAUTH_CLIENT_SECRET'] || null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const action = url.searchParams.get('action');

    console.log('Google Calendar Auth - Path:', pathname, 'Action:', action);

    // Get credentials from database
    const { clientId, clientSecret } = await getGoogleCredentials(supabase);

    // Handle OAuth callback via path (Google redirects here)
    // Path: /functions/v1/google-calendar-auth/callback
    if (pathname.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      console.log('OAuth callback - code:', code ? 'present' : 'missing', 'error:', error);

      if (error) {
        console.error('OAuth error:', error);
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-oauth-error', error: '${error}' }, '*');
      setTimeout(function() { window.close(); }, 1000);
    </script>
    <p>Erro na autenticação. Esta janela pode ser fechada.</p>
  </body>
</html>`, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }

      if (!code) {
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-oauth-error', error: 'Código não encontrado' }, '*');
      setTimeout(function() { window.close(); }, 1000);
    </script>
    <p>Código de autorização não encontrado.</p>
  </body>
</html>`, {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }

      if (!clientId || !clientSecret) {
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-oauth-error', error: 'Credenciais não configuradas' }, '*');
      setTimeout(function() { window.close(); }, 1000);
    </script>
    <p>Credenciais não configuradas.</p>
  </body>
</html>`, {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }

      // Exchange code for tokens - MUST use exact same redirect_uri
      console.log('Exchanging code for tokens with redirect_uri:', REDIRECT_URI);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      console.log('Token exchange result:', tokenResponse.ok ? 'success' : 'failed', tokens.error || '');

      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokens);
        return new Response(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Erro</title></head>
  <body>
    <script>
      window.opener?.postMessage({ type: 'google-oauth-error', error: 'Falha ao obter tokens: ${tokens.error_description || tokens.error || 'unknown'}' }, '*');
      setTimeout(function() { window.close(); }, 1000);
    </script>
    <p>Falha ao obter tokens.</p>
  </body>
</html>`, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }

      const successHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Google Calendar Conectado</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; }
      .container { text-align: center; padding: 2rem; }
      .icon { font-size: 4rem; margin-bottom: 1rem; }
      h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
      p { color: #94a3b8; font-size: 0.875rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon">✓</div>
      <h1>Google Calendar Conectado!</h1>
      <p>Esta janela será fechada automaticamente...</p>
    </div>
    <script>
      (function() {
        try {
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'google-oauth-success', 
              tokens: ${JSON.stringify(tokens)}
            }, '*');
          }
        } catch (e) {
          console.error('PostMessage error:', e);
        }
        setTimeout(function() { window.close(); }, 1500);
      })();
    </script>
  </body>
</html>`;

      return new Response(successHtml, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Get authorization URL for OAuth flow
    if (action === 'get_auth_url') {
      if (!clientId) {
        return new Response(JSON.stringify({ 
          error: 'Google OAuth não configurado. Configure as credenciais em Configurações > Integrações.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const scope = 'https://www.googleapis.com/auth/calendar.events';
      
      console.log('Generating auth URL with redirect_uri:', REDIRECT_URI);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent`;

      return new Response(JSON.stringify({ authUrl, redirect_uri: REDIRECT_URI }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token - handle both GET query param and POST body
    if (action === 'refresh' || req.method === 'POST') {
      let refreshToken: string | null = null;
      
      if (req.method === 'POST') {
        const body = await req.json();
        if (body.action === 'refresh') {
          refreshToken = body.refresh_token;
        } else {
          refreshToken = body.refresh_token;
        }
      }

      if (!refreshToken) {
        return new Response(JSON.stringify({ error: 'refresh_token não fornecido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token refresh error:', tokens);
        return new Response(JSON.stringify({ error: tokens.error_description || 'Falha ao renovar token' }), {
          status: tokenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(tokens), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in google-calendar-auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});