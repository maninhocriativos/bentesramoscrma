-- A constraint leads_juridicos_isa_agent_check existia no banco (fora do controle de
-- migrations, adicionada em algum momento direto pelo Studio) restringindo isa_agent a
-- ('isa_triagem','isa_bancario','isa_aereo','humano'). Isso bloqueava o novo valor
-- 'isa_documentos' introduzido em 20260816120000_isa_documentos_agent.sql. Recria a
-- constraint só acrescentando o valor novo — nenhum valor existente é removido.

ALTER TABLE leads_juridicos DROP CONSTRAINT IF EXISTS leads_juridicos_isa_agent_check;

ALTER TABLE leads_juridicos ADD CONSTRAINT leads_juridicos_isa_agent_check
  CHECK (isa_agent = ANY (ARRAY['isa_triagem'::text, 'isa_bancario'::text, 'isa_aereo'::text, 'isa_documentos'::text, 'humano'::text]));
