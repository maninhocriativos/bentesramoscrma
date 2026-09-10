-- A tarefa "email_prazos_proximos" já existe no código do isa-scheduler
-- (envia e-mail por responsável com tarefas — inclusive audiências, que são
-- salvas como tarefa com data_limite — vencendo nos próximos 7 dias), mas
-- nunca tinha sido agendada num cron: só rodava se alguém chamasse manual
-- ou via task "all". Pedido do usuário: e-mails da Isa precisam ter
-- conteúdo real e acionável ("esse lead está sem retorno", "amanhã tem
-- audiência") — leads_sem_retorno já roda (jobid 7, 17h Manaus); prazos
-- próximos ficava de fora. Mesmo horário do e-mail de agenda do dia (7h
-- Manaus, começo do expediente), só em dias úteis.

SELECT cron.schedule(
  'isa-scheduler-email-prazos-proximos',
  '0 11 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"email_prazos_proximos"}'::jsonb
  );
  $$
);
