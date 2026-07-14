-- Toda tarefa criada (de qualquer lugar do sistema: página de Tarefas, modal
-- de processo, modal de intimações) agora gera automaticamente um evento na
-- Agenda com a data do prazo fatal -- via trigger, não código de aplicação,
-- pra garantir que funcione não importa de onde a tarefa seja criada, hoje
-- ou no futuro (evita esquecer de duplicar a lógica em cada tela nova).
--
-- Tarefas criadas a partir de uma intimação (tarefas.intimacao_id) geram um
-- compromisso do tipo 'Intimação' (aparece em vermelho na Agenda); as demais
-- geram tipo 'Tarefa' (verde, como já era).

alter table tarefas add column if not exists intimacao_id uuid references intimacoes(id) on delete set null;
alter table compromissos add column if not exists tarefa_id uuid references tarefas(id) on delete cascade;

create index if not exists idx_tarefas_intimacao on tarefas(intimacao_id) where intimacao_id is not null;
create unique index if not exists idx_compromissos_tarefa_unique on compromissos(tarefa_id) where tarefa_id is not null;

create or replace function criar_compromisso_da_tarefa()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- Sem prazo fatal não há data sensata pra agendar -- não cria compromisso
  -- "solto" sem dia (a tarefa continua existindo normalmente, só não some
  -- na Agenda; ela pode ganhar prazo depois e isso não é retroagido aqui,
  -- só na criação, igual foi pedido).
  if new.prazo_fatal is null then
    return new;
  end if;

  insert into compromissos (
    titulo, descricao, data_inicio, tipo,
    lead_id, processo_id, responsavel_id, origem, tarefa_id, confirmacao_status
  ) values (
    new.titulo,
    new.descricao,
    (new.prazo_fatal + coalesce(new.horario, '09:00'::time)) at time zone 'America/Manaus',
    case when new.intimacao_id is not null then 'Intimação' else 'Tarefa' end,
    new.cliente_id,
    new.processo_id,
    new.responsavel_id,
    'tarefa',
    new.id,
    'pendente'
  );

  return new;
end;
$$;

drop trigger if exists trg_tarefa_cria_compromisso on tarefas;
create trigger trg_tarefa_cria_compromisso
  after insert on tarefas
  for each row
  execute function criar_compromisso_da_tarefa();
