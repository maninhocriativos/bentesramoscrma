-- Criar cron job para sync automático de processos a cada 24h (6h da manhã)
SELECT cron.schedule(
  'processo-auto-sync-diario',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-auto-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source": "cron_diario"}'::jsonb
  ) AS request_id;
  $$
);