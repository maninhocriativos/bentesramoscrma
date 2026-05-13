-- Notificação mensal de processos para leads do escritório
-- Dispara todo dia 1º às 14:00 UTC = 10:00 Manaus (UTC-4)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processo-mensal-escritorio') THEN
    PERFORM cron.unschedule('processo-mensal-escritorio');
  END IF;
END;
$$;

SELECT cron.schedule(
  'processo-mensal-escritorio',
  '0 14 1 * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-status-monitor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"action":"notificar_mensal_escritorio"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'processo-mensal-escritorio';
