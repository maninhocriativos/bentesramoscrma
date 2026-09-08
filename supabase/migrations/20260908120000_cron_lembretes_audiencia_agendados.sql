-- Cron: entrega os lembretes de audiência que foram adiados pro fuso do
-- endereço do cliente (leads_juridicos.uf) — hoje só afeta clientes no Acre
-- (1h atrás de Manaus). O cron principal (isa-scheduler-lembretes-audiencia,
-- 12:00 UTC) decide diariamente quem é devido e, quando precisa esperar,
-- grava scheduled_for em system_events em vez de mandar na hora; este cron
-- só varre e entrega quando a hora chega. Granularidade de 10 min é
-- suficiente (delta de fuso no Brasil é de no máximo 2h).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-lembretes-audiencia-agendados') THEN
    PERFORM cron.unschedule('isa-scheduler-lembretes-audiencia-agendados');
  END IF;
END;
$$;

SELECT cron.schedule(
  'isa-scheduler-lembretes-audiencia-agendados',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"lembretes_audiencia_agendados"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'isa-scheduler-lembretes-audiencia-agendados';
