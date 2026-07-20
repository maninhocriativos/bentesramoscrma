-- O indice existente usava um predicado COALESCE(metadata->>'message_id','') <> ''
-- que o planner do Postgres nunca conseguia provar implicado por uma igualdade
-- simples (metadata->>'message_id' = X), entao toda consulta de deduplicacao de
-- mensagem (chamada em TODO webhook do WhatsApp) caia em Seq Scan na tabela
-- inteira. Com a tabela crescendo isso vinha causando lentidao geral no chat.
-- Trocando o predicado para IS NOT NULL (provavel pelo planner) o indice passa
-- a ser usado de verdade.

DROP INDEX IF EXISTS public.manychat_mensagens_message_id_idx;
DROP INDEX IF EXISTS public.manychat_mensagens_message_id_unique;

CREATE UNIQUE INDEX manychat_mensagens_message_id_unique
  ON public.manychat_mensagens ((metadata ->> 'message_id'))
  WHERE (metadata ->> 'message_id') IS NOT NULL;
