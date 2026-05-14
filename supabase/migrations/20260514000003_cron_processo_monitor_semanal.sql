-- Cron para processo-status-monitor (monitor_semanal)
-- Roda 1x por dia às 13h UTC = 9h Manaus — avalia TODOS os processos com
-- notificacao_ativa=true e só envia os que já completaram sua janela de frequência.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processo-monitor-semanal') THEN
    PERFORM cron.unschedule('processo-monitor-semanal');
  END IF;
END;
$$;

SELECT cron.schedule(
  'processo-monitor-semanal',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-status-monitor',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"action":"monitor_semanal"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'processo-monitor-semanal';
