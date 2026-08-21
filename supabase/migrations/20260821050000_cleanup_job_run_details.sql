-- cron.job_run_details (log de execucao de TODOS os cron jobs) nunca teve
-- limpeza automatica -- foi assim que chegou a 821MB antes do VACUUM FULL
-- de hoje. Agenda uma limpeza diaria que mantem so os ultimos 7 dias de
-- historico (suficiente pra depurar um job com problema recente), evitando
-- que o inchaço volte a se acumular indefinidamente. Nao mexe em nenhum
-- cron existente nem em nenhuma outra tabela.
SELECT cron.schedule(
  'cleanup-job-run-details',
  '0 3 * * *',
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'; $$
);
