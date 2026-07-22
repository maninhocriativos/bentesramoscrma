-- Resumo diario por e-mail das intimacoes/publicacoes ainda nao lidas, por
-- advogado responsavel (com destaque das que tem prazo urgente/vencido).
-- Mesmo horario dos demais e-mails diarios do isa-scheduler (7h UTC = 3h
-- Manaus, pronto antes do expediente), so 5 minutos depois pra nao competir
-- com o job de agenda do dia.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'isa-scheduler-email-intimacoes') THEN
    PERFORM cron.unschedule('isa-scheduler-email-intimacoes');
  END IF;
END;
$$;

SELECT cron.schedule(
  'isa-scheduler-email-intimacoes',
  '5 7 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"email_intimacoes_pendentes"}'::jsonb
  );
  $$
);
