-- Notificações push do CRM (staff, não Área do Cliente). O service worker
-- (public/sw.js) já tinha os handlers de 'push'/'notificationclick' prontos
-- há tempo, mas nunca existiu a infra pra realmente inscrever um usuário nem
-- pra disparar um envio — esta migration + as Edge Functions push-subscribe/
-- push-send fecham esse ciclo.

CREATE TABLE public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth_key   text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê/gerencia as próprias inscrições (um dispositivo = uma
-- inscrição; o mesmo usuário pode ter várias, uma por navegador/aparelho).
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
