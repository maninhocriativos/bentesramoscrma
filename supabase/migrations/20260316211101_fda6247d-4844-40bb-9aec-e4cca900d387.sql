-- Remove old cron jobs with default 5s timeout
SELECT cron.unschedule(22);
SELECT cron.unschedule(23);

-- Recreate with 120s timeout
SELECT cron.schedule(
  'intimacoes-sync-morning',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body := '{"time": "morning"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

SELECT cron.schedule(
  'intimacoes-sync-afternoon',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body := '{"time": "afternoon"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);