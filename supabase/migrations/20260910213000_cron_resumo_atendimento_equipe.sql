-- Resumo diário de atendimento por pessoa da equipe (leads atendidos, sem
-- retorno há +7 dias, conversões do dia, tempo médio de resposta + comentário
-- gerado por IA de como melhorar), postado no grupo interno de WhatsApp.
-- Pedido do usuário em 2026-09-10. Roda no fim do expediente, dias úteis.
--
-- IMPORTANTE: grupo é "Bentes Ramos Comercial" (confirmado pelo usuário). O
-- envio só funciona depois que a instância "Bentes Ramos Trafego" for
-- adicionada como MEMBRO desse grupo no WhatsApp — até lá, a tarefa roda,
-- calcula tudo e só registra o texto gerado no log (não falha, não envia
-- nada errado).

SELECT cron.schedule(
  'isa-scheduler-resumo-equipe',
  '0 22 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"resumo_atendimento_equipe"}'::jsonb
  );
  $$
);
