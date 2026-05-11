-- Tabela de histórico de conversas da Isa (Claude)
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  lead_id         uuid references public.leads_juridicos(id) on delete set null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_id_idx on public.ai_messages(conversation_id, created_at);
create index if not exists ai_messages_lead_id_idx         on public.ai_messages(lead_id);

alter table public.ai_messages enable row level security;

create policy "service_role_all" on public.ai_messages
  for all to service_role using (true) with check (true);

comment on table  public.ai_messages                is 'Histórico de mensagens das conversas da Isa (ai-chat Edge Function)';
comment on column public.ai_messages.conversation_id is 'UUID da sessão de conversa — gerado pelo cliente ou pela função';
comment on column public.ai_messages.lead_id         is 'Lead associado à conversa, quando identificado';
