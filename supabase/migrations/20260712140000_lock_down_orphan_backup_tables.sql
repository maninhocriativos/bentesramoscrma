-- Achado no check-up: 3 tabelas orfãs (sem uso no código, criadas manualmente
-- fora do fluxo de migrations) estavam sem RLS e com privilégios completos
-- (select/insert/update/delete/truncate) liberados para anon/authenticated.
-- backup_leads_pre_merge_20260610 tem 1643 leads reais (nome, telefone, email)
-- e estava publicamente legível/gravável com a chave anon pública do frontend.

revoke all on public.backup_leads_pre_merge_20260610 from anon, authenticated;
revoke all on public.backup_chunk_progress          from anon, authenticated;
revoke all on public._migration_history              from anon, authenticated;

alter table public.backup_leads_pre_merge_20260610 enable row level security;
alter table public.backup_chunk_progress           enable row level security;
alter table public._migration_history               enable row level security;
