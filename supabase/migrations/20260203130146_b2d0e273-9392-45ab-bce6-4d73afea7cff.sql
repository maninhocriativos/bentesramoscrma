-- Criar subscribers para leads de tráfego que não têm subscriber
INSERT INTO manychat_subscribers (subscriber_id, nome, telefone, canal, lead_id, ultima_interacao)
SELECT 
  'zapi_' || l.telefone as subscriber_id,
  l.nome,
  l.telefone,
  'whatsapp' as canal,
  l.id as lead_id,
  l.created_at as ultima_interacao
FROM leads_juridicos l
WHERE l.telefone IS NOT NULL
  AND l.telefone != ''
  AND NOT EXISTS (
    SELECT 1 FROM manychat_subscribers ms 
    WHERE ms.lead_id = l.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM manychat_subscribers ms 
    WHERE ms.subscriber_id = 'zapi_' || l.telefone
  )
ON CONFLICT (subscriber_id) DO UPDATE SET
  lead_id = EXCLUDED.lead_id,
  nome = COALESCE(manychat_subscribers.nome, EXCLUDED.nome),
  updated_at = now();

-- Também vincular subscribers existentes aos leads pelo telefone
UPDATE manychat_subscribers ms
SET lead_id = l.id
FROM leads_juridicos l
WHERE ms.lead_id IS NULL
  AND l.telefone IS NOT NULL
  AND (
    ms.telefone = l.telefone 
    OR ms.subscriber_id = 'zapi_' || l.telefone
    OR RIGHT(ms.telefone, 9) = RIGHT(l.telefone, 9)
  );