-- Create table to track contract reminders
CREATE TABLE public.contract_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_key TEXT NOT NULL,
  document_name TEXT,
  contract_link TEXT,
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent_12h, sent_24h, sent_48h, sent_5d, signed, cancelled
  reminder_stage INTEGER NOT NULL DEFAULT 0, -- 0: not started, 1: 12h, 2: 24h, 3: 48h, 4: 5d
  next_reminder_at TIMESTAMPTZ,
  last_reminder_at TIMESTAMPTZ,
  contract_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_at TIMESTAMPTZ,
  linked_by TEXT, -- 'auto', 'isa', 'manual'
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_key)
);

-- Enable RLS
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations for authenticated users"
ON public.contract_reminders
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for efficient queries
CREATE INDEX idx_contract_reminders_lead ON public.contract_reminders(lead_id);
CREATE INDEX idx_contract_reminders_status ON public.contract_reminders(status);
CREATE INDEX idx_contract_reminders_next_reminder ON public.contract_reminders(next_reminder_at) WHERE status = 'pending';

-- Create trigger for updated_at
CREATE TRIGGER update_contract_reminders_updated_at
BEFORE UPDATE ON public.contract_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add contract_key column to leads_juridicos for direct linking
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS contract_key TEXT;