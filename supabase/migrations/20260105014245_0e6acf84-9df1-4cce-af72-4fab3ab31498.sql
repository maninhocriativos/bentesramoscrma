-- Criar cron job que roda a cada 2 horas para verificar agendamentos da Isa
SELECT cron.schedule(
  'isa-check-appointments-every-2h',
  '0 */2 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-check-appointments',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);