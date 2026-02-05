-- Create meta_form_leads table for Facebook/Instagram Lead Ads
CREATE TABLE public.meta_form_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_lead_id TEXT UNIQUE NOT NULL,
  form_id TEXT,
  ad_id TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  created_time TIMESTAMP WITH TIME ZONE,
  -- Normalized fields
  nome TEXT,
  telefone TEXT,
  email TEXT,
  -- Extra fields
  form_fields JSONB DEFAULT '{}'::jsonb,
  raw JSONB DEFAULT '{}'::jsonb,
  -- Control fields
  status TEXT NOT NULL DEFAULT 'novo',
  linked_lead_id UUID REFERENCES public.leads_juridicos(id),
  last_contact_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create crm_conversations table
CREATE TABLE public.crm_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_type TEXT NOT NULL DEFAULT 'meta_forms',
  lead_ref_id UUID NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create crm_messages table
CREATE TABLE public.crm_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'agent',
  sender_name TEXT,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'crm',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_meta_form_leads_status ON public.meta_form_leads(status);
CREATE INDEX idx_meta_form_leads_created_at ON public.meta_form_leads(created_at DESC);
CREATE INDEX idx_meta_form_leads_meta_lead_id ON public.meta_form_leads(meta_lead_id);
CREATE INDEX idx_crm_conversations_lead_ref ON public.crm_conversations(lead_ref_id);
CREATE INDEX idx_crm_conversations_lead_type ON public.crm_conversations(lead_type);
CREATE INDEX idx_crm_messages_conversation ON public.crm_messages(conversation_id);

-- Enable RLS
ALTER TABLE public.meta_form_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_form_leads
CREATE POLICY "Authenticated users can view meta_form_leads"
  ON public.meta_form_leads FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert meta_form_leads"
  ON public.meta_form_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update meta_form_leads"
  ON public.meta_form_leads FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete meta_form_leads"
  ON public.meta_form_leads FOR DELETE
  USING (has_role(auth.uid(), 'Administrador'));

-- RLS policies for crm_conversations
CREATE POLICY "Authenticated users can view crm_conversations"
  ON public.crm_conversations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert crm_conversations"
  ON public.crm_conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update crm_conversations"
  ON public.crm_conversations FOR UPDATE
  USING (auth.role() = 'authenticated');

-- RLS policies for crm_messages
CREATE POLICY "Authenticated users can view crm_messages"
  ON public.crm_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert crm_messages"
  ON public.crm_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_meta_form_leads_updated_at
  BEFORE UPDATE ON public.meta_form_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_conversations_updated_at
  BEFORE UPDATE ON public.crm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();