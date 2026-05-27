-- Fix: limpa OAB de perfis que não são Advogado e corrige intimações com advogado errado

-- 1. Remove OAB de perfis que não são Advogado (ex: Thiago Silva - Secretaria/Administrador)
--    Isso impede que o lookup de nome mostre "THIAGO SILVA" nas intimações
UPDATE public.perfis
SET oab_numero = NULL,
    oab_uf     = NULL
WHERE cargo IS DISTINCT FROM 'Advogado'
  AND oab_numero IS NOT NULL;

-- 2. Reatribui intimações existentes ao único Advogado com OAB ativo (Andrey)
--    Só atualiza linhas que apontam para um advogado_id diferente do correto
WITH andrey AS (
  SELECT id
  FROM public.perfis
  WHERE cargo = 'Advogado'
    AND oab_numero IS NOT NULL
    AND aprovado = true
  ORDER BY id ASC
  LIMIT 1
)
UPDATE public.intimacoes i
SET advogado_id = andrey.id
FROM andrey
WHERE i.advogado_id IS DISTINCT FROM andrey.id;

-- 3. Garante UNIQUE em zapi_instances.instance_id para prevenir duplicatas futuras
ALTER TABLE public.zapi_instances
  DROP CONSTRAINT IF EXISTS zapi_instances_instance_id_key;

ALTER TABLE public.zapi_instances
  ADD CONSTRAINT zapi_instances_instance_id_key UNIQUE (instance_id);
