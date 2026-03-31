CREATE TABLE public.analises_extratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banco text NOT NULL,
  periodo_inicio date,
  periodo_fim date,
  nome_cliente text,
  cpf_cliente text,
  numero_contrato text,
  resultado_json jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.analises_extratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON public.analises_extratos FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own analyses"
  ON public.analises_extratos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);