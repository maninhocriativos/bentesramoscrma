
-- ============================================
-- CORREÇÃO DEFINITIVA: Criar subscribers para leads sem subscriber
-- Usando CTE para evitar duplicatas
-- ============================================

-- 1. Primeiro, criar subscribers apenas para leads únicos
WITH leads_missing_subscriber AS (
  SELECT DISTINCT ON (
    CASE 
      WHEN l.telefone LIKE '55%' THEN 'zapi_' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
      ELSE 'zapi_55' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
    END
  )
    l.id as lead_id,
    l.nome,
    l.telefone,
    CASE 
      WHEN l.telefone LIKE '55%' THEN 'zapi_' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
      ELSE 'zapi_55' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
    END as subscriber_id,
    l.created_at
  FROM leads_juridicos l
  LEFT JOIN manychat_subscribers ms ON ms.lead_id = l.id
  WHERE ms.id IS NULL 
    AND l.telefone IS NOT NULL 
    AND l.telefone != ''
    AND LENGTH(REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')) >= 10
  ORDER BY 
    CASE 
      WHEN l.telefone LIKE '55%' THEN 'zapi_' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
      ELSE 'zapi_55' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
    END,
    l.created_at DESC
)
INSERT INTO manychat_subscribers (subscriber_id, nome, telefone, canal, lead_id, ultima_interacao, updated_at)
SELECT 
  lms.subscriber_id,
  lms.nome,
  lms.telefone,
  'whatsapp',
  lms.lead_id,
  lms.created_at,
  NOW()
FROM leads_missing_subscriber lms
WHERE NOT EXISTS (
  SELECT 1 FROM manychat_subscribers ms2 WHERE ms2.subscriber_id = lms.subscriber_id
)
ON CONFLICT (subscriber_id) DO UPDATE SET
  lead_id = COALESCE(manychat_subscribers.lead_id, EXCLUDED.lead_id),
  nome = COALESCE(manychat_subscribers.nome, EXCLUDED.nome),
  updated_at = NOW();

-- 2. Atualizar mensagens que estão com subscriber_id diferente
UPDATE manychat_mensagens mm
SET subscriber_id = ms.subscriber_id
FROM manychat_subscribers ms
WHERE mm.lead_id = ms.lead_id
  AND mm.lead_id IS NOT NULL
  AND mm.subscriber_id != ms.subscriber_id
  AND ms.subscriber_id LIKE 'zapi_55%';

-- 3. Garantir classificação correta de leads
UPDATE leads_juridicos
SET status = 'Lead Frio'
WHERE tipo_origem = 'trafego' 
  AND status NOT IN ('Em Atendimento', 'Qualificado', 'Em Negociação', 'Cliente', 'Perdido', 'Bentes Ramos', 'Ganho', 'Contrato Assinado', 'Aguardando Contrato');

UPDATE leads_juridicos
SET status = 'Bentes Ramos'
WHERE tipo_origem = 'whatsapp_direto'
  AND status NOT IN ('Em Atendimento', 'Qualificado', 'Em Negociação', 'Cliente', 'Perdido', 'Ganho', 'Contrato Assinado', 'Aguardando Contrato');
