-- Busca precisa de lead para o autofill da petição: nome, telefone OU CPF.
-- Compara apenas os DÍGITOS de telefone/CPF, então casa mesmo quando o valor
-- está formatado no banco (ex.: "(92) 99999-9999", "000.000.000-00").
create or replace function public.buscar_leads_peticao(termo text)
returns setof public.leads_juridicos
language sql
stable
as $$
  with p as (
    select regexp_replace(coalesce(termo, ''), '\D', '', 'g') as digitos,
           trim(coalesce(termo, '')) as texto
  )
  select l.*
  from public.leads_juridicos l, p
  where (char_length(p.texto) >= 2 and l.nome ilike '%' || p.texto || '%')
     or (char_length(p.digitos) >= 3 and regexp_replace(coalesce(l.cpf, ''),      '\D', '', 'g') like '%' || p.digitos || '%')
     or (char_length(p.digitos) >= 3 and regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') like '%' || p.digitos || '%')
  order by l.created_at desc
  limit 10;
$$;

grant execute on function public.buscar_leads_peticao(text) to anon, authenticated;
