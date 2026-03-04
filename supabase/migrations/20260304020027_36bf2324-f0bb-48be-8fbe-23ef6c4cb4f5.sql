
-- 1. Disable Isa for affected leads
UPDATE leads_juridicos SET isa_ativa = false 
WHERE telefone IN (
  '5592993609854', '5592981054032', '5592981435105', 
  '5592984538331', '5592986085295', '5592992779984', 
  '5592993317830', '559281054032'
);

-- 2. Set atendimento_humano for those subscribers
UPDATE manychat_subscribers SET atendimento_humano = true, atendimento_humano_desde = now()
WHERE subscriber_id IN (
  'zapi_5592993609854', 'zapi_5592981054032', 'zapi_5592981435105', 
  'zapi_5592984538331', 'zapi_5592986085295', 'zapi_5592992779984', 
  'zapi_5592993317830', 'zapi_559281054032'
);

-- 3. Delete spam duplicate messages (keep only first per subscriber)
DELETE FROM manychat_mensagens 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY subscriber_id ORDER BY created_at ASC) as rn
    FROM manychat_mensagens
    WHERE direcao = 'saida' 
    AND created_at >= '2026-03-04'
    AND subscriber_nome LIKE '%Isa%'
  ) sub WHERE rn > 1
)
