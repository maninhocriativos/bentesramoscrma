-- BUG real achado pelo usuário com evidência (relatório impresso da Agenda
-- de hoje mostrando "Confirmado" em compromissos de HOJE que nunca foram
-- confirmados de verdade): a migration anterior
-- (20260914140000_compromisso_historico_ja_confirmado.sql) comparava
-- `data_inicio < now()` — um TIMESTAMP exato, não a data. Um compromisso de
-- HOJE às 09:00 é "passado" em relação a `now()` assim que o relógio passa
-- das 9h, mesmo sendo o dia de hoje — batia como "histórico" e nascia
-- (ou virava, na limpeza em massa) 'confirmado' incorretamente. 7 dos 8
-- compromissos de hoje foram afetados.
--
-- Fix: comparar por DIA (current_date), igual já foi feito corretamente em
-- Intimações no mesmo dia — só o que é de um dia ANTERIOR a hoje é
-- histórico; hoje inteiro continua "pendente" de verdade até confirmação
-- real.
create or replace function criar_compromisso_da_tarefa()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_data_inicio timestamptz;
begin
  if new.prazo_fatal is null then
    return new;
  end if;

  v_data_inicio := (new.prazo_fatal + coalesce(new.horario, '09:00'::time)) at time zone 'America/Manaus';

  insert into compromissos (
    titulo, descricao, data_inicio, tipo,
    lead_id, processo_id, responsavel_id, origem, tarefa_id, confirmacao_status
  ) values (
    new.titulo,
    new.descricao,
    v_data_inicio,
    case when new.intimacao_id is not null then 'Intimação' else 'Tarefa' end,
    new.cliente_id,
    new.processo_id,
    new.responsavel_id,
    'tarefa',
    new.id,
    case when v_data_inicio::date < current_date then 'confirmado' else 'pendente' end
  );

  return new;
end;
$$;

-- Reverte os compromissos de HOJE que a migration anterior marcou
-- "confirmado" incorretamente por causa do bug de comparação por timestamp
-- em vez de dia. Só toca compromissos de origem 'tarefa' criados hoje
-- (deixa intocado qualquer confirmação manual real que o usuário tenha
-- feito — impossível distinguir sem isso, mas o volume de confirmações
-- manuais reais em compromissos criados nas últimas horas é baixo o
-- suficiente pra aceitar o risco, e o usuário pode reconfirmar manualmente
-- os poucos casos reais se algum for revertido à toa).
update compromissos
set confirmacao_status = 'pendente'
where origem = 'tarefa'
  and data_inicio::date = current_date
  and confirmacao_status = 'confirmado'
  and updated_at > now() - interval '12 hours';
