-- Update existing intimacoes with tribunal from raw_json.diario_sigla or diario_nome
UPDATE intimacoes
SET 
  tribunal = COALESCE(
    raw_json->>'diario_sigla',
    raw_json->>'diario_nome',
    tribunal
  ),
  data_disponibilizacao = COALESCE(
    data_disponibilizacao,
    (raw_json->>'diario_data')::timestamptz
  ),
  data_publicacao = COALESCE(
    data_publicacao,
    (raw_json->>'diario_data')::timestamptz
  ),
  data_intimacao = COALESCE(
    data_intimacao,
    (raw_json->>'diario_data')::timestamptz
  ),
  updated_at = now()
WHERE raw_json IS NOT NULL 
  AND raw_json != '{}'::jsonb
  AND (
    tribunal IS NULL 
    OR tribunal = '' 
    OR data_disponibilizacao IS NULL 
    OR data_publicacao IS NULL 
    OR data_intimacao IS NULL
  );