import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Autoriza 3 tipos de chamador (nenhum deles é "qualquer um com a URL"):
// 1. Outra edge function, usando a SUPABASE_SERVICE_ROLE_KEY como Bearer
//    (padrão já usado por generate-kit/isa-actions/isa-reply-manychat/
//    processo-auto-sync/intimacoes-oab pra chamar outras funções).
// 2. Um job interno (pg_cron) com o header de secret dedicado, quando
//    `opts.internalSecretEnvVar` é passado — nunca reusa a service-role
//    key nem a anon key pra isso.
// 3. Um usuário de verdade logado no CRM — supabase.functions.invoke()
//    já anexa o JWT da sessão sozinho quando chamado do navegador.
//
// NÃO usa `verify_jwt` do config.toml pra isso: essa flag só valida "é um
// JWT assinado", o que inclui a anon key (pública, vai no bundle do
// site) — não distingue "usuário logado" de "qualquer um com F12 aberto".
export async function requireStaffOrInternal(req: Request, opts?: {
  internalSecretEnvVar?: string;
  internalSecretHeader?: string;
}): Promise<{ authorized: boolean; userId?: string }> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (serviceKey && token === serviceKey) return { authorized: true };

  if (opts?.internalSecretEnvVar) {
    const expected = Deno.env.get(opts.internalSecretEnvVar);
    const provided = req.headers.get(opts.internalSecretHeader || 'X-Internal-Secret');
    if (expected && provided === expected) return { authorized: true };
  }

  if (!token || !serviceKey) return { authorized: false };

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await admin.auth.getUser(token);
  return { authorized: !!user, userId: user?.id };
}
