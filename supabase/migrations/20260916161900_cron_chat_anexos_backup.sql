-- Dispara chat-anexos-backup a cada 15min. Cada rodada processa um lote
-- pequeno (50) de anexos ainda não copiados pro R2 — sem pressa, zera o
-- backlog do histórico aos poucos, nunca toca no caminho ao vivo do chat.

SELECT cron.schedule(
  'chat-anexos-backup',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/chat-anexos-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
