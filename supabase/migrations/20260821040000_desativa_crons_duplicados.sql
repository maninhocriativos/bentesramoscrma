-- Auditoria de otimização de servidor (2026-08-21): varios crons duplicados
-- rodando a MESMA acao em intervalos sobrepostos, mais um apontando pra uma
-- edge function que nao existe mais. Desativa (unschedule) as duplicatas e
-- o job morto, mantendo sempre 1 cron ativo cobrindo cada tarefa real --
-- nenhuma funcionalidade e removida, so para de repetir o que ja roda.

-- A) followup-automation-job (todo minuto!) chama functions/v1/followup-automation,
-- que nao existe (so existem traffic-followup-automation e zapi-followup-automation).
-- 1.440 chamadas/dia num endpoint 404, sem efeito nenhum.
SELECT cron.unschedule(3);  -- followup-automation-job

-- B) traffic-followup-automation: 3 crons rodavam a mesma acao "process"
-- (15min, 10min, 30min-com-body-vazio-que-tambem-vira-"process"). Mantem so
-- o de 10min (jobid 13), que ja cobre os outros dois com folga.
SELECT cron.unschedule(90); -- traffic-followup-automation (*/15, duplicava o de 10min)
SELECT cron.unschedule(46); -- traffic-followup-every-30min (body vazio = mesma acao "process")

-- C) processo-status-monitor, acao "monitor_semanal": duas copias identicas
-- rodando 1x/semana (mantem jobid 10) e uma terceira rodando a cada 10min
-- por engano (nome diz "semanal" mas disparava a rotina 144x/dia).
SELECT cron.unschedule(11); -- processo_status_monitor_semanal (duplicata exata do jobid 10)
SELECT cron.unschedule(94); -- processo-monitor-semanal (rotina semanal rodando a cada 10min)

-- D) isa-lembrete-sender: mesma function em 2 crons sem diferenca de payload
-- (15min e 5min). Mantem o de 5min (jobid 44), que ja cobre o de 15min.
SELECT cron.unschedule(42); -- isa-lembrete-sender (*/15, redundante com o de 5min)

-- E) isa-scheduler, task "lembretes_compromissos": mesma tarefa em 10min e
-- 30min. Mantem o de 10min (jobid 4), que ja cobre o de 30min.
SELECT cron.unschedule(91); -- isa-scheduler-lembretes (*/30, redundante com o de 10min)

-- Nao mexido: grupo F (isa-scheduler "email_agenda_dia", jobid 5 e 93) --
-- rodam em horarios diferentes o suficiente pra nao ser duplicata obvia,
-- aguardando confirmacao de qual horario e o correto antes de decidir.
