
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL DEFAULT 'juros_abusivos_2026',
  nome TEXT,
  telefone TEXT NOT NULL,
  telefone_normalizado TEXT,
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  subscriber_id TEXT,
  stage TEXT NOT NULL DEFAULT 'pending' CHECK (stage IN ('pending', 'optin_sent', 'accepted', 'rejected', 'campaign_sent', 'error')),
  batch_number INT,
  optin_sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  campaign_sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage campaign_recipients"
  ON public.campaign_recipients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_campaign_recipients_stage ON public.campaign_recipients(stage);
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_name);
CREATE INDEX idx_campaign_recipients_telefone ON public.campaign_recipients(telefone_normalizado);
