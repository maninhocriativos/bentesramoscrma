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
    const { userId, email } = await req.json();
    if (!userId || !email) {
      return new Response(JSON.stringify({ error: 'userId e email obrigatórios' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verifica se existe convite pendente para este email
    const { data: invite } = await supabaseAdmin
      .from('pending_invites')
      .select('id, role')
      .eq('email', email)
      .is('accepted_at', null)
      .maybeSingle();

    if (!invite) {
      // Não é usuário convidado — fluxo normal de aprovação manual
      return new Response(JSON.stringify({ success: true, invited: false }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // É usuário convidado: confirmar email + aprovar automaticamente
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    // Aprovar perfil e definir cargo
    await supabaseAdmin
      .from('perfis')
      .update({ aprovado: true, cargo: invite.role })
      .eq('id', userId);

    // Garantir que existe registro em user_roles
    // ⚠️ a unique constraint real da tabela é (user_id, role), não user_id sozinho —
    // onConflict:'user_id' não batia com nenhuma constraint, o Postgres rejeitava o
    // upsert (42P10) e, como o erro não era checado, TODO usuário convidado ficava
    // sem linha em user_roles silenciosamente (o sistema só "parecia" funcionar
    // porque PerfilContext cai pro fallback perfis.cargo quando user_roles vem vazio
    // — mas qualquer código que exige user_roles de verdade, como o roteamento de
    // OAB do intimacoes-scheduler, nunca encontrava esses usuários).
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: invite.role }, { onConflict: 'user_id,role' });
    if (roleUpsertError) {
      console.error('accept-invite: falha ao criar user_roles:', roleUpsertError.message);
    }

    // Marcar convite como aceito
    await supabaseAdmin
      .from('pending_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    console.log(`Convite aceito: ${email} → cargo ${invite.role}`);

    return new Response(JSON.stringify({ success: true, invited: true, role: invite.role }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('accept-invite error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
