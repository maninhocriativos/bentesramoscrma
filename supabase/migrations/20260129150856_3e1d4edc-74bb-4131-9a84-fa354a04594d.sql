-- Tabela para controle de follow-up agressivo de leads de tráfego
CREATE TABLE public.traffic_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
  subscriber_id TEXT,
  telefone TEXT NOT NULL,
  
  -- Controle de estágios (9 estágios)
  current_stage TEXT DEFAULT NULL, -- '10min', '3h', '8h', '24h', '34h', '42h', '72h', '6d', '7d'
  stages_sent JSONB DEFAULT '{}'::jsonb, -- Registro de cada estágio enviado
  
  -- Status da automação
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'responded', 'archived', 'paused')),
  automation_active BOOLEAN DEFAULT true,
  pause_reason TEXT,
  
  -- Timestamps de controle
  next_message_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_inbound_at TIMESTAMP WITH TIME ZONE,
  
  -- Contadores
  total_messages_sent INTEGER DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Índice único por lead
  UNIQUE(lead_id)
);

-- Índices para performance do cron job
CREATE INDEX idx_traffic_followups_active ON traffic_followups(automation_active) WHERE automation_active = true;
CREATE INDEX idx_traffic_followups_next ON traffic_followups(next_message_at) WHERE automation_active = true AND status NOT IN ('responded', 'archived');
CREATE INDEX idx_traffic_followups_status ON traffic_followups(status);

-- Enable RLS
ALTER TABLE public.traffic_followups ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view traffic_followups"
ON public.traffic_followups FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert traffic_followups"
ON public.traffic_followups FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update traffic_followups"
ON public.traffic_followups FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete traffic_followups"
ON public.traffic_followups FOR DELETE
USING (has_role(auth.uid(), 'Administrador'));

-- Trigger para updated_at
CREATE TRIGGER update_traffic_followups_updated_at
BEFORE UPDATE ON public.traffic_followups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentário na tabela
COMMENT ON TABLE public.traffic_followups IS 'Follow-up agressivo de 9 estágios para leads de tráfego pago';