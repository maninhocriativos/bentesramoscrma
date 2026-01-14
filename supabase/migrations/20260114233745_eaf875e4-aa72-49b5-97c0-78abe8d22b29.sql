-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1) Office Settings (configurações do escritório)
CREATE TABLE public.office_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_name TEXT DEFAULT 'Bentes & Ramos Advocacia',
  logo_url TEXT,
  lawyer_name TEXT,
  oab_main TEXT,
  oab_secondary TEXT,
  email TEXT,
  instagram TEXT,
  address_main TEXT,
  address_secondary TEXT,
  city TEXT DEFAULT 'Manaus',
  state TEXT DEFAULT 'AM',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) Tipos de Petição
CREATE TABLE public.petition_types (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'FileText',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir tipos padrão
INSERT INTO public.petition_types (slug, title, description, icon) VALUES
  ('cobranca_pacote_bancario', 'Cobrança de Pacote Bancário', 'Ação para restituição de tarifas de pacote de serviços cobradas indevidamente', 'Package'),
  ('juros_abusivos', 'Juros Abusivos', 'Revisional para contratos com taxas acima do mercado ou CET abusivo', 'TrendingUp'),
  ('rmc_rcc', 'RMC / RCC', 'Ação contra empréstimo consignado com reserva de margem não autorizada', 'CreditCard'),
  ('negativacao_indevida', 'Negativação Indevida', 'Danos morais por inscrição indevida em cadastros restritivos', 'AlertTriangle'),
  ('emprestimo_nao_reconhecido', 'Empréstimo Não Reconhecido', 'Declaratória de inexistência de débito + repetição de indébito', 'Ban');

-- 3) Petições (documentos criados)
CREATE TABLE public.petitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  petition_type_slug TEXT REFERENCES public.petition_types(slug),
  lead_id UUID REFERENCES public.leads_juridicos(id),
  client_name TEXT,
  client_cpf TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_revisao', 'aprovado', 'gerado', 'protocolado', 'arquivado')),
  step_current INTEGER DEFAULT 1 CHECK (step_current BETWEEN 1 AND 4),
  payload JSONB DEFAULT '{}'::jsonb,
  summary_isa TEXT,
  validation_isa JSONB,
  model_id UUID,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) Documentos gerados (versões PDF)
CREATE TABLE public.petition_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  petition_id UUID NOT NULL REFERENCES public.petitions(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  html_content TEXT,
  pdf_url TEXT,
  docx_url TEXT,
  generated_by TEXT DEFAULT 'isa',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5) Modelos de petição (templates enviados pelo escritório)
CREATE TABLE public.petition_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  petition_type_slug TEXT REFERENCES public.petition_types(slug),
  version TEXT DEFAULT 'v1',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  file_url TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('docx', 'pdf')),
  extracted_text TEXT,
  extracted_sections JSONB,
  variables_map JSONB DEFAULT '{}'::jsonb,
  tags TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6) Chunks para RAG (biblioteca de trechos)
CREATE TABLE public.model_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID REFERENCES public.petition_models(id) ON DELETE CASCADE,
  petition_type_slug TEXT REFERENCES public.petition_types(slug),
  chunk_type TEXT CHECK (chunk_type IN ('qualificacao', 'fatos', 'fundamentos', 'pedidos', 'jurisprudencia', 'provas', 'geral')),
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca vetorial
CREATE INDEX IF NOT EXISTS idx_model_chunks_embedding ON public.model_chunks 
USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- 7) Log de auditoria
CREATE TABLE public.petition_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  petition_id UUID REFERENCES public.petitions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (usuários autenticados podem acessar)
CREATE POLICY "Authenticated users can view office_settings" 
ON public.office_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage office_settings" 
ON public.office_settings FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'Administrador'));

CREATE POLICY "Authenticated users can view petition_types" 
ON public.petition_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage petition_types" 
ON public.petition_types FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'Administrador'));

CREATE POLICY "Authenticated users can manage petitions" 
ON public.petitions FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage petition_documents" 
ON public.petition_documents FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view petition_models" 
ON public.petition_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage petition_models" 
ON public.petition_models FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('Administrador', 'Advogado')));

CREATE POLICY "Admins can update petition_models" 
ON public.petition_models FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('Administrador', 'Advogado')));

CREATE POLICY "Admins can delete petition_models" 
ON public.petition_models FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'Administrador'));

CREATE POLICY "Authenticated users can view model_chunks" 
ON public.model_chunks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage model_chunks" 
ON public.model_chunks FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view petition_audit_log" 
ON public.petition_audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert petition_audit_log" 
ON public.petition_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_petition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_petitions_updated_at
BEFORE UPDATE ON public.petitions
FOR EACH ROW EXECUTE FUNCTION public.update_petition_updated_at();

CREATE TRIGGER update_petition_models_updated_at
BEFORE UPDATE ON public.petition_models
FOR EACH ROW EXECUTE FUNCTION public.update_petition_updated_at();

CREATE TRIGGER update_office_settings_updated_at
BEFORE UPDATE ON public.office_settings
FOR EACH ROW EXECUTE FUNCTION public.update_petition_updated_at();

-- Inserir configuração padrão do escritório
INSERT INTO public.office_settings (office_name, lawyer_name, oab_main, city, state)
VALUES ('Bentes & Ramos Advocacia', 'Dr. Advogado', 'OAB/AM 0000', 'Manaus', 'AM');

-- Função para buscar chunks similares (RAG)
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding extensions.vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  model_id uuid,
  chunk_type text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.model_id,
    mc.chunk_type,
    mc.content,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM public.model_chunks mc
  WHERE 
    (filter_type IS NULL OR mc.chunk_type = filter_type)
    AND 1 - (mc.embedding <=> query_embedding) > match_threshold
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;