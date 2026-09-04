-- =============================================================================
-- Funde tarefas duplicadas criadas pela página de Intimações + garante que toda
-- tarefa ativa com prazo esteja na Agenda
-- =============================================================================
--
-- Até 2026-09-04 a página de Intimações criava UMA TAREFA POR RESPONSÁVEL
-- selecionado (não existia multi-responsável). Com `responsaveis_ids`
-- (migration 20260904120000) isso virou duplicata: N tarefas iguais na página
-- de Tarefas e N compromissos iguais na Agenda. O código da página foi
-- corrigido pra criar uma só; aqui limpa o que já existia.
--
-- Estado real no dia da migration: 9 grupos (20 tarefas), todos 'Pendente',
-- sem started_at/entrega/aprovação — nada a perder ao fundir. A regra abaixo
-- só funde grupos nessa condição; se algum dia houver grupo com trabalho
-- registrado, ele fica intacto.
-- =============================================================================

do $$
declare
  g record;
  v_keep uuid;
  v_ids  uuid[];
begin
  for g in
    select intimacao_id, titulo, prazo_fatal
      from tarefas
     where intimacao_id is not null
     group by intimacao_id, titulo, prazo_fatal
    having count(*) > 1
       and count(distinct status) = 1
       and bool_and(started_at is null and entregue_em is null and aprovacao_status is null)
  loop
    -- Mantém a mais antiga; junta os responsáveis de todas (ordem de criação).
    select id into v_keep
      from tarefas
     where intimacao_id = g.intimacao_id and titulo = g.titulo and prazo_fatal is not distinct from g.prazo_fatal
     order by created_at, id
     limit 1;

    select array_agg(r order by ord) into v_ids
      from (
        select distinct on (r) r, ord
          from tarefas t,
               unnest(coalesce(nullif(t.responsaveis_ids, '{}'), array[t.responsavel_id])) with ordinality as u(r, ord0),
               lateral (select extract(epoch from t.created_at) * 1000 + ord0 as ord) o
         where t.intimacao_id = g.intimacao_id and t.titulo = g.titulo and t.prazo_fatal is not distinct from g.prazo_fatal
           and r is not null
         order by r, ord
      ) s;

    update tarefas
       set responsaveis_ids = coalesce(v_ids, '{}')
     where id = v_keep;

    -- Apaga as cópias; o compromisso de cada uma cai junto (FK on delete cascade).
    delete from tarefas
     where intimacao_id = g.intimacao_id and titulo = g.titulo and prazo_fatal is not distinct from g.prazo_fatal
       and id <> v_keep;
  end loop;
end $$;

-- Tarefa ativa com prazo mas sem compromisso (criada antes do trigger de
-- 2026-07-15, ou cujo compromisso foi apagado): um UPDATE "vazio" dispara o
-- trg_tarefa_sync_compromisso, que cria o compromisso que falta.
update tarefas t
   set updated_at = now()
 where prazo_fatal is not null
   and status not in ('Concluída', 'Cancelada')
   and not exists (select 1 from compromissos c where c.tarefa_id = t.id);
