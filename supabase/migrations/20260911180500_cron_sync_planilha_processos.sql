-- Sincronização automática da planilha "Relação de Processos 2013 à
-- 2026.xlsx" pra página de Dados. A função checa modifiedTime no Drive
-- antes de baixar/parsear — rodar a cada 20min é barato (só 1 chamada leve
-- de metadados quando não houve mudança).

SELECT cron.schedule(
  'sync-planilha-processos',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/sync-planilha-processos',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
