// Ponte de autenticação pro módulo de Petições (Cloudflare, fora do
// Supabase). O Worker não conhece o JWT mestre do Supabase (autentica todo
// o CRM) — em vez disso, pede um token curto (5 min) pra Edge Function
// peticoes-issue-token, que confirma a sessão normal do Supabase e assina
// um token à parte, próprio deste módulo. Cacheia em memória e renova
// perto de expirar, pra não pedir um token novo a cada requisição.
import { supabase } from '@/integrations/supabase/client';

let cached: { token: string; expiresAt: number } | null = null;

export async function getPeticoesToken(): Promise<string> {
  const agora = Date.now();
  if (cached && cached.expiresAt - agora > 30_000) return cached.token;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado.');

  const { data, error } = await supabase.functions.invoke('peticoes-issue-token');
  if (error) throw new Error(`Falha ao obter acesso ao módulo de Petições: ${error.message}`);
  if (!data?.token) throw new Error('Token não retornado pela Edge Function.');

  cached = { token: data.token, expiresAt: agora + (data.expires_in ?? 300) * 1000 };
  return cached.token;
}
