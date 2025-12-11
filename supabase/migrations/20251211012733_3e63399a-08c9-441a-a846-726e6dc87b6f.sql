-- Tabela para armazenar mensagens do ManyChat
CREATE TABLE public.manychat_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id text NOT NULL,
  subscriber_nome text,
  subscriber_foto text,
  canal text DEFAULT 'facebook',
  conteudo text NOT NULL,
  tipo text DEFAULT 'text',
  direcao text NOT NULL DEFAULT 'entrada', -- 'entrada' ou 'saida'
  lead_id uuid REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX idx_manychat_mensagens_subscriber ON public.manychat_mensagens(subscriber_id);
CREATE INDEX idx_manychat_mensagens_lead ON public.manychat_mensagens(lead_id);
CREATE INDEX idx_manychat_mensagens_created ON public.manychat_mensagens(created_at DESC);

-- Enable RLS
ALTER TABLE public.manychat_mensagens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View mensagens" ON public.manychat_mensagens
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert mensagens" ON public.manychat_mensagens
FOR INSERT WITH CHECK (true);

CREATE POLICY "Update mensagens" ON public.manychat_mensagens
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Delete mensagens" ON public.manychat_mensagens
FOR DELETE USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Tabela para vincular subscribers aos leads
CREATE TABLE public.manychat_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id text NOT NULL UNIQUE,
  nome text,
  foto text,
  telefone text,
  email text,
  canal text DEFAULT 'facebook',
  lead_id uuid REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  ultima_interacao timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_manychat_subscribers_lead ON public.manychat_subscribers(lead_id);

-- Enable RLS
ALTER TABLE public.manychat_subscribers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View subscribers" ON public.manychat_subscribers
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert subscribers" ON public.manychat_subscribers
FOR INSERT WITH CHECK (true);

CREATE POLICY "Update subscribers" ON public.manychat_subscribers
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Delete subscribers" ON public.manychat_subscribers
FOR DELETE USING (has_role(auth.uid(), 'Administrador'::app_role));