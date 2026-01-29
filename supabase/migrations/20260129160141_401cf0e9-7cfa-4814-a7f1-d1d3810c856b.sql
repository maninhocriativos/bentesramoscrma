-- Cron job para processar follow-ups de tráfego a cada 10 minutos
SELECT cron.schedule(
  'traffic-followup-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/traffic-followup-automation',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"action": "process"}'::jsonb
  ) AS request_id;
  $$
);