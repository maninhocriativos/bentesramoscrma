-- Adicionar campos de qualificação completa para leads (procuração)
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS nacionalidade TEXT,
ADD COLUMN IF NOT EXISTS estado_civil TEXT,
ADD COLUMN IF NOT EXISTS profissao TEXT,
ADD COLUMN IF NOT EXISTS rg TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'Manaus',
ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'AM';

-- Tabela para armazenar procurações geradas
CREATE TABLE IF NOT EXISTS public.procuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
  html_content TEXT NOT NULL,
  pdf_url TEXT,
  objetivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS para procuracoes
ALTER TABLE public.procuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view procuracoes"
  ON public.procuracoes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create procuracoes"
  ON public.procuracoes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update procuracoes"
  ON public.procuracoes
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete procuracoes"
  ON public.procuracoes
  FOR DELETE
  USING (true);