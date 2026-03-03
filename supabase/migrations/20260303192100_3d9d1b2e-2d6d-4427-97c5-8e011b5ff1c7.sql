ALTER TABLE public.processo_partes ADD COLUMN IF NOT EXISTS celular text;
ALTER TABLE public.processo_partes ADD COLUMN IF NOT EXISTS telefone_adicional text;

DROP POLICY IF EXISTS "Update processo partes" ON public.processo_partes;
CREATE POLICY "Update processo partes" ON public.processo_partes
  FOR UPDATE USING (auth.role() = 'authenticated');