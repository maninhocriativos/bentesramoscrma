
-- Add dedupe_key column to meta_form_leads for Google Sheets deduplication
ALTER TABLE public.meta_form_leads ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE public.meta_form_leads ADD COLUMN IF NOT EXISTS source text DEFAULT 'meta_api';
ALTER TABLE public.meta_form_leads ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE public.meta_form_leads ADD COLUMN IF NOT EXISTS adset_name text;
ALTER TABLE public.meta_form_leads ADD COLUMN IF NOT EXISTS ad_name text;

-- Create unique index on dedupe_key (partial - only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_form_leads_dedupe_key 
  ON public.meta_form_leads (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Create integrations_state table for tracking sync progress
CREATE TABLE IF NOT EXISTS public.integrations_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  spreadsheet_id text,
  sheet_name text,
  last_row integer DEFAULT 1,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integrations_state ENABLE ROW LEVEL SECURITY;

-- Policies for integrations_state (service role only via edge functions, admins can view)
CREATE POLICY "Admins can view integrations_state"
  ON public.integrations_state FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'Administrador'::app_role));

CREATE POLICY "System can manage integrations_state"
  ON public.integrations_state FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial state for the Google Sheets sync
INSERT INTO public.integrations_state (provider, spreadsheet_id, sheet_name, last_row)
VALUES ('google_sheets_meta_leads', '1x3EQ2WAWIT1rhAjZhLQIEQYOIIQ9cT6dnx7Vdj9TC9A', 'Página1', 1)
ON CONFLICT DO NOTHING;
