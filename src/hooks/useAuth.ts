import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Check for existing session first
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
      setLoading(false);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        const newUserId = newSession?.user?.id ?? null;
        
        // For TOKEN_REFRESHED, only update session if same user (avoid re-render)
        if (event === 'TOKEN_REFRESHED' && newUserId === lastUserIdRef.current) {
          setSession(newSession);
          return;
        }
        
        // For OAuth sign-in, check if user is approved (but don't block if profile doesn't exist yet)
        if (event === 'SIGNED_IN' && newSession?.user) {
          try {
            const { data, error } = await supabase
              .from('perfis')
              .select('aprovado')
              .eq('id', newSession.user.id)
              .single();
            
            // Only block if profile exists AND is not approved
            if (!error && data && data.aprovado === false) {
              console.log('User not approved, signing out');
              await supabase.auth.signOut();
              // Redirect to auth with not_approved flag
              window.location.href = '/auth?not_approved=true';
              return;
            }
          } catch (e) {
            console.error('Error checking approval:', e);
          }
        }
        
        // For actual auth changes, update everything
        lastUserIdRef.current = newUserId;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
