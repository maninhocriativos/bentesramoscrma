-- ============================================================
-- Agendamento automático: processo-auto-sync
-- 07:00 UTC = 03:00 Manaus (UTC-4), todo dia
-- pg_cron e pg_net já são gerenciados pelo Supabase hosted
-- ============================================================

-- Remover agendamento existente se houver (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processo-auto-sync-daily') THEN
    PERFORM cron.unschedule('processo-auto-sync-daily');
  END IF;
END;
$$;

-- Criar o agendamento
SELECT cron.schedule(
  'processo-auto-sync-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-auto-sync',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"max":50}'::jsonb
  );
  $$
);

-- Confirmar
SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'processo-auto-sync-daily';
