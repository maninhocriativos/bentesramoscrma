-- Corrige o backup de mensagens: o backup COMPLETO (contatos + mensagens),
-- feito pela função backup-chat-drive, passa a rodar DIARIAMENTE às 03:00.
-- Antes rodava só semanalmente (domingos), e o backup diário granular
-- (backup-mensagens-drive) nunca foi aplicado (migration anterior ao cutoff
-- do deploy automático), então não havia backup diário de fato.

DO $$
BEGIN
  -- Remove o agendamento semanal antigo
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backup-chat-drive-weekly') THEN
    PERFORM cron.unschedule('backup-chat-drive-weekly');
  END IF;
  -- Idempotente: remove o diário se já existir, para recriar
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backup-chat-drive-daily') THEN
    PERFORM cron.unschedule('backup-chat-drive-daily');
  END IF;
END;
$$;

-- Backup completo diário às 03:00 (contatos + mensagens → Drive: Backups-CRM/Chat/DATA)
SELECT cron.schedule(
  'backup-chat-drive-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/backup-chat-drive',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Confirmação
SELECT jobid, jobname, schedule, active
  FROM cron.job
 WHERE jobname IN ('backup-chat-drive-daily', 'backup-chat-drive-weekly', 'backup-mensagens-drive-daily');
