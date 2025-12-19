import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log('Google Calendar Auth - Action:', action);

    // Get authorization URL for OAuth flow
    if (action === 'get_auth_url') {
      if (!GOOGLE_CLIENT_ID) {
        return new Response(JSON.stringify({ 
          error: 'Google OAuth não configurado. Configure GOOGLE_CLIENT_ID.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`;
      const scope = 'https://www.googleapis.com/auth/calendar';
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle OAuth callback
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'google-oauth-error', error: '${error}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      if (!code) {
        return new Response('Código de autorização não encontrado', { status: 400 });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth?action=callback`;
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      console.log('Token exchange result:', tokenResponse.ok ? 'success' : 'failed');

      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokens);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'google-oauth-error', error: 'Falha ao obter tokens' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      return new Response(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'google-oauth-success', 
                tokens: ${JSON.stringify(tokens)}
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Refresh token
    if (action === 'refresh') {
      const { refresh_token } = await req.json();

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await tokenResponse.json();

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
