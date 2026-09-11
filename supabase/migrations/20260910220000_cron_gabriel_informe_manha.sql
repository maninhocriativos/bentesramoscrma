-- Aviso matinal pro Gabriel no grupo da equipe: ele é quem cuida de
-- audiência/contrato/petição (confirmado pelo usuário 2026-09-10), e pediu
-- pra ser informado "no grupo logo cedo" das audiências do dia. Mesmo
-- horário do e-mail de prazos (7h Manaus, dias úteis).

SELECT cron.schedule(
  'isa-scheduler-gabriel-informe-manha',
  '0 11 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"gabriel_informe_manha"}'::jsonb
  );
  $$
);
