-- Histórico completo de processos do escritório (2013-2026), mantido pela
-- equipe numa planilha .xlsx no Drive ("Relação de Processos 2013 à
-- 2026.xlsx", 1 aba por ano) — pedido do usuário 2026-09-11: consultar via
-- API e refletir na página de Dados, atualizando sozinho quando a planilha
-- mudar. Guardado separado de `processos` (que é o funil de leads do CRM,
-- não esse arquivo histórico maior e mais antigo, mantido manualmente).

CREATE TABLE planilha_processos_historico (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano                 int NOT NULL,
  linha_planilha      int NOT NULL,
  nome_cliente        text,
  reclamada_requerido text,
  materia             text,
  qualificacao_cliente text,
  justica             text,
  vara                text,
  comarca             text,
  tribunal            text,
  numero_processo     text,
  andamento           text,
  resultado           text,
  contato             text,
  origem              text,
  mes_entrada         text,
  raw_json            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, linha_planilha)
);

CREATE INDEX idx_planilha_processos_ano ON planilha_processos_historico (ano);
CREATE INDEX idx_planilha_processos_numero ON planilha_processos_historico (numero_processo) WHERE numero_processo IS NOT NULL;
CREATE INDEX idx_planilha_processos_resultado ON planilha_processos_historico (resultado) WHERE resultado IS NOT NULL;

ALTER TABLE planilha_processos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_planilha_processos"
  ON planilha_processos_historico FOR SELECT
  TO authenticated
  USING (true);

-- Guarda o modifiedTime do arquivo no Drive na última sincronização, pra
-- decidir se precisa reprocessar (evita baixar/parsear os ~300KB toda vez
-- que o cron roda sem a planilha ter mudado).
CREATE TABLE planilha_processos_sync_estado (
  id                    int PRIMARY KEY DEFAULT 1,
  drive_file_id         text NOT NULL,
  drive_modified_time   timestamptz,
  ultima_sincronizacao  timestamptz,
  total_linhas          int,
  status                text,
  erro                  text,
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE planilha_processos_sync_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_planilha_sync_estado"
  ON planilha_processos_sync_estado FOR SELECT
  TO authenticated
  USING (true);
