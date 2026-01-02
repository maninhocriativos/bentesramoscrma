-- Tabela para rastrear follow-ups automáticos
CREATE TABLE public.lead_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
  subscriber_id TEXT,
  canal TEXT DEFAULT 'whatsapp',
  
  -- Controle dos 3 follow-ups
  followup_1_enviado BOOLEAN DEFAULT false,
  followup_1_enviado_em TIMESTAMP WITH TIME ZONE,
  followup_2_enviado BOOLEAN DEFAULT false,
  followup_2_enviado_em TIMESTAMP WITH TIME ZONE,
  followup_3_enviado BOOLEAN DEFAULT false,
  followup_3_enviado_em TIMESTAMP WITH TIME ZONE,
  
  -- Resposta do lead
  respondido BOOLEAN DEFAULT false,
  respondido_em TIMESTAMP WITH TIME ZONE,
  
  -- Status geral
  status TEXT DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_andamento', 'concluido', 'respondido', 'cancelado')),
  
  -- Timestamps
  primeiro_contato_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_lead_followups_lead_id ON public.lead_followups(lead_id);
CREATE INDEX idx_lead_followups_status ON public.lead_followups(status);
CREATE INDEX idx_lead_followups_primeiro_contato ON public.lead_followups(primeiro_contato_em);

-- Unique constraint - apenas 1 followup ativo por lead
CREATE UNIQUE INDEX idx_lead_followups_unique_active ON public.lead_followups(lead_id) WHERE status IN ('aguardando', 'em_andamento');

-- Enable RLS
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View followups authenticated" ON public.lead_followups
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert followups" ON public.lead_followups
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Update followups" ON public.lead_followups
  FOR UPDATE USING (true);

CREATE POLICY "Delete followups" ON public.lead_followups
  FOR DELETE USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_lead_followups_updated_at
  BEFORE UPDATE ON public.lead_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.lead_followups REPLICA IDENTITY FULL;