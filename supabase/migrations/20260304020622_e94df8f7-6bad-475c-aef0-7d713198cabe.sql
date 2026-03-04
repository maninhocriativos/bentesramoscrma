
-- Reativar Isa para os leads afetados
UPDATE leads_juridicos SET isa_ativa = true 
WHERE telefone IN (
  '5592993609854', '5592981054032', '5592981435105', 
  '5592984538331', '5592986085295', '5592992779984', 
  '5592993317830', '559281054032'
);

-- Manter atendimento_humano = false para Isa poder responder
UPDATE manychat_subscribers SET atendimento_humano = false, atendimento_humano_desde = null
WHERE subscriber_id IN (
  'zapi_5592993609854', 'zapi_5592981054032', 'zapi_5592981435105', 
  'zapi_5592984538331', 'zapi_5592986085295', 'zapi_5592992779984', 
  'zapi_5592993317830', 'zapi_559281054032'
)
