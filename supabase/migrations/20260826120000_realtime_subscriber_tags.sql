-- Tags do chat não propagavam em tempo real para outros usuários (só apareciam
-- após um refresh manual). subscriber_tags nunca foi habilitada no realtime.

-- REPLICA IDENTITY FULL: sem isso, o payload de DELETE só traz a primary key
-- (id), não o subscriber_id que o frontend precisa para saber qual conversa recarregar.
ALTER TABLE public.subscriber_tags REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriber_tags;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
