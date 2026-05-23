import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SITE_URL = Deno.env.get('SITE_URL') || 'https://bentesramoscrm.netlify.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Verifica que o chamador é administrador
    const authHeader = req.headers.get('Authorization') || '';
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!caller) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    const { data: callerPerfil } = await supabaseAdmin.from('perfis').select('cargo').eq('id', caller.id).single();
    if (callerPerfil?.cargo !== 'Administrador') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: corsHeaders });
    }

    const { email, role } = await req.json();
    if (!email || !role) return new Response(JSON.stringify({ error: 'email e role obrigatórios' }), { status: 400, headers: corsHeaders });

    // Verifica se o usuário já existe em perfis (já fez o cadastro)
    const { data: perfil } = await supabaseAdmin
      .from('perfis').select('id, aprovado').eq('email', email).maybeSingle();

    if (perfil) {
      // Usuário já se cadastrou — só confirma email e aprova
      await supabaseAdmin.auth.admin.updateUserById(perfil.id, { email_confirm: true });
      await supabaseAdmin.from('perfis').update({ aprovado: true, cargo: role }).eq('id', perfil.id);
      await supabaseAdmin.from('user_roles')
        .delete().eq('user_id', perfil.id);
      await supabaseAdmin.from('user_roles')
        .insert({ user_id: perfil.id, role });
      await supabaseAdmin.from('pending_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('email', email);
      console.log(`Aprovado (já cadastrado): ${email}`);
      return new Response(JSON.stringify({ success: true, action: 'approved' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Usuário nunca se cadastrou — gera link de convite via API admin
    // (cria conta no Supabase + envia email com link para definir senha)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${SITE_URL}/auth` },
    });
    if (linkError) throw linkError;

    const userId = linkData.user.id;

    // Aguarda o trigger criar o registro em perfis
    await new Promise(r => setTimeout(r, 800));

    // Aprova o perfil (upsert garante que funciona mesmo se o trigger for lento)
    await supabaseAdmin.from('perfis')
      .upsert({ id: userId, email, aprovado: true, cargo: role }, { onConflict: 'id' });

    await supabaseAdmin.from('user_roles')
      .delete().eq('user_id', userId);
    await supabaseAdmin.from('user_roles')
      .insert({ user_id: userId, role });

    await supabaseAdmin.from('pending_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('email', email);

    console.log(`Convite gerado e aprovado: ${email} (id: ${userId})`);
    return new Response(JSON.stringify({ success: true, action: 'invite_sent' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('admin-approve-invite error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
