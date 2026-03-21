
-- ============================
-- ALTERAÇÃO 1: Intimações - de 5x/dia para 3x/dia
-- Remove os 5 cron jobs antigos
-- ============================
SELECT cron.unschedule('intimacoes-sync-0700');
SELECT cron.unschedule('intimacoes-sync-0930');
SELECT cron.unschedule('intimacoes-sync-1200');
SELECT cron.unschedule('intimacoes-sync-1430');
SELECT cron.unschedule('intimacoes-sync-1700');

-- Cria 3 novos: 06:00, 12:00, 18:00 Manaus = 10:00, 16:00, 22:00 UTC
SELECT cron.schedule(
  'intimacoes-sync-0600',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-0600"}'::jsonb
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
  'intimacoes-sync-1800',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"source":"cron-1800"}'::jsonb
  ) AS request_id;
  $$
);

-- ============================
-- ALTERAÇÃO 2: Processos - de 1x/semana (domingo) para 2x/semana (terça e sexta)
-- ============================
SELECT cron.unschedule('processo-auto-sync-semanal');

-- Terça (2) e Sexta (5) às 06:00 UTC = 02:00 Manaus
SELECT cron.schedule(
  'processo-auto-sync-ter-sex',
  '0 6 * * 2,5',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-auto-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body:='{"max": 50}'::jsonb
  ) AS request_id;
  $$
);
