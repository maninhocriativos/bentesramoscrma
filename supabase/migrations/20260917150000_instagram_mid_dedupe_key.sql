-- Mesmo problema já resolvido pro WhatsApp (message_id_key): o dedup do
-- Instagram fazia .eq('metadata->>mid', mid) antes de inserir, sem nenhuma
-- garantia no banco — só um SELECT seguido de INSERT, sem atomicidade. Meta
-- reenvia o mesmo evento de webhook quando a resposta demora (exatamente o
-- que essa própria query lenta causava), e duas execuções concorrentes
-- passavam pelo "não existe ainda" ao mesmo tempo. Resultado real medido:
-- 13.514 linhas com mid, só 632 valores distintos — 12.882 linhas duplicadas
-- (uma chegou a se repetir ~1.900 vezes). O chat já dedup visualmente por
-- mid (getMessageDedupeKey no front), por isso ninguém viu isso na tela.
--
-- Fix definitivo: coluna sincronizada por trigger (mid + índice do anexo,
-- pra não quebrar mensagens com várias partes que legitimamente
-- compartilham o mesmo mid) + índice único. O código do webhook passa a
-- usar upsert com onConflict nessa coluna em vez de select-então-insert —
-- elimina a corrida de vez, não só deixa a checagem mais rápida.
--
-- Não faz backfill das linhas antigas (ficariam NULL, de propósito): rodar
-- UPDATE agora bateria de frente com as duplicatas já existentes. Limpeza
-- das 12.882 linhas antigas é decisão separada, à parte desta migration.

ALTER TABLE public.manychat_mensagens ADD COLUMN IF NOT EXISTS instagram_mid_key text;

CREATE OR REPLACE FUNCTION public.sync_manychat_mensagens_instagram_mid_key()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.metadata ->> 'mid' IS NOT NULL THEN
    NEW.instagram_mid_key := (NEW.metadata ->> 'mid') || ':' || COALESCE(NEW.metadata ->> 'attachment_index', '0');
  ELSE
    NEW.instagram_mid_key := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_manychat_mensagens_instagram_mid_key ON public.manychat_mensagens;
CREATE TRIGGER trg_sync_manychat_mensagens_instagram_mid_key
  BEFORE INSERT OR UPDATE ON public.manychat_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.sync_manychat_mensagens_instagram_mid_key();

CREATE UNIQUE INDEX IF NOT EXISTS manychat_mensagens_instagram_mid_key_idx
  ON public.manychat_mensagens (instagram_mid_key) WHERE (instagram_mid_key IS NOT NULL);
