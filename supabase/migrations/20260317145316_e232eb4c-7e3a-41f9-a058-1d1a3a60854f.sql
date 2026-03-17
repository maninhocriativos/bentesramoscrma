-- Fila resiliente para sincronização automática de intimações/publicações
CREATE TABLE IF NOT EXISTS public.intimacoes_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL DEFAULT 'fetch_intimacoes',
  status TEXT NOT NULL DEFAULT 'pending',
  trigger_source TEXT NOT NULL DEFAULT 'cron',
  oab_numero TEXT NOT NULL,
  oab_uf TEXT NOT NULL DEFAULT 'AM',
  advogado_id UUID NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,
  last_error TEXT NULL,
  result_summary JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intimacoes_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_intimacoes_sync_jobs_status_run_after
  ON public.intimacoes_sync_jobs (status, run_after, created_at);

CREATE INDEX IF NOT EXISTS idx_intimacoes_sync_jobs_oab_created_at
  ON public.intimacoes_sync_jobs (oab_numero, oab_uf, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_intimacoes_sync_jobs_active_per_oab
  ON public.intimacoes_sync_jobs (job_type, oab_numero, oab_uf)
  WHERE status IN ('pending', 'processing');

DROP POLICY IF EXISTS "Admins and managers can view sync jobs" ON public.intimacoes_sync_jobs;
CREATE POLICY "Admins and managers can view sync jobs"
ON public.intimacoes_sync_jobs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Administrador')
  OR public.has_role(auth.uid(), 'Gerente')
);

DROP POLICY IF EXISTS "Admins can manage sync jobs" ON public.intimacoes_sync_jobs;
CREATE POLICY "Admins can manage sync jobs"
ON public.intimacoes_sync_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'Administrador'))
WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP TRIGGER IF EXISTS update_intimacoes_sync_jobs_updated_at ON public.intimacoes_sync_jobs;
CREATE TRIGGER update_intimacoes_sync_jobs_updated_at
BEFORE UPDATE ON public.intimacoes_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_next_intimacoes_sync_job()
RETURNS SETOF public.intimacoes_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.intimacoes_sync_jobs;
BEGIN
  UPDATE public.intimacoes_sync_jobs
  SET
    status = 'pending',
    run_after = now(),
    updated_at = now(),
    last_error = COALESCE(last_error, 'stale job requeued automatically')
  WHERE status = 'processing'
    AND started_at < now() - interval '20 minutes';

  WITH next_job AS (
    SELECT id
    FROM public.intimacoes_sync_jobs
    WHERE job_type = 'fetch_intimacoes'
      AND status = 'pending'
      AND run_after <= now()
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.intimacoes_sync_jobs j
  SET
    status = 'processing',
    started_at = now(),
    attempts = j.attempts + 1,
    updated_at = now(),
    last_error = NULL
  FROM next_job
  WHERE j.id = next_job.id
  RETURNING j.* INTO claimed;

  IF claimed.id IS NOT NULL THEN
    RETURN NEXT claimed;
  END IF;

  RETURN;
END;
$$;