
-- Create cron jobs for automatic intimações sync twice daily
-- Morning at 08:00 and afternoon at 14:00 (Manaus timezone UTC-4)
SELECT cron.schedule(
  'intimacoes-sync-morning',
  '0 12 * * *',  -- 12:00 UTC = 08:00 Manaus
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/intimacoes-oab',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'intimacoes-sync-afternoon',
  '0 18 * * *',  -- 18:00 UTC = 14:00 Manaus
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/intimacoes-oab',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
