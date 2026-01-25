UPDATE integrations_config 
SET config_json = jsonb_set(config_json, '{client_token}', '"F507d2921bd924b7e83c419d4eeb42c64S"')
WHERE provider = 'zapi';