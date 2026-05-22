-- Agenda busca automática de intimações 2x por dia via pg_cron + pg_net
-- 08:00 e 17:00 horário de Brasília (UTC-3) = 11:00 e 20:00 UTC
--
-- INSTRUÇÕES: substitua os dois valores abaixo antes de executar:
--   SUPABASE_PROJECT_URL  → ex: https://abcdefgh.supabase.co
--   SUPABASE_SERVICE_KEY  → Settings > API > service_role (secret)

DO $$
DECLARE
  project_url text := 'SUPABASE_PROJECT_URL';
  service_key text := 'SUPABASE_SERVICE_KEY';
BEGIN
  -- Remove agendamentos anteriores (idempotente)
  BEGIN SELECT cron.unschedule('intimacoes-manha'); EXCEPTION WHEN others THEN NULL; END;
  BEGIN SELECT cron.unschedule('intimacoes-tarde'); EXCEPTION WHEN others THEN NULL; END;

  -- 08:00 Brasília = 11:00 UTC  (Seg a Sáb)
  PERFORM cron.schedule(
    'intimacoes-manha',
    '0 11 * * 1-6',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
        body := '{"source":"cron_manha"}'::jsonb
      )$cron$,
      project_url || '/functions/v1/intimacoes-scheduler',
      service_key
    )
  );

  -- 17:00 Brasília = 20:00 UTC  (Seg a Sáb)
  PERFORM cron.schedule(
    'intimacoes-tarde',
    '0 20 * * 1-6',
    format(
      $cron$SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
        body := '{"source":"cron_tarde"}'::jsonb
      )$cron$,
      project_url || '/functions/v1/intimacoes-scheduler',
      service_key
    )
  );

  RAISE NOTICE 'Cron intimações agendado: 08h e 17h (Brasília)';
END $$;
