-- Drive sync configuration table
CREATE TABLE IF NOT EXISTS public.drive_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  sync_interval_minutes integer NOT NULL DEFAULT 30,
  last_auto_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.drive_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own sync config"
ON public.drive_sync_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync config"
ON public.drive_sync_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync config"
ON public.drive_sync_config
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_drive_sync_config_updated_at ON public.drive_sync_config;
CREATE TRIGGER update_drive_sync_config_updated_at
BEFORE UPDATE ON public.drive_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;