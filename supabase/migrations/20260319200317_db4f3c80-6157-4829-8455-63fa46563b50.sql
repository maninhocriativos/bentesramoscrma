
-- Add categoria and marcadores columns to modelos_peticao
ALTER TABLE public.modelos_peticao ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.modelos_peticao ADD COLUMN IF NOT EXISTS marcadores jsonb;

-- Add new columns to peticoes_geradas for the detailed form
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS nome_completo text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS qualificacao text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS rg_militar text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS endereco_cliente text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS vara_juizo text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS comarca text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS reu_nome text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS reu_cnpj text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS reu_endereco text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS tipo_acao text;
ALTER TABLE public.peticoes_geradas ADD COLUMN IF NOT EXISTS idoso_idade text;

-- Make bucket public
UPDATE storage.buckets SET public = true WHERE id = 'peticoes-modelos';

-- RLS policies for modelos_peticao (allow authenticated users full access)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'modelos_peticao' AND policyname = 'Authenticated users can read modelos') THEN
    CREATE POLICY "Authenticated users can read modelos" ON public.modelos_peticao FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'modelos_peticao' AND policyname = 'Authenticated users can insert modelos') THEN
    CREATE POLICY "Authenticated users can insert modelos" ON public.modelos_peticao FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'modelos_peticao' AND policyname = 'Authenticated users can delete modelos') THEN
    CREATE POLICY "Authenticated users can delete modelos" ON public.modelos_peticao FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- RLS policies for peticoes_geradas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'peticoes_geradas' AND policyname = 'Authenticated users can read peticoes') THEN
    CREATE POLICY "Authenticated users can read peticoes" ON public.peticoes_geradas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'peticoes_geradas' AND policyname = 'Authenticated users can insert peticoes') THEN
    CREATE POLICY "Authenticated users can insert peticoes" ON public.peticoes_geradas FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- Storage RLS: allow authenticated users to upload/download from peticoes-modelos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated read peticoes-modelos') THEN
    CREATE POLICY "Allow authenticated read peticoes-modelos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'peticoes-modelos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow authenticated upload peticoes-modelos') THEN
    CREATE POLICY "Allow authenticated upload peticoes-modelos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'peticoes-modelos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public read peticoes-modelos') THEN
    CREATE POLICY "Allow public read peticoes-modelos" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'peticoes-modelos');
  END IF;
END $$;
