-- Agendar o job de monitoramento semanal de processos
-- Executa toda segunda-feira às 9h UTC (5h Manaus)
SELECT cron.schedule(
  'processo_status_monitor_semanal',
  '0 9 * * 1',
  $$
  SELECT extensions.http_post(
    'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/processo-status-monitor',
    '{"action": "monitor_semanal"}'::jsonb,
    'application/json'
  );
  $$
);