
-- Cron 1: 10h Brasília (13:00 UTC) dia 16/02 - Leads de formulário Meta
SELECT cron.schedule(
  'prova-social-meta-form-16fev',
  '0 13 16 2 *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-followup-prova-social',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"mode": "meta_form", "intervalo_minutos": 10}'::jsonb
  ) AS request_id;
  $$
);

-- Cron 2: 19h Brasília (22:00 UTC) dia 16/02 - Leads estagnados
SELECT cron.schedule(
  'prova-social-stagnant-16fev',
  '0 22 16 2 *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-followup-prova-social',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"mode": "stagnant", "intervalo_minutos": 10}'::jsonb
  ) AS request_id;
  $$
);
