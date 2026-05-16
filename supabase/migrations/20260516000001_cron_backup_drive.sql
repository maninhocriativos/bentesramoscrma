DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backup-mensagens-drive-daily') THEN
    PERFORM cron.unschedule('backup-mensagens-drive-daily');
  END IF;
END;
$$;

SELECT cron.schedule(
  'backup-mensagens-drive-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/backup-mensagens-drive',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'backup-mensagens-drive-daily';
