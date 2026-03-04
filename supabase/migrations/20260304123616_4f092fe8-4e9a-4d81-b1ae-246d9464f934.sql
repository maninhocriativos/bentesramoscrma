
-- Restore Bentes Ramos classification from message metadata (instance_name contains 'Bentes')
UPDATE manychat_subscribers s
SET 
  linha_whatsapp = 'bentes_ramos_antigo',
  empresa_tag = 'BENTES_RAMOS',
  instance_name = COALESCE(s.instance_name, '5592991604348')
WHERE (s.linha_whatsapp IS NULL OR s.linha_whatsapp = 'indefinido')
  AND EXISTS (
    SELECT 1 FROM manychat_mensagens m
    WHERE m.subscriber_id = s.subscriber_id
      AND (m.metadata->>'instance_name') ILIKE '%Bentes%'
    LIMIT 1
  );

-- Restore Bentes Ramos tags
DO $$
DECLARE
  v_bentes_tag_id UUID;
BEGIN
  SELECT id INTO v_bentes_tag_id FROM chat_tags WHERE name = 'Bentes Ramos' LIMIT 1;
  
  IF v_bentes_tag_id IS NOT NULL THEN
    INSERT INTO subscriber_tags (subscriber_id, tag_id, reason)
    SELECT s.subscriber_id, v_bentes_tag_id, 'Auto: restauração via metadata'
    FROM manychat_subscribers s
    WHERE s.linha_whatsapp = 'bentes_ramos_antigo'
    ON CONFLICT (subscriber_id, tag_id) DO NOTHING;
  END IF;
END;
$$;

-- For remaining 'indefinido' subscribers without metadata, check if their lead has traffic info
UPDATE manychat_subscribers s
SET linha_whatsapp = 'trafego_isa'
WHERE (s.linha_whatsapp IS NULL OR s.linha_whatsapp = 'indefinido')
  AND s.lead_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM leads_juridicos l
    WHERE l.id = s.lead_id
      AND l.canal_origem = 'whatsapp'
      AND l.tipo_origem = 'trafego'
  );
