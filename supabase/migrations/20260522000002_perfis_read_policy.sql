-- Permite que todos os usuários autenticados leiam perfis (nome, sobrenome, etc.)
-- Necessário para o chat interno exibir nomes corretamente via join
-- Sem esta política o join retorna null e o nome aparece como "?"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'perfis'
      AND schemaname = 'public'
      AND policyname = 'perfis_read_all_authenticated'
  ) THEN
    CREATE POLICY "perfis_read_all_authenticated" ON public.perfis
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
