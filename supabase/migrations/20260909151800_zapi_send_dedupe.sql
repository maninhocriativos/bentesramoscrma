-- Idempotência do envio via Z-API: quando o navegador acha que a chamada
-- pra zapi-send falhou por rede e tenta de novo (invokeZapiSend, fallback via
-- fetch direto), a tentativa original podia já ter chegado no WhatsApp de
-- verdade — a resposta que sumiu, não o envio. Sem isso, a segunda tentativa
-- manda a mesma mensagem/documento uma segunda vez pro cliente real. Ver
-- HISTORICO.md 2026-09-09.
create table if not exists public.zapi_send_dedupe (
  dedupe_key text primary key,
  status text not null default 'pending' check (status in ('pending', 'done')),
  response jsonb,
  created_at timestamptz not null default now()
);

-- Limpeza automática: linhas só precisam existir por alguns segundos (janela
-- de retry do cliente); não deixar a tabela crescer pra sempre.
create index if not exists idx_zapi_send_dedupe_created_at on public.zapi_send_dedupe (created_at);

alter table public.zapi_send_dedupe enable row level security;

-- Só a edge function (service_role) acessa essa tabela; sem policy pra
-- authenticated/anon de propósito.
