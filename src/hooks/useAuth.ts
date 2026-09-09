import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);
  // Controla se já houve carga inicial — após isso loading nunca mais vira true
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // Carrega sessão existente primeiro
    supabase.auth.getSession().then(async ({ data: { session: existingSession }, error }) => {
      if (error) {
        console.error('Session error:', error);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      } else {
        lastUserIdRef.current = existingSession?.user?.id ?? null;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
      }
      initialLoadDone.current = true;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;

        // TOKEN_REFRESHED — só atualiza sessão, sem re-render desnecessário
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          return;
        }

        // SIGNED_IN com o MESMO usuário já autenticado — acontece quando o
        // WebSocket reconecta ao voltar para a aba. Ignorar completamente.
        if (event === 'SIGNED_IN' && newUserId === lastUserIdRef.current && initialLoadDone.current) {
          setSession(newSession);
          return;
        }

        // Mudança real de auth (novo login, logout, troca de usuário)
        lastUserIdRef.current = newUserId;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Só seta loading=false se ainda não finalizou a carga inicial
        // (evita piscar a tela ao trocar de aba)
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          setLoading(false);
        }
      }
    );

    // Quando o usuário volta para a aba após o computador dormir/hibernar,
    // força renovação do token antes que qualquer query dispare.
    // Antes deslogava na primeira falha de getSession() — mas um soluço
    // passageiro de rede nesse instante (comum ao acordar o notebook) já
    // bastava pra derrubar o usuário sem necessidade. Agora tenta 3x com
    // espera, igual ao tryRefreshToken() do client.ts, e só desloga se as
    // 3 tentativas falharem de verdade (refresh token expirado/inválido).
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      (async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data: { session: refreshed }, error } = await supabase.auth.getSession();
          if (!error && refreshed) return;
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
        }
        supabase.auth.signOut();
      })();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkUserApproval = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('perfis')
      .select('aprovado')
      .eq('id', userId)
      .single();
    // Se a query falhar (rede instável, Supabase hiccup), não nega acesso —
    // o usuário já se autenticou com sucesso no Supabase Auth.
    // Só bloqueia se aprovado for explicitamente false.
    if (error || !data) return true;
    return data.aprovado !== false;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error };

    if (data.user) {
      const isApproved = await checkUserApproval(data.user.id);
      if (!isApproved) {
        await supabase.auth.signOut();
        return {
          error: {
            message: 'Sua conta ainda não foi aprovada. Aguarde a aprovação do administrador.',
          } as any,
        };
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    if (error) return { error };

    // Para usuários convidados: confirma email + aprova automaticamente via Edge Function.
    // Se não houver convite pendente, a função retorna sem fazer nada (aprovação manual).
    if (data.user) {
      try {
        await supabase.functions.invoke('accept-invite', {
          body: { userId: data.user.id, email },
        });
      } catch {
        // Silencioso — não bloqueia o cadastro se a função falhar
      }
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };
}
