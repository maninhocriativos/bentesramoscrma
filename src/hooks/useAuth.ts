import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
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

    // 1) Listener first (avoids race conditions)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      const newUserId = newSession?.user?.id ?? null;

      // TOKEN_REFRESHED happens frequently; avoid expensive re-renders
      if (event === 'TOKEN_REFRESHED' && newUserId === lastUserIdRef.current) {
        if (mounted) setSession(newSession);
        return;
      }

      // If user just signed in, check approval (but don't crash/hang on missing profile)
      if (event === 'SIGNED_IN' && newSession?.user) {
        try {
          const { data, error } = await supabase
            .from('perfis')
            .select('aprovado')
            .eq('id', newSession.user.id)
            .maybeSingle();

          if (!error && data?.aprovado === false) {
            await supabase.auth.signOut();
            safeSetSessionUser(null);
            safeSetLoading(false);

            // Redirect once to show message
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

    // 2) Then fetch current session (always end loading)
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
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkUserApproval = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('perfis')
      .select('aprovado')
      .eq('id', userId)
      .maybeSingle();

    if (error) return false;
    return data?.aprovado ?? false;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) return { error };
    
    // Check if user is approved
    if (data.user) {
      const isApproved = await checkUserApproval(data.user.id);
      if (!isApproved) {
        await supabase.auth.signOut();
        return { 
          error: { 
            message: 'Sua conta ainda não foi aprovada. Aguarde a aprovação do administrador.' 
          } as any 
        };
      }
    }
    
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`
      }
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
