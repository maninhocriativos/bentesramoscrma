
-- Fix: Allow all authenticated users to delete processo_partes (same as insert/update)
DROP POLICY IF EXISTS "Delete processo partes" ON public.processo_partes;
CREATE POLICY "Delete processo partes"
  ON public.processo_partes FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');
