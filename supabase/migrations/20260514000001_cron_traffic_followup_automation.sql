-- Cron job: traffic-followup-automation a cada 15 minutos
-- Processa follow-ups pendentes, reativações e campanhas de nutrição
-- A própria função verifica horário permitido (8h-20h Manaus para followups, 9h-18h para reativação antiga)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'traffic-followup-automation') THEN
    PERFORM cron.unschedule('traffic-followup-automation');
  END IF;
END;
$$;

SELECT cron.schedule(
  'traffic-followup-automation',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/traffic-followup-automation',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"action":"process"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'traffic-followup-automation';
