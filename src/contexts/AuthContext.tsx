import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function checkUserApproval(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('perfis')
    .select('aprovado')
    .eq('id', userId)
    .maybeSingle();

  // Fail-open to avoid auth loops; we only block when perfil exists AND aprovado=false.
  if (error) return true;
  return data?.aprovado ?? true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const safeSetLoading = (value: boolean) => {
      if (!mounted) return;
      setLoading(value);
    };

    const safeSetSessionUser = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    // Watchdog: if something goes wrong and we never leave "loading",
    // clear Supabase auth storage to break infinite loops.
    const watchdog = window.setTimeout(() => {
      if (!mounted) return;
      if (!loading) return;

      try {
        console.warn('[AuthProvider] Watchdog fired: clearing auth storage');
        const prefix = 'sb-qgenaltkjtlvwfgykpxq-';
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.error('[AuthProvider] Watchdog error:', e);
      }

      safeSetSessionUser(null);
      safeSetLoading(false);

      if (!window.location.pathname.startsWith('/auth')) {
        window.location.replace('/auth');
      }
    }, 9000);

    console.log('[AuthProvider] mounted');

    // Listener first to avoid race conditions across tabs/refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AuthProvider] auth event:', event);

      const newUserId = newSession?.user?.id ?? null;

      // TOKEN_REFRESHED happens frequently.
      if (event === 'TOKEN_REFRESHED' && newUserId === lastUserIdRef.current) {
        if (mounted) setSession(newSession);
        return;
      }

      if (event === 'SIGNED_IN' && newSession?.user) {
        try {
          const { data, error } = await supabase
            .from('perfis')
            .select('aprovado')
            .eq('id', newSession.user.id)
            .maybeSingle();

          // Only block if profile exists AND is explicitly not approved
          if (!error && data?.aprovado === false) {
            await supabase.auth.signOut();
            lastUserIdRef.current = null;
            safeSetSessionUser(null);
            safeSetLoading(false);

            if (!window.location.pathname.startsWith('/auth')) {
              window.location.replace('/auth?not_approved=true');
            }
            return;
          }
        } catch (e) {
          console.error('Error checking approval:', e);
        }
      }

      lastUserIdRef.current = newUserId;
      safeSetSessionUser(newSession);
      safeSetLoading(false);
    });

    // Then fetch session (always end loading)
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          await supabase.auth.signOut();
          lastUserIdRef.current = null;
          safeSetSessionUser(null);
        } else {
          lastUserIdRef.current = data.session?.user?.id ?? null;
          safeSetSessionUser(data.session ?? null);
        }
      } catch (e) {
        console.error('getSession threw:', e);
        lastUserIdRef.current = null;
        safeSetSessionUser(null);
      } finally {
        safeSetLoading(false);
      }
    })();

    return () => {
      console.log('[AuthProvider] unmounted');
      mounted = false;
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error };

    if (data.user) {
      const approved = await checkUserApproval(data.user.id);
      if (!approved) {
        await supabase.auth.signOut();
        return {
          error: {
            message: 'Sua conta ainda não foi aprovada. Aguarde a aprovação do administrador.',
          } as any,
        };
      }
    }

    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [user, session, loading, signIn, signUp, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue | null {
  return useContext(AuthContext);
}
