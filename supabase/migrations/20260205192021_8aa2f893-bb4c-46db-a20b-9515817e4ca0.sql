-- 1. Migrate existing leads (Raimar, Souza) to meta_form_leads
INSERT INTO meta_form_leads (meta_lead_id, nome, telefone, email, status, linked_lead_id, form_fields, created_at)
SELECT 
  'legacy_' || id::text as meta_lead_id,
  nome,
  telefone,
  email,
  'novo' as status,
  id as linked_lead_id,
  '{}'::jsonb as form_fields,
  created_at
FROM leads_juridicos
WHERE id IN ('6649dd0e-f314-4f0f-a664-ca0cba30b764', '8e902dc8-ba27-40b5-bfce-4d733c628965')
ON CONFLICT (meta_lead_id) DO NOTHING;

-- 2. Insert new leads from spreadsheet into leads_juridicos
INSERT INTO leads_juridicos (nome, telefone, email, tipo_origem, fonte_trafego, status, lead_state)
VALUES 
  ('Josue Pereira Neves', '5592994131307', 'josueneves06@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Maria Lúcia Pará Cardoso', '559293607910', 'marialucia.paracardoso@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Maria de Fatima Sales', '5592999831375', 'mfatima1sales@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Rosana Barreto da Silva', '5592986382770', 'barreto.rosana.silva@email.com.br', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Cleusa Oliveira', '556984676061', 'taicleusa@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Marivaldo Soares da Rocha', '5595991399013', 'marivaldosoaresdarocha46@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Roberto Silva', '5592992175141', 'robertononato23@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW'),
  ('Rosalvo Jonas Oliveira Assayag', '5529151512878', 'Assayag2023@gmail.com', 'trafego', 'facebook_lead_ads', 'Lead Frio', 'NEW')
ON CONFLICT DO NOTHING;

-- 3. Insert all new leads into meta_form_leads (linking to the leads_juridicos we just created)
INSERT INTO meta_form_leads (meta_lead_id, nome, telefone, email, status, linked_lead_id, form_fields, created_at)
SELECT 
  'manual_' || id::text as meta_lead_id,
  nome,
  telefone,
  email,
  'novo' as status,
  id as linked_lead_id,
  '{}'::jsonb as form_fields,
  created_at
FROM leads_juridicos
WHERE email IN (
  'josueneves06@gmail.com',
  'marialucia.paracardoso@gmail.com',
  'mfatima1sales@gmail.com',
  'barreto.rosana.silva@email.com.br',
  'taicleusa@gmail.com',
  'marivaldosoaresdarocha46@gmail.com',
  'robertononato23@gmail.com',
  'Assayag2023@gmail.com'
)
ON CONFLICT (meta_lead_id) DO NOTHING;