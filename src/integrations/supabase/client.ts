import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://qgenaltkjtlvwfgykpxq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg";

// Referência ao cliente para uso dentro do interceptor (evita dependência circular)
let _client: ReturnType<typeof createClient<Database>> | null = null;

// Intercepta todas as requests HTTP do Supabase.
// Quando o PostgREST retorna 401 (JWT expirado), renova o token e refaz a request.
// Cobre queries, Edge Functions e Storage — sem precisar alterar nenhum hook.
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
      const { data } = await _client.auth.refreshSession();
      if (data?.session) {
        const headers = new Headers(options?.headers);
        headers.set('Authorization', `Bearer ${data.session.access_token}`);
        return fetch(url, { ...options, headers });
      }
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
      eventsPerSecond: 2,
    },
  },
  global: {
    fetch: withAutoRefresh,
  },
});

_client = supabase;
