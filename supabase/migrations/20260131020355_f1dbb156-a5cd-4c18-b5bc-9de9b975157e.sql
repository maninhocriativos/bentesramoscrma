-- Create tags table for predefined tags
CREATE TABLE public.chat_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'gray',
  category TEXT,
  is_system BOOLEAN DEFAULT false,
  requires_reason BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscriber_tags junction table
CREATE TABLE public.subscriber_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.chat_tags(id) ON DELETE CASCADE,
  reason TEXT,
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_tags
CREATE POLICY "Users can view all tags" 
ON public.chat_tags 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage tags" 
ON public.chat_tags 
FOR ALL 
USING (has_role(auth.uid(), 'Administrador') OR has_role(auth.uid(), 'Gerente'));

-- RLS Policies for subscriber_tags
CREATE POLICY "Users can view subscriber tags" 
ON public.subscriber_tags 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage subscriber tags" 
ON public.subscriber_tags 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Insert predefined tags
INSERT INTO public.chat_tags (name, color, category, is_system, requires_reason) VALUES
-- Origem/Status
('Tráfego Pago', 'orange', 'origem', true, false),
('Indicação', 'green', 'origem', true, false),
('Retorno', 'blue', 'origem', true, false),
('Perdido', 'red', 'origem', true, false),
('Desistiu', 'red', 'origem', true, true),
-- Triagem
('VIP', 'yellow', 'triagem', true, false),
('Urgente', 'red', 'triagem', true, false),
('Aguardando Docs', 'purple', 'triagem', true, false),
('Novo', 'cyan', 'triagem', true, false),
-- Área do direito
('Previdenciário', 'indigo', 'area', true, false),
('Bancário', 'emerald', 'area', true, false),
('Trabalhista', 'amber', 'area', true, false),
('Família', 'pink', 'area', true, false);

-- Create index for faster queries
CREATE INDEX idx_subscriber_tags_subscriber_id ON public.subscriber_tags(subscriber_id);
CREATE INDEX idx_subscriber_tags_tag_id ON public.subscriber_tags(tag_id);