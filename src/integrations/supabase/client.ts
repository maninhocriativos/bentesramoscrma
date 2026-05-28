import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://qgenaltkjtlvwfgykpxq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg";

// Promise única de refresh — evita múltiplas renovações simultâneas
let _refreshPromise: Promise<string | null> | null = null;
let _client: ReturnType<typeof createClient<Database>> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      // Tenta até 3 vezes com backoff exponencial antes de deslogar
      // Evita logout inesperado por falha transitória de rede
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data } = await _client!.auth.refreshSession();
          if (data?.session) return data.session.access_token;
        } catch {
          // falha de rede — aguarda antes de tentar novamente
        }
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }

      // Só desloga após 3 tentativas falharem
      await _client!.auth.signOut();
      return null;
    } finally {
      setTimeout(() => { _refreshPromise = null; }, 5000);
    }
  })();

  return _refreshPromise;
}

// Intercepta todas as requests HTTP do Supabase.
// Quando PostgREST retorna 401 (JWT expirado), renova o token e refaz
// a request transparentemente. Se o refresh token também expirou,
// faz signOut e o onAuthStateChange redireciona para o login.
const withAutoRefresh = async (
  url: RequestInfo | URL,
  options?: RequestInit,
): Promise<Response> => {
  const response = await fetch(url, options);

  if (response.status === 401 && _client) {
    const body = await response.clone().json().catch(() => null);
    const isExpired =
      body?.message?.toLowerCase().includes('jwt') ||
      body?.hint?.toLowerCase().includes('jwt') ||
      body?.code === 'PGRST301';

    if (isExpired) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        const headers = new Headers(options?.headers);
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...options, headers });
      }
      // Se newToken é null, o signOut já foi chamado; retorna 401 original
    }
  }

  return response;
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    fetch: withAutoRefresh,
  },
});

_client = supabase;
