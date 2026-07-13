-- consulta-processos usa upsert(..., { onConflict: 'cnj_normalizado' }) para criar
-- processos novos, mas so existia um indice comum (nao unico) em cnj_normalizado.
-- Sem constraint unica o Postgres rejeita o ON CONFLICT ("there is no unique or
-- exclusion constraint matching the specification") e a criacao de processo novo
-- falha silenciosamente (o erro so aparece em warnings, a resposta continua success:true).
-- Confirmado: nao ha duplicatas hoje, seguro criar o indice unico.
-- Indice completo (nao parcial): ON CONFLICT (coluna) so consegue inferir a partir
-- de um indice unico completo — um indice parcial exigiria repetir o WHERE na
-- clausula ON CONFLICT, que o supabase-js nao gera. NULLs nao conflitam entre si.
create unique index if not exists processos_cnj_normalizado_uidx
  on public.processos (cnj_normalizado);
