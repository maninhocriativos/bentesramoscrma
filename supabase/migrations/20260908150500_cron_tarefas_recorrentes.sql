-- Cron: gera as tarefas do dia a partir de tarefas_recorrentes ativas.
-- Roda bem cedo em horário de Manaus (04h = 08:00 UTC), antes do expediente,
-- pra já estar tudo pronto quando a equipe chegar.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tarefas-recorrentes-gerar') THEN
    PERFORM cron.unschedule('tarefas-recorrentes-gerar');
  END IF;
END;
$$;

SELECT cron.schedule(
  'tarefas-recorrentes-gerar',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/tarefas-recorrentes-gerar',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'tarefas-recorrentes-gerar';
