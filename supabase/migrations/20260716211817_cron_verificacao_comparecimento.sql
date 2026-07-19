-- Cron: verificação de não comparecimento em consultas agendadas (presencial/online)
-- Roda a cada 30min, mesma cadência do cron de lembretes já existente.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-verificacao-comparecimento') THEN
    PERFORM cron.unschedule('isa-scheduler-verificacao-comparecimento');
  END IF;
END;
$$;

SELECT cron.schedule(
  'isa-scheduler-verificacao-comparecimento',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"verificacao_comparecimento"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'isa-scheduler-verificacao-comparecimento';
