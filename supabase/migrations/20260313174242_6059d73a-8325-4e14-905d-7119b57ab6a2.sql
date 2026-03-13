-- Extract processo_cnj from conteudo using regex pattern for CNJ numbers
UPDATE intimacoes
SET 
  processo_cnj = (regexp_match(conteudo, '(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})'))[1],
  updated_at = now()
WHERE (processo_cnj IS NULL OR processo_cnj = '')
  AND conteudo IS NOT NULL
  AND conteudo ~ '\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}';

-- Also try extracting from raw_json texto field
UPDATE intimacoes
SET 
  processo_cnj = (regexp_match(raw_json->>'texto', '(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})'))[1],
  updated_at = now()
WHERE (processo_cnj IS NULL OR processo_cnj = '')
  AND raw_json IS NOT NULL
  AND raw_json->>'texto' ~ '\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}';