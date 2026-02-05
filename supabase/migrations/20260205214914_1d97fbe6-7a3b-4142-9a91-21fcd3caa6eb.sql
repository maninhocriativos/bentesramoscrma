-- Corrigir integrations_config para apontar para a instância de TRÁFEGO (ISA)
-- ID da instância: 3EDDF959BC2B81F86B410203B614D70E
-- Token: 435EEDEB25CB508B0E860452

UPDATE integrations_config
SET config_json = jsonb_set(
  jsonb_set(
    config_json,
    '{instance_id}',
    '"3EDDF959BC2B81F86B410203B614D70E"'
  ),
  '{token}',
  '"435EEDEB25CB508B0E860452"'
),
updated_at = now()
WHERE provider = 'zapi';