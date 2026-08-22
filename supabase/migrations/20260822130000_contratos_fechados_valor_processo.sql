-- Duas colunas novas em contratos_fechados (tabela criada fora do fluxo de
-- migrations, direto no banco — por isso ADD COLUMN IF NOT EXISTS em vez de
-- assumir controle total do schema):
--  - valor_contrato: valor informado no registro manual do contrato, mais confiável
--    que leads_juridicos.valor_causa (populado em só ~2 de ~3.300 leads).
--  - processo_id: vínculo opcional ao processo (nem sempre existe ainda nesse
--    momento — muitos contratos de tráfego fecham antes do processo ser aberto).
ALTER TABLE contratos_fechados
  ADD COLUMN IF NOT EXISTS valor_contrato numeric,
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES processos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contratos_fechados_processo_id ON contratos_fechados(processo_id);
