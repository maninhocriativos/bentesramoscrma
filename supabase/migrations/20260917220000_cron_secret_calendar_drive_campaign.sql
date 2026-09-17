-- Auditoria de 2026-09-17: calendar-sync, drive-sync e
-- campaign-optin-dispatch ganharam checagem de auth no código
-- (requireStaffOrInternal) — mas os 3 pg_cron jobs abaixo mandavam a
-- anon key (pública, vai no bundle do site) como Authorization, que a
-- nova checagem corretamente NÃO aceita como prova de chamador
-- confiável. Sem este passo, o fix quebraria a sincronização automática
-- horária do Calendar, o polling do Drive a cada 15min, e o processador
-- de campanha a cada 5min.
--
-- Reagenda os 3 jobs mantendo a Authorization atual intacta (não quebra
-- nada por si só) e ACRESCENTANDO o header X-Cron-Secret, checado contra
-- o secret CRON_INTERNAL_SECRET (já criado via Management API antes
-- desta migration).

SELECT cron.unschedule('sync-advbox-calendar-hourly');
SELECT cron.schedule(
  'sync-advbox-calendar-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/calendar-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg", "X-Cron-Secret": "2bd6a77327ed93443fa53bcca1fb8e4dec0df8c094cd4b80f3f07bf0bd196e04"}'::jsonb,
    body := '{"action": "sync_advbox"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('drive-auto-sync-polling');
SELECT cron.schedule(
  'drive-auto-sync-polling',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/drive-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg", "X-Cron-Secret": "2bd6a77327ed93443fa53bcca1fb8e4dec0df8c094cd4b80f3f07bf0bd196e04"}'::jsonb,
    body := '{"action": "auto_sync_cron"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('campaign-batch-processor');
SELECT cron.schedule(
  'campaign-batch-processor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/campaign-optin-dispatch',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg", "X-Cron-Secret": "2bd6a77327ed93443fa53bcca1fb8e4dec0df8c094cd4b80f3f07bf0bd196e04"}'::jsonb,
    body:='{"action": "process_scheduled"}'::jsonb
  ) AS request_id;
  $$
);
