-- Drive sync diagnostics + queue

-- Add per-document retry + error fields
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS sync_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_last_error text,
  ADD COLUMN IF NOT EXISTS sync_last_attempt_at timestamp with time zone;

-- Queue / jobs table
CREATE TABLE IF NOT EXISTS public.drive_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  direction text NOT NULL, -- 'push' | 'pull'
  kind text NOT NULL,      -- e.g. 'sync_to_drive' | 'import_from_drive' | 'scan'
  document_id uuid NULL REFERENCES public.documentos(id) ON DELETE SET NULL,
  drive_file_id text NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | success | error
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text NULL,
  started_at timestamp with time zone NULL,
  finished_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.drive_sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'drive_sync_jobs'
      AND policyname = 'Users can view own drive sync jobs'
  ) THEN
    CREATE POLICY "Users can view own drive sync jobs"
    ON public.drive_sync_jobs
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger helper (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_drive_sync_jobs_updated_at ON public.drive_sync_jobs;
CREATE TRIGGER update_drive_sync_jobs_updated_at
BEFORE UPDATE ON public.drive_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drive_sync_jobs_user_status_created
  ON public.drive_sync_jobs (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drive_sync_jobs_drive_file_id
  ON public.drive_sync_jobs (drive_file_id);

CREATE INDEX IF NOT EXISTS idx_documentos_sync_status
  ON public.documentos (sync_status);

CREATE INDEX IF NOT EXISTS idx_documentos_drive_file_id
  ON public.documentos (drive_file_id);
