-- Cron: lembretes de audiência via WhatsApp, 15/7/3 dias antes.
-- Granularidade diária é suficiente (janela é por dia, não por hora).
-- Roda 12:00 UTC = 08:00 Manaus (início do expediente).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-lembretes-audiencia') THEN
    PERFORM cron.unschedule('isa-scheduler-lembretes-audiencia');
  END IF;
END;
$$;

SELECT cron.schedule(
  'isa-scheduler-lembretes-audiencia',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"lembretes_audiencia"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'isa-scheduler-lembretes-audiencia';
