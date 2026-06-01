-- Tabela para contratos Zapsign (separada de Clicksign)
CREATE TABLE IF NOT EXISTS contract_reminders_zapsign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT UNIQUE NOT NULL,
  document_name TEXT NOT NULL,
  contract_link TEXT,
  lead_id UUID REFERENCES leads_juridicos(id) ON DELETE SET NULL,
  signer_name TEXT,
  signer_email TEXT,
  signer_phone TEXT,
  signer_cpf TEXT,
  status TEXT DEFAULT 'pending',
  background_check_status TEXT DEFAULT 'pending',
  background_check_at TIMESTAMPTZ,
  modelo_contrato_id UUID REFERENCES modelos_contratos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zapsign_lead_id    ON contract_reminders_zapsign(lead_id);
CREATE INDEX IF NOT EXISTS idx_zapsign_status     ON contract_reminders_zapsign(status);
CREATE INDEX IF NOT EXISTS idx_zapsign_document_id ON contract_reminders_zapsign(document_id);
CREATE INDEX IF NOT EXISTS idx_zapsign_created_at ON contract_reminders_zapsign(created_at DESC);

-- RLS
ALTER TABLE contract_reminders_zapsign ENABLE ROW LEVEL SECURITY;

-- Policies idempotentes (DROP IF EXISTS + CREATE)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view all contracts" ON contract_reminders_zapsign;
  DROP POLICY IF EXISTS "Admins can insert contracts"               ON contract_reminders_zapsign;
  DROP POLICY IF EXISTS "Admins can update contracts"               ON contract_reminders_zapsign;
END $$;

CREATE POLICY "Authenticated users can view all contracts"
  ON contract_reminders_zapsign FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert contracts"
  ON contract_reminders_zapsign FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Administrador')
  );

CREATE POLICY "Admins can update contracts"
  ON contract_reminders_zapsign FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Administrador')
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_contract_reminders_zapsign_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_zapsign_contracts_timestamp ON contract_reminders_zapsign;
CREATE TRIGGER update_zapsign_contracts_timestamp
BEFORE UPDATE ON contract_reminders_zapsign
FOR EACH ROW EXECUTE FUNCTION update_contract_reminders_zapsign_timestamp();
