-- Create system_events table to log all system and integration events
CREATE TABLE public.system_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL, -- lead_status, interacao, contrato, webhook, sistema
  fonte TEXT NOT NULL, -- manychat, clicksign, zapier, n8n, make, whatsapp, sistema
  acao TEXT NOT NULL, -- created, updated, deleted, received, sent
  entidade_tipo TEXT, -- lead, processo, documento, contrato, mensagem
  entidade_id UUID,
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  dados JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_origem TEXT,
  user_agent TEXT,
  processado BOOLEAN DEFAULT false,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "View system events authenticated"
ON public.system_events
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Insert system events"
ON public.system_events
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete events"
ON public.system_events
FOR DELETE
USING (has_role(auth.uid(), 'Administrador'));

-- Create indexes for better performance
CREATE INDEX idx_system_events_tipo ON public.system_events(tipo);
CREATE INDEX idx_system_events_fonte ON public.system_events(fonte);
CREATE INDEX idx_system_events_lead_id ON public.system_events(lead_id);
CREATE INDEX idx_system_events_created_at ON public.system_events(created_at DESC);
CREATE INDEX idx_system_events_entidade ON public.system_events(entidade_tipo, entidade_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_events;