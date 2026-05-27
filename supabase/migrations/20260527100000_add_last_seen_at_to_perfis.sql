-- Adiciona coluna last_seen_at em perfis para heartbeat de presença
-- Substitui dependência exclusiva de Supabase Realtime (WebSocket instável em background)
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Índice para queries rápidas de "quem está online (last_seen_at >= now() - 10min)"
CREATE INDEX IF NOT EXISTS perfis_last_seen_at_idx ON public.perfis (last_seen_at DESC NULLS LAST);

-- Permite que cada usuário atualize o próprio last_seen_at via RLS
-- (A política existente de update já cobre isso, pois perfis.id = auth.uid())
