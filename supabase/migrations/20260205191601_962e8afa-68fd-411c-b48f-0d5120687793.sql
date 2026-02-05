-- Migrate existing Facebook/Meta leads to meta_form_leads table
INSERT INTO meta_form_leads (meta_lead_id, nome, telefone, email, status, linked_lead_id, form_fields, created_at)
SELECT 
  COALESCE(facebook_lead_id, 'legacy_' || id::text) as meta_lead_id,
  nome,
  telefone,
  email,
  'novo' as status,
  id as linked_lead_id,
  '{}'::jsonb as form_fields,
  created_at
FROM leads_juridicos
WHERE (tipo_origem = 'trafego' AND fonte_trafego = 'facebook_lead_ads')
   OR facebook_lead_id IS NOT NULL
ON CONFLICT (meta_lead_id) DO NOTHING;