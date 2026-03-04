
-- Step 1: Restore names from messages (most recent subscriber_nome per subscriber)
UPDATE manychat_subscribers s
SET nome = sub.best_name
FROM (
  SELECT DISTINCT ON (subscriber_id) 
    subscriber_id, 
    subscriber_nome AS best_name
  FROM manychat_mensagens
  WHERE subscriber_nome IS NOT NULL 
    AND subscriber_nome != ''
    AND subscriber_nome != 'Escritório'
    AND subscriber_nome != 'Sistema'
    AND subscriber_nome != 'Isa - Assistente'
    AND direcao = 'entrada'
  ORDER BY subscriber_id, created_at DESC
) sub
WHERE s.subscriber_id = sub.subscriber_id
  AND (s.nome IS NULL OR s.nome = '');

-- Step 2: For subscribers still without name, try outbound messages
UPDATE manychat_subscribers s
SET nome = sub.best_name
FROM (
  SELECT DISTINCT ON (subscriber_id) 
    subscriber_id, 
    subscriber_nome AS best_name
  FROM manychat_mensagens
  WHERE subscriber_nome IS NOT NULL 
    AND subscriber_nome != ''
    AND subscriber_nome != 'Escritório'
    AND subscriber_nome != 'Sistema'
    AND subscriber_nome != 'Isa - Assistente'
  ORDER BY subscriber_id, created_at DESC
) sub
WHERE s.subscriber_id = sub.subscriber_id
  AND (s.nome IS NULL OR s.nome = '');

-- Step 3: For remaining without name, use lead name
UPDATE manychat_subscribers s
SET nome = l.nome
FROM leads_juridicos l
WHERE s.lead_id = l.id
  AND (s.nome IS NULL OR s.nome = '')
  AND l.nome IS NOT NULL AND l.nome != '';

-- Step 4: Restore instance_name and linha_whatsapp from lead data
-- Traffic leads (tipo_origem = 'trafego' or fonte_trafego is not null)
UPDATE manychat_subscribers s
SET 
  linha_whatsapp = 'trafego_isa',
  instance_name = COALESCE(s.instance_name, l.whatsapp_numero_destino, '5592985888190')
FROM leads_juridicos l
WHERE s.lead_id = l.id
  AND (s.linha_whatsapp IS NULL OR s.linha_whatsapp = 'indefinido')
  AND (l.tipo_origem = 'trafego' OR l.fonte_trafego IS NOT NULL OR l.linha_whatsapp = 'trafego_isa');

-- Office leads (Bentes Ramos)
UPDATE manychat_subscribers s
SET 
  linha_whatsapp = 'bentes_ramos_antigo',
  empresa_tag = 'BENTES_RAMOS',
  instance_name = COALESCE(s.instance_name, '5592991604348')
FROM leads_juridicos l
WHERE s.lead_id = l.id
  AND (s.linha_whatsapp IS NULL OR s.linha_whatsapp = 'indefinido')
  AND (l.linha_whatsapp = 'bentes_ramos_antigo' OR l.empresa_tag = 'BENTES_RAMOS');

-- Step 5: Restore tags - recreate Bentes Ramos / Tráfego tags for subscribers
-- First get tag IDs
DO $$
DECLARE
  v_bentes_tag_id UUID;
  v_trafego_tag_id UUID;
BEGIN
  SELECT id INTO v_bentes_tag_id FROM chat_tags WHERE name = 'Bentes Ramos' LIMIT 1;
  SELECT id INTO v_trafego_tag_id FROM chat_tags WHERE name = 'Tráfego' LIMIT 1;
  
  -- Add Bentes Ramos tag to office subscribers
  IF v_bentes_tag_id IS NOT NULL THEN
    INSERT INTO subscriber_tags (subscriber_id, tag_id, reason)
    SELECT s.subscriber_id, v_bentes_tag_id, 'Auto: restauração pós-merge'
    FROM manychat_subscribers s
    WHERE s.linha_whatsapp = 'bentes_ramos_antigo'
    ON CONFLICT (subscriber_id, tag_id) DO NOTHING;
  END IF;
  
  -- Add Tráfego tag to traffic subscribers
  IF v_trafego_tag_id IS NOT NULL THEN
    INSERT INTO subscriber_tags (subscriber_id, tag_id, reason)
    SELECT s.subscriber_id, v_trafego_tag_id, 'Auto: restauração pós-merge'
    FROM manychat_subscribers s
    WHERE s.linha_whatsapp = 'trafego_isa'
    ON CONFLICT (subscriber_id, tag_id) DO NOTHING;
  END IF;
END;
$$;
