-- idx_compromissos_lead_data_unico (lead_id, data_inicio) foi criado em
-- 2026-01-07 pra evitar compromissos duplicados quando um mesmo lead é
-- agendado duas vezes no mesmo horário (ex.: double-click no Cal.com/chat).
--
-- Desde 2026-07-15 (20260715000000_tarefa_cria_compromisso_agenda.sql) toda
-- tarefa criada também gera um compromisso automaticamente via trigger, com
-- data_inicio = prazo_fatal + horário (default 09:00 quando a tarefa não tem
-- horário). Isso faz duas tarefas distintas pro mesmo lead/cliente, com o
-- mesmo prazo fatal e sem horário definido, colidirem nesse índice -- o
-- insert do compromisso (dentro do trigger AFTER INSERT) falha e derruba a
-- criação da tarefa inteira com "duplicate key value violates unique
-- constraint idx_compromissos_lead_data_unico".
--
-- Compromissos gerados por tarefa já têm proteção própria contra duplicata
-- via idx_compromissos_tarefa_unique (um compromisso por tarefa_id), então
-- não precisam do índice antigo. Restringe o índice antigo só aos
-- compromissos que não vieram de uma tarefa (agendamentos manuais/Cal.com).

drop index if exists idx_compromissos_lead_data_unico;

create unique index if not exists idx_compromissos_lead_data_unico
on compromissos (lead_id, data_inicio)
where lead_id is not null and tarefa_id is null;
