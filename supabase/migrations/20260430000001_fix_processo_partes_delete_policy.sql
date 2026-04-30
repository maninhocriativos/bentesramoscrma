-- Fix: allow all authenticated users to delete processo_partes
-- Previously only Administrador could delete, causing silent RLS failures
-- when Secretaria/Advogado saved processes (partes were accumulating duplicates)
DROP POLICY IF EXISTS "Delete processo partes" ON public.processo_partes;
CREATE POLICY "Delete processo partes" ON public.processo_partes
  FOR DELETE USING (auth.role() = 'authenticated');
