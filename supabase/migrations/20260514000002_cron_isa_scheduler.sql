-- Crons para isa-scheduler (lembretes de compromissos e follow-up pós-atendimento)
-- A função verifica dedup internamente via system_events (não envia duplicatas)

-- Limpar jobs anteriores se existirem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-lembretes') THEN
    PERFORM cron.unschedule('isa-scheduler-lembretes');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-followup-pos') THEN
    PERFORM cron.unschedule('isa-scheduler-followup-pos');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-email-dia') THEN
    PERFORM cron.unschedule('isa-scheduler-email-dia');
  END IF;
END;
$$;

-- Lembretes de compromissos: a cada 30min (verifica janelas 1h e 24h antes do horário)
SELECT cron.schedule(
  'isa-scheduler-lembretes',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"lembretes_compromissos"}'::jsonb
  );
  $$
);

-- Follow-up pós-atendimento: a cada hora (busca compromissos que terminaram nas últimas 24h)
SELECT cron.schedule(
  'isa-scheduler-followup-pos',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"followup_pos_atendimento"}'::jsonb
  );
  $$
);

-- Email agenda do dia: todo dia às 7h UTC = 3h Manaus (entrega antes do expediente)
SELECT cron.schedule(
  'isa-scheduler-email-dia',
  '0 7 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"email_agenda_dia"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname IN ('isa-scheduler-lembretes','isa-scheduler-followup-pos','isa-scheduler-email-dia');
