DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'traffic-lembretes-2min') THEN
    PERFORM cron.unschedule('traffic-lembretes-2min');
  END IF;
END;
$$;

SELECT cron.schedule(
  'traffic-lembretes-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/traffic-followup-automation',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"action":"lembretes"}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'traffic-lembretes-2min';
