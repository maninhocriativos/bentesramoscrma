-- Tabela para leads diretos da Meta Lead Ads via webhook
-- Convive com meta_form_leads existente (não substitui)

CREATE TABLE IF NOT EXISTS meta_leads_aereo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz DEFAULT now(),
  nome               text,
  telefone           text,
  email              text,
  problema_voo       text,
  tempo_prejudicado  text,
  teve_prejuizo      text,
  comprovantes       text,
  classificacao      text,
  origem             text DEFAULT 'Meta Lead Ads - Direito Aéreo',
  campaign_id        text,
  campaign_name      text,
  adset_id           text,
  adset_name         text,
  ad_id              text,
  ad_name            text,
  form_id            text,
  lead_id_meta       text UNIQUE,
  status             text DEFAULT 'novo',
  zapi_status        text,
  observacoes        text,
  raw_payload        jsonb,
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_leads_aereo_telefone       ON meta_leads_aereo(telefone);
CREATE INDEX IF NOT EXISTS idx_meta_leads_aereo_classificacao  ON meta_leads_aereo(classificacao);
CREATE INDEX IF NOT EXISTS idx_meta_leads_aereo_status         ON meta_leads_aereo(status);
CREATE INDEX IF NOT EXISTS idx_meta_leads_aereo_created_at     ON meta_leads_aereo(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_leads_aereo_origem         ON meta_leads_aereo(origem);
CREATE INDEX IF NOT EXISTS idx_meta_leads_aereo_lead_id_meta   ON meta_leads_aereo(lead_id_meta);

ALTER TABLE meta_leads_aereo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados acessam meta_leads_aereo"
  ON meta_leads_aereo FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role acessa meta_leads_aereo"
  ON meta_leads_aereo FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
