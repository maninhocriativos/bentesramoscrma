-- Atualizar leads existentes que têm a tag "Bentes Ramos" para o novo status
UPDATE leads_juridicos l
SET status = 'Bentes Ramos', updated_at = now()
FROM subscriber_tags st
JOIN chat_tags ct ON ct.id = st.tag_id
JOIN manychat_subscribers ms ON ms.subscriber_id = st.subscriber_id
WHERE ms.lead_id = l.id
AND ct.name = 'Bentes Ramos'
AND l.status NOT IN ('Ganho', 'Perdido', 'Contrato Assinado');