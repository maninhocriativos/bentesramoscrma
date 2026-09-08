-- Tarefas recorrentes: template que gera uma linha nova em `tarefas` sozinho,
-- em cron diário (diária / semanal / mensal). RLS espelha exatamente a de
-- `tarefas` (checado ao vivo antes de escrever esta migration).

create table if not exists public.tarefas_recorrentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  tipo text not null default 'Tarefa',
  prioridade text not null default 'Media',
  responsaveis_ids uuid[] not null default '{}',
  processo_id uuid references public.processos(id),
  cliente_id uuid references public.leads_juridicos(id),
  frequencia text not null check (frequencia in ('diaria','semanal','mensal')),
  dias_semana int[],
  dia_mes int check (dia_mes is null or (dia_mes between 1 and 31)),
  horario time,
  ativa boolean not null default true,
  ultima_geracao_em date,
  created_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tarefas
  add column if not exists tarefa_recorrente_id uuid references public.tarefas_recorrentes(id);

create index if not exists idx_tarefas_recorrentes_ativa on public.tarefas_recorrentes (ativa);
create index if not exists idx_tarefas_tarefa_recorrente_id on public.tarefas (tarefa_recorrente_id);

alter table public.tarefas_recorrentes enable row level security;

drop policy if exists "View tarefas_recorrentes" on public.tarefas_recorrentes;
create policy "View tarefas_recorrentes" on public.tarefas_recorrentes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Insert tarefas_recorrentes" on public.tarefas_recorrentes;
create policy "Insert tarefas_recorrentes" on public.tarefas_recorrentes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Update tarefas_recorrentes" on public.tarefas_recorrentes;
create policy "Update tarefas_recorrentes" on public.tarefas_recorrentes
  for update using (auth.role() = 'authenticated');

drop policy if exists "Delete tarefas_recorrentes" on public.tarefas_recorrentes;
create policy "Delete tarefas_recorrentes" on public.tarefas_recorrentes
  for delete using (has_role(auth.uid(), 'Administrador'::app_role));
