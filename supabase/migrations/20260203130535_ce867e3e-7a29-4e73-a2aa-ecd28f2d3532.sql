
-- Atualizar leads de tráfego para status correto baseado em tipo_origem
UPDATE leads_juridicos
SET status = 'Lead Frio'
WHERE tipo_origem = 'trafego' 
  AND status NOT IN ('Em Atendimento', 'Qualificado', 'Em Negociação', 'Cliente', 'Perdido', 'Bentes Ramos');

-- Atualizar leads do escritório para status Bentes Ramos
UPDATE leads_juridicos
SET status = 'Bentes Ramos'
WHERE tipo_origem = 'whatsapp_direto'
  AND status NOT IN ('Em Atendimento', 'Qualificado', 'Em Negociação', 'Cliente', 'Perdido');

-- Criar subscriber para o lead que está sem (🙌🏻🫶🏻)
INSERT INTO manychat_subscribers (subscriber_id, nome, telefone, canal, lead_id, ultima_interacao)
SELECT 
  'zapi_' || l.telefone as subscriber_id,
  l.nome,
  l.telefone,
  'whatsapp' as canal,
  l.id as lead_id,
  l.created_at as ultima_interacao
FROM leads_juridicos l
WHERE l.id = 'a3b762ec-41a8-417f-8f0b-a400823a8644'
  AND NOT EXISTS (SELECT 1 FROM manychat_subscribers WHERE lead_id = l.id)
ON CONFLICT (subscriber_id) DO UPDATE SET
  lead_id = EXCLUDED.lead_id,
  updated_at = now();
