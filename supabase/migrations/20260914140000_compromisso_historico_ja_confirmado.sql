-- Pedido do usuário 2026-09-14: mesmo problema da Agenda que já foi
-- corrigido em Intimações (ver migrations/functions de intimacoes-oab e
-- processo-djen-sync do mesmo dia) — um compromisso criado retroativamente
-- (tarefa com prazo_fatal no passado, tipicamente vinda de um sync/import
-- de dado histórico) nascia sempre "pendente" de confirmação, mesmo sendo
-- um evento que já aconteceu há muito tempo. Isso inflava a lista de
-- "pendentes" da Agenda com coisa que não precisa mais de nenhuma ação.
--
-- Fix na fonte: o trigger que cria o compromisso a partir de uma tarefa só
-- nasce "pendente" quando a data é hoje ou futura; se for passada, já nasce
-- "confirmado" (mesmo raciocínio do "lida=true" em Intimações — data
-- passada não é evento novo acionável).
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
    case when v_data_inicio < now() then 'confirmado' else 'pendente' end
  );

  return new;
end;
$$;

-- Limpeza do backlog já existente: compromissos com data no passado, ainda
-- "pendente" de confirmação, viram "confirmado" (mesmo critério acima).
-- Maioria vem de um import histórico do AdvBox (sistema anterior do
-- escritório, 858 de 1082 linhas, todas de mar-abr/2026 — não é sync ativo).
update compromissos
set confirmacao_status = 'confirmado'
where coalesce(confirmacao_status, 'pendente') = 'pendente'
  and data_inicio < now();
