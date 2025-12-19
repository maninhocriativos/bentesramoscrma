-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule Advbox calendar sync every hour (at minute 0)
SELECT cron.schedule(
  'sync-advbox-calendar-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/calendar-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body := '{"action": "sync_advbox"}'::jsonb
  ) AS request_id;
  $$
);