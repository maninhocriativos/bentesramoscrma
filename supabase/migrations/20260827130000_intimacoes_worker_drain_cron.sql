-- Hoje o intimacoes-worker só é chamado de novo automaticamente depois de um
-- job COMPLETADO com sucesso (self-chain em runInBackground). Quando um job
-- falha (ex: DJEN 403 intermitente) e fica agendado para retry (status
-- pending, run_after em alguns minutos), nada dispara o worker de novo até o
-- próximo cron de sincronização 6h depois — na prática, sem sync automático
-- de verdade quando a fonte falha justo no horário do cron.
--
-- Este job dispara o intimacoes-worker a cada 10 minutos só para drenar a
-- fila (RPC claim_next_intimacoes_sync_job é um no-op barato quando não há
-- job pendente), garantindo que jobs marcados para retry sejam retomados
-- logo depois do backoff, e não só na próxima janela de 6h.
SELECT cron.schedule(
  'intimacoes-worker-drain',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/intimacoes-worker',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"source":"worker-drain-cron"}'::jsonb
  ) AS request_id;
  $$
);
