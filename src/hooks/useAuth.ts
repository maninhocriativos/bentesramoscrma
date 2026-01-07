import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Stable update function that only updates state if user actually changed
  const updateAuthState = useCallback((newSession: Session | null) => {
    const newUserId = newSession?.user?.id ?? null;
    
    // Only update state if user ID actually changed
    if (newUserId !== lastUserIdRef.current) {
      lastUserIdRef.current = newUserId;
      setSession(newSession);
      setUser(newSession?.user ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Only handle meaningful events, ignore TOKEN_REFRESHED if user didn't change
        if (event === 'TOKEN_REFRESHED') {
          // Token refresh - just update session silently without causing re-renders
          if (newSession?.user?.id === lastUserIdRef.current) {
            // Same user, just update session reference silently
            setSession(newSession);
            return;
          }
        }
        
        // Handle sign out
        if (event === 'SIGNED_OUT') {
          lastUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Handle other events (SIGNED_IN, INITIAL_SESSION, etc.)
        updateAuthState(newSession);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession }, error }) => {
      if (error) {
        console.error('Session error:', error);
        await supabase.auth.signOut();
        updateAuthState(null);
      } else {
        updateAuthState(existingSession);
      }
    });

    return () => subscription.unsubscribe();
  }, [updateAuthState]);

  const checkUserApproval = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('perfis')
      .select('aprovado')
      .eq('id', userId)
      .single();
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
