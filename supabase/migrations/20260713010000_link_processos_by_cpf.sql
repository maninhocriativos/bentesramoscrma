-- Vincula processos orfaos (sem cliente_id) a um lead ja conhecido, quando o
-- CPF do cliente bate com o de outro processo do MESMO cliente que ja tem
-- cliente_id vinculado manualmente. Casamento exato por CPF, sem risco de
-- confundir nome (leads_juridicos.cpf esta 100% vazio hoje, entao o cruzamento
-- e feito processo-a-processo, nao contra leads diretamente).
--
-- Pula CPFs "ambiguos" (apontam para mais de um cliente_id distinto entre os
-- ja vinculados - normalmente leads duplicados) para nao arriscar vincular
-- errado. Aplicado uma vez sobre os dados existentes; inofensiva em base nova.
with cpf_unico as (
  select cpf_cliente, (array_agg(distinct cliente_id))[1] as cliente_id
  from processos
  where cliente_id is not null and cpf_cliente is not null
  group by cpf_cliente
  having array_length(array_agg(distinct cliente_id), 1) = 1
)
update processos orf
set cliente_id = cu.cliente_id
from cpf_unico cu
where orf.cliente_id is null
  and orf.cpf_cliente is not null
  and orf.cpf_cliente = cu.cpf_cliente;
