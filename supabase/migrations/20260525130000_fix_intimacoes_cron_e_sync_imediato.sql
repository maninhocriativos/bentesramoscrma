-- Fix: recria os cron jobs de intimações com URL/token corretos
-- e dispara um sync imediato para trazer as intimações de hoje.
--
-- Contexto do problema: a migration 20260522000001 usou placeholders
-- literais 'SUPABASE_PROJECT_URL' / 'SUPABASE_SERVICE_KEY' no texto SQL,
-- criando crons com URL inválida que nunca dispararam.
-- Os jobs antigos (intimacoes-sync-0600/1200/1800) usavam anon token, que
-- funciona pois verify_jwt=false, mas podem ter sido sobrescritos.

DO $$
BEGIN
  -- Remove TODOS os nomes possíveis de crons de intimações (idempotente)
  BEGIN PERFORM cron.unschedule('intimacoes-sync-0600');    EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-1200');    EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-1800');    EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-morning'); EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-afternoon'); EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-manha');        EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-tarde');        EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-0700');    EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-0930');    EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-1430');    EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('intimacoes-sync-1700');    EXCEPTION WHEN others THEN NULL; END;
END $$;

-- Cria 3 crons diários (incluindo domingo) em horário de Manaus (UTC-4):
--   06:00 Manaus = 10:00 UTC
--   12:00 Manaus = 16:00 UTC
--   17:00 Manaus = 21:00 UTC

SELECT cron.schedule(
  'intimacoes-manha',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"source":"cron_manha"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'intimacoes-meio-dia',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"source":"cron_meiodia"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'intimacoes-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"source":"cron_tarde"}'::jsonb
  ) AS request_id;
  $$
);

-- Dispara sync imediato ao aplicar a migration (traz intimações de hoje agora)
SELECT net.http_post(
  url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-scheduler',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
  body    := '{"source":"migration_sync_imediato"}'::jsonb
) AS request_id;

-- Confirma os crons criados
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('intimacoes-manha','intimacoes-meio-dia','intimacoes-tarde');
