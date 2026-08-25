-- O indice manychat_mensagens_message_id_unique (sobre a expressao
-- metadata->>'message_id') existe e tem o predicado certo desde a correcao de
-- 20260720100004, mas continua sem ser usado: o filtro que o PostgREST monta
-- pra "metadata->>message_id=eq.X" manda a CHAVE do JSON como parametro, e o
-- planner nao consegue provar em tempo de plano que esse parametro sera
-- sempre 'message_id' — entao ele cai num Seq Scan da tabela inteira mesmo
-- assim. Confirmado ao vivo: 93 mil chamadas, 73ms de media, 70% do tempo
-- total de query do banco desde o reset de stats em 20260720.
--
-- Fix: uma coluna comum (nao uma expressao sobre JSON) elimina essa
-- ambiguidade — uma comparacao de coluna normal sempre pode usar indice,
-- independente de como o parametro chega. Populada automaticamente por
-- trigger, sem precisar alterar cada ponto do codigo que insere mensagem.
--
-- Este migration é só aditivo: nao remove nem altera o indice/coluna
-- existentes, nao muda nenhuma query em uso hoje. O codigo do zapi-webhook
-- so passa a usar essa coluna numa etapa separada, depois de validar aqui.

ALTER TABLE public.manychat_mensagens
  ADD COLUMN IF NOT EXISTS message_id_key text;

CREATE OR REPLACE FUNCTION public.sync_manychat_mensagens_message_id_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.message_id_key := NEW.metadata ->> 'message_id';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_manychat_mensagens_message_id_key ON public.manychat_mensagens;
CREATE TRIGGER trg_sync_manychat_mensagens_message_id_key
  BEFORE INSERT OR UPDATE OF metadata ON public.manychat_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_manychat_mensagens_message_id_key();

-- Backfill das linhas existentes (mesmo padrao de coluna comum, sem tocar em
-- metadata nem em nenhuma outra coluna).
UPDATE public.manychat_mensagens
SET message_id_key = metadata ->> 'message_id'
WHERE message_id_key IS NULL
  AND (metadata ->> 'message_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manychat_mensagens_message_id_key_idx
  ON public.manychat_mensagens (message_id_key)
  WHERE message_id_key IS NOT NULL;
