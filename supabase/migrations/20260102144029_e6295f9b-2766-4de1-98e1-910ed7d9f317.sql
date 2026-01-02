
-- 1. Criar leads para subscribers com telefone que não têm lead vinculado
INSERT INTO leads_juridicos (nome, telefone, status, origem)
SELECT 
  CASE WHEN ms.nome = 'Desconhecido' OR ms.nome LIKE '{{%' THEN 'Contato ' || ms.telefone ELSE ms.nome END,
  ms.telefone,
  'Lead Frio',
  CASE 
    WHEN ms.canal = 'whatsapp' THEN 'WhatsApp'
    WHEN ms.canal = 'instagram' THEN 'Instagram'
    WHEN ms.canal = 'facebook' THEN 'Facebook'
    ELSE 'ManyChat'
  END
FROM manychat_subscribers ms
WHERE ms.lead_id IS NULL
  AND ms.telefone IS NOT NULL
  AND ms.nome NOT LIKE '{{%'
  AND ms.telefone NOT LIKE '{{%'
ON CONFLICT DO NOTHING;

-- 2. Vincular subscribers aos leads pelo telefone (últimos 9 dígitos)
UPDATE manychat_subscribers ms
SET lead_id = l.id, updated_at = now()
FROM leads_juridicos l
WHERE ms.lead_id IS NULL
  AND ms.telefone IS NOT NULL
  AND RIGHT(REGEXP_REPLACE(ms.telefone, '[^0-9]', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g'), 9);

-- 3. Atualizar as mensagens para incluir o lead_id do subscriber correspondente
UPDATE manychat_mensagens mm
SET lead_id = ms.lead_id
FROM manychat_subscribers ms
WHERE mm.subscriber_id = ms.subscriber_id
  AND mm.lead_id IS NULL
  AND ms.lead_id IS NOT NULL;
