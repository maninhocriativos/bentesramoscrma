-- Configura OAB/AM 7526 no perfil do Andrey
UPDATE public.perfis
SET
  oab_numero = '7526',
  oab_uf     = 'AM',
  updated_at = NOW()
WHERE
  LOWER(nome) LIKE '%andrey%'
  AND aprovado = true;

-- Remove OAB do perfil do Thiago (ele é desenvolvedor, não advogado)
UPDATE public.perfis
SET
  oab_numero = NULL,
  oab_uf     = NULL,
  updated_at = NOW()
WHERE
  LOWER(nome) LIKE '%thiago%'
  AND aprovado = true;

-- Retroativamente vincula intimações OAB/AM 7526 ao advogado_id correto do Andrey
WITH andrey AS (
  SELECT id
  FROM public.perfis
  WHERE LOWER(nome) LIKE '%andrey%'
    AND aprovado = true
  LIMIT 1
)
UPDATE public.intimacoes
SET
  advogado_id = andrey.id,
  updated_at  = NOW()
FROM andrey
WHERE
  public.intimacoes.oab_numero = '7526'
  AND public.intimacoes.oab_uf = 'AM'
  AND (
    public.intimacoes.advogado_id IS NULL
    OR public.intimacoes.advogado_id != andrey.id
  );
