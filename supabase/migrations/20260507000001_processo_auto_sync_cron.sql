-- ============================================================
-- Agendamento automático de sincronização de processos
-- Executa processo-auto-sync todo dia às 03:00 (Manaus = UTC-4)
-- ============================================================
--
-- PRÉ-REQUISITO (rodar uma vez no SQL Editor do Supabase):
--   ALTER DATABASE postgres
--     SET "app.settings.service_role_key" = '<sua_service_role_key>';
--
-- A service_role_key está em: Supabase Dashboard → Settings → API
-- ============================================================

-- Garantir extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover agendamento existente (idempotente)
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'processo-auto-sync-daily';

-- Agendar: 07:00 UTC = 03:00 Manaus (UTC-4), todo dia
SELECT cron.schedule(
  'processo-auto-sync-daily',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-auto-sync',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || coalesce(
          current_setting('app.settings.service_role_key', true), ''
        )
      ),
      body    := '{"max": 50}'::jsonb
    ) AS request_id;
  $$
);

-- Verificar agendamento criado
SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'processo-auto-sync-daily';
