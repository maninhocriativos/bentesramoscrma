-- Bucket para modelos de petição
INSERT INTO storage.buckets (id, name, public)
VALUES ('peticoes-modelos', 'peticoes-modelos', false)
ON CONFLICT (id) DO NOTHING;

-- Tabela de modelos de petição
CREATE TABLE IF NOT EXISTS public.modelos_peticao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  arquivo_url text NOT NULL,
  variaveis jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.modelos_peticao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage modelos_peticao"
ON public.modelos_peticao
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Tabela de petições geradas
CREATE TABLE IF NOT EXISTS public.peticoes_geradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid REFERENCES public.modelos_peticao(id) ON DELETE SET NULL,
  cliente_nome text,
  cliente_cpf_rg text,
  cliente_endereco text,
  valor_causa text,
  parte_contraria text,
  vara_comarca text,
  informacoes_adicionais text,
  arquivo_gerado_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.peticoes_geradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage peticoes_geradas"
ON public.peticoes_geradas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Storage policies for peticoes-modelos bucket
CREATE POLICY "Auth users can upload peticoes-modelos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'peticoes-modelos');

CREATE POLICY "Auth users can read peticoes-modelos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'peticoes-modelos');

CREATE POLICY "Auth users can delete peticoes-modelos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'peticoes-modelos');