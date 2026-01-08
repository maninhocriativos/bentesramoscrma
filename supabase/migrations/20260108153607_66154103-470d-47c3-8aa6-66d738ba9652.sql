-- Corrigir subscribers que têm telefone brasileiro (55) mas estão marcados como 'facebook'
-- Esses devem ser 'whatsapp' pois vieram do WhatsApp Business API

UPDATE manychat_subscribers
SET 
  canal = 'whatsapp',
  updated_at = now()
WHERE 
  canal = 'facebook' 
  AND telefone IS NOT NULL 
  AND telefone ~ '^55[0-9]{10,}$';

-- Também corrigir mensagens com o mesmo padrão
UPDATE manychat_mensagens m
SET canal = 'whatsapp'
FROM manychat_subscribers s
WHERE 
  m.subscriber_id = s.subscriber_id
  AND m.canal = 'facebook'
  AND s.telefone IS NOT NULL 
  AND s.telefone ~ '^55[0-9]{10,}$';