-- Confirmar email da Amanda manualmente
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
WHERE email = 'amanda@bentesramos.adv.br';