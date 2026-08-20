-- O instagram-backfill (antes da correção) regredia manychat_subscribers.ultima_interacao
-- pra data da mensagem mais ANTIGA processada numa conversa, em vez da mais
-- recente — a conversa "sumia" da lista do chat (ordenada por
-- ultima_interacao DESC com limite de linhas). Corrige recalculando a partir
-- das mensagens reais de cada contato do Instagram.
UPDATE manychat_subscribers s
SET ultima_interacao = m.max_msg
FROM (
  SELECT subscriber_id, max(created_at) AS max_msg
  FROM manychat_mensagens
  WHERE canal = 'instagram'
  GROUP BY subscriber_id
) m
WHERE s.subscriber_id = m.subscriber_id
  AND s.canal = 'instagram'
  AND (s.ultima_interacao IS NULL OR s.ultima_interacao < m.max_msg);
