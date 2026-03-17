
-- Remove old 2x daily schedules
SELECT cron.unschedule('intimacoes-sync-morning');
SELECT cron.unschedule('intimacoes-sync-afternoon');

-- Schedule 5x daily: 07:00, 09:30, 12:00, 14:30, 17:00 Manaus (UTC-4)
-- = 11:00, 13:30, 16:00, 18:30, 21:00 UTC
SELECT cron.schedule(
  'intimacoes-sync-0700',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-0700"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'intimacoes-sync-0930',
  '30 13 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-0930"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'intimacoes-sync-1200',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-1200"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'intimacoes-sync-1430',
  '30 18 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-1430"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'intimacoes-sync-1700',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-1700"}'::jsonb
  ) AS request_id;
  $$
);
