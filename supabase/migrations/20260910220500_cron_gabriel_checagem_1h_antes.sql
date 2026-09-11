-- Checagem "falta 1h pra audiência" com o Gabriel, marcado (@) no grupo da
-- equipe. Pedido do usuário 2026-09-10: "verificar também com ele uma hora
-- antes da audiência". Roda a cada 15min em horário comercial (6h-19h
-- Manaus = 10h-23h UTC), dias úteis — a task em si dedupa via
-- system_events (ação 'gabriel_checagem_1h_antes' + entidade_id da
-- audiência), então rodar de novo dentro da mesma janela não duplica envio.

SELECT cron.schedule(
  'isa-scheduler-gabriel-checagem-1h',
  '*/15 10-23 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/isa-scheduler',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{"task":"gabriel_checagem_1h"}'::jsonb
  );
  $$
);
