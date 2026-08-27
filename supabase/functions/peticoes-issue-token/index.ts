import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT } from 'npm:jose@6';

// Emite um token de curta duração pro módulo de Petições (Cloudflare Worker,
// fora do Supabase). Não usa o JWT Secret mestre do Supabase (esse autentica
// TODO o CRM — vazar ele permite forjar login de qualquer usuário no sistema
// inteiro). Em vez disso: confirma quem é o usuário do jeito que o Supabase já
// faz sozinho (auth.getUser), e assina um token novo, curto, com um secret
// próprio deste módulo (PETICOES_TOKEN_SECRET) — se esse vazar, o estrago
// fica contido só nas petições.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TOKEN_SECRET = Deno.env.get('PETICOES_TOKEN_SECRET')!;
const TOKEN_TTL_SECONDS = 5 * 60; // 5 min — só o tempo de fazer as chamadas ao Worker

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = new TextEncoder().encode(TOKEN_SECRET);
    const token = await new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
      .sign(key);

    return new Response(JSON.stringify({
      token,
      expires_in: TOKEN_TTL_SECONDS,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[peticoes-issue-token]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
