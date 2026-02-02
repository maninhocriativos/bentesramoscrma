-- Criar tag "Bentes Ramos" para identificar contatos do escritório
INSERT INTO chat_tags (name, color, category, is_system, requires_reason)
VALUES ('Bentes Ramos', 'blue', 'origem', true, false)
ON CONFLICT (name) DO NOTHING;

-- Aplicar tag retroativamente em subscribers que vieram pelo número do escritório
-- Primeiro, identificar contatos que tem mensagens do número 92991604348
INSERT INTO subscriber_tags (subscriber_id, tag_id, reason)
SELECT DISTINCT 
  m.subscriber_id,
  (SELECT id FROM chat_tags WHERE name = 'Bentes Ramos'),
  'Auto-classificado: contato via número do escritório'
FROM manychat_mensagens m
WHERE m.metadata::text LIKE '%91604348%'
  OR m.metadata::text LIKE '%992991604348%'
  OR m.metadata::text LIKE '%5592991604348%'
ON CONFLICT (subscriber_id, tag_id) DO NOTHING;