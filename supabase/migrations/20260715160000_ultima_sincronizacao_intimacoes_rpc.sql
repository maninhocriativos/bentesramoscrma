-- Expõe a data da última sincronização de intimações concluída com sucesso,
-- sem precisar dar acesso de leitura à tabela intimacoes_sync_jobs (restrita a
-- Administrador/Gerente) para todo mundo. O frontend usava um timestamp salvo em
-- localStorage do navegador (só atualizado quando alguém clicava "Sincronizar" *nesse
-- aparelho*), o que fazia parecer que a sincronização automática (cron) estava
-- travada/lenta quando na verdade só ninguém tinha aberto a página recentemente.
create or replace function public.get_ultima_sincronizacao_intimacoes()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(updated_at)
  from intimacoes_sync_jobs
  where job_type = 'fetch_intimacoes'
    and status = 'completed';
$$;

grant execute on function public.get_ultima_sincronizacao_intimacoes() to authenticated;
