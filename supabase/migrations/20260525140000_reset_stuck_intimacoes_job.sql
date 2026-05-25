-- Reseta jobs de intimações travados em processing/pending
-- e dispara um novo sync imediatamente

UPDATE public.intimacoes_sync_jobs
SET
  status     = 'failed',
  last_error = 'Reset manual — job travado impedindo novos syncs',
  updated_at = NOW()
WHERE job_type = 'fetch_intimacoes'
  AND status IN ('pending', 'processing');

-- Dispara sync imediato após limpar a fila
SELECT net.http_post(
  url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
  body    := '{"source":"migration_reset_stuck"}'::jsonb
) AS request_id;
