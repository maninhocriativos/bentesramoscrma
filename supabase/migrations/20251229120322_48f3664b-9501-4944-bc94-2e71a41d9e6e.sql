-- Create cron job for auto-sync (runs every 15 minutes, but respects user-configured intervals)
SELECT cron.schedule(
  'drive-auto-sync-polling',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/drive-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body := '{"action": "auto_sync_cron"}'::jsonb
  ) AS request_id;
  $$
);