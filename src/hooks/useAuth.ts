import { useAuthContext } from '@/contexts/AuthContext';

// Hook wrapper (the actual auth listener lives in AuthProvider)
export function useAuth() {
  const ctx = useAuthContext();

  if (!ctx) {
    return {
      user: null,
      session: null,
      loading: true,
      signIn: async () => ({ error: new Error('AuthProvider not mounted') }),
      signUp: async () => ({ error: new Error('AuthProvider not mounted') }),
      signInWithGoogle: async () => ({ error: new Error('AuthProvider not mounted') }),
      signOut: async () => ({ error: new Error('AuthProvider not mounted') }),
    };
  }

  return ctx;
}

