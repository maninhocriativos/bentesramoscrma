-- Corrige permissão de criação de tags: todos os usuários autenticados
-- podem criar tags personalizadas (não-sistema).
-- Admins continuam com acesso total (política existente).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_tags'
      AND policyname = 'Authenticated users can create custom tags'
  ) THEN
    CREATE POLICY "Authenticated users can create custom tags"
      ON public.chat_tags
      FOR INSERT TO authenticated
      WITH CHECK (is_system = false);
  END IF;
END $$;
