
-- Recreate missing subscribers from orphaned messages
INSERT INTO manychat_subscribers (subscriber_id, nome, telefone, canal, ultima_interacao, updated_at)
SELECT 
  m.subscriber_id,
  COALESCE(
    (SELECT mm.subscriber_nome FROM manychat_mensagens mm 
     WHERE mm.subscriber_id = m.subscriber_id 
       AND mm.subscriber_nome IS NOT NULL 
       AND mm.subscriber_nome != '' 
       AND mm.subscriber_nome != 'Escritório'
       AND mm.subscriber_nome != 'Sistema'
       AND mm.direcao = 'entrada'
     ORDER BY mm.created_at DESC LIMIT 1),
    (SELECT mm.subscriber_nome FROM manychat_mensagens mm 
     WHERE mm.subscriber_id = m.subscriber_id 
       AND mm.subscriber_nome IS NOT NULL 
       AND mm.subscriber_nome != '' 
       AND mm.subscriber_nome != 'Escritório'
       AND mm.subscriber_nome != 'Sistema'
     ORDER BY mm.created_at DESC LIMIT 1),
    m.subscriber_id
  ) as nome,
  CASE 
    WHEN m.subscriber_id LIKE 'zapi_%' THEN replace(m.subscriber_id, 'zapi_', '')
    ELSE m.subscriber_id
  END as telefone,
  'whatsapp',
  max(m.created_at),
  now()
FROM manychat_mensagens m
LEFT JOIN manychat_subscribers s ON s.subscriber_id = m.subscriber_id
WHERE s.subscriber_id IS NULL
  AND m.subscriber_id NOT LIKE '{%'
  AND m.subscriber_id NOT LIKE '[%'
GROUP BY m.subscriber_id
ON CONFLICT (subscriber_id) DO NOTHING;
