-- SECURITY FIX: Habilita RLS na tabela leads_juridicos
-- Esta tabela existia antes das migrations e nunca teve RLS ativado.
-- As políticas criadas em migrations anteriores só passam a valer após este comando.
--
-- Políticas já existentes (criadas em 20251206223451):
--   "Authenticated users can view leads"    → SELECT, TO authenticated
--   "Authenticated users can insert leads"  → INSERT, TO authenticated
--   "Authenticated users can update leads"  → UPDATE, TO authenticated
--   "Only admins can delete leads"          → DELETE, TO authenticated + role check
--
-- Após este ALTER, nenhum acesso anônimo é mais possível.

ALTER TABLE public.leads_juridicos ENABLE ROW LEVEL SECURITY;

-- Garante que não existe política de acesso anônimo residual
DROP POLICY IF EXISTS "Anon read access" ON public.leads_juridicos;
DROP POLICY IF EXISTS "Anon read access leads" ON public.leads_juridicos;

-- Garante que a política de service_role existe (para edge functions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads_juridicos'
      AND schemaname = 'public'
      AND policyname = 'Service role full access leads'
  ) THEN
    CREATE POLICY "Service role full access leads"
      ON public.leads_juridicos
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
