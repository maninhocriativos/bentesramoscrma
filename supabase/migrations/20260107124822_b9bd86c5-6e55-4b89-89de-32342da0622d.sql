-- Ajusta o cron do job de lembretes de compromissos para rodar frequentemente.
-- Antes: 0 17 * * * (17:00 UTC = 13:00 Manaus) -> perdia lembretes da manhã.
-- Depois: a cada 10 minutos (UTC), cobre lembretes de 24h/1h em qualquer horário.

select cron.alter_job(6, schedule := '*/10 * * * *');
