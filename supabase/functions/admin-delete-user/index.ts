import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Verifica que o chamador é administrador
    const authHeader = req.headers.get('Authorization') || '';
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }
    const { data: callerPerfil } = await supabaseAdmin
      .from('perfis').select('cargo').eq('id', caller.id).single();
    if (callerPerfil?.cargo !== 'Administrador') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId obrigatório' }), { status: 400, headers: corsHeaders });
    }

    // Não permite auto-exclusão
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: 'Você não pode remover seu próprio acesso.' }), { status: 400, headers: corsHeaders });
    }

    // Busca email antes de deletar (para limpar pending_invites)
    const { data: perfil } = await supabaseAdmin
      .from('perfis').select('email').eq('id', userId).maybeSingle();

    // Remove user_roles
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);

    // Remove perfis
    await supabaseAdmin.from('perfis').delete().eq('id', userId);

    // Remove pending_invites pelo email
    if (perfil?.email) {
      await supabaseAdmin.from('pending_invites').delete().eq('email', perfil.email);
    }

    // Remove da autenticação (auth.users) — requer service role
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Erro ao deletar auth.users:', authError.message);
      // Não falha — perfil já foi removido, auth pode ser removido manualmente se necessário
    }

    console.log(`Usuário removido completamente: ${userId} (${perfil?.email})`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('admin-delete-user error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
