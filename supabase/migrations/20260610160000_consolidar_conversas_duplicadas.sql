-- Consolida conversas (manychat_subscribers) duplicadas do MESMO contato de
-- WhatsApp, criadas pelo bug de "abrir lead" (que gerava conversa nova quando
-- a existente não estava carregada). Estratégia SEGURA:
--   • agrupa por telefone normalizado (DDD + 8 dígitos; unifica 9º dígito)
--   • principal = conversa com MAIS mensagens (desempate: mais antiga)
--   • MOVE mensagens, tags e logs das duplicatas para a principal (zero perda)
--   • remove apenas as duplicatas (já esvaziadas)
-- Idempotente: rodar de novo não causa efeito (não haverá mais grupos > 1).

-- Função auxiliar de normalização (DDD + 8 dígitos)
CREATE OR REPLACE FUNCTION public._norm_phone_tmp(p text) RETURNS text AS $$
DECLARE d text;
BEGIN
  d := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  IF length(d) >= 12 AND left(d, 2) = '55' THEN d := substr(d, 3); END IF;  -- tira DDI 55
  IF length(d) = 11 THEN d := left(d, 2) || substr(d, 4); END IF;            -- tira 9º dígito
  RETURN right(d, 10);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
DECLARE
  rec RECORD;
  v_canonico text;
  v_dups text[];
  v_grupos int := 0;
  v_dups_removidas int := 0;
  v_msgs_movidas int := 0;
  v_tmp int;
BEGIN
  FOR rec IN
    WITH base AS (
      SELECT
        s.subscriber_id,
        s.created_at,
        public._norm_phone_tmp(COALESCE(s.telefone_normalizado, s.telefone, s.subscriber_id)) AS phone_key,
        (SELECT count(*) FROM public.manychat_mensagens m WHERE m.subscriber_id = s.subscriber_id) AS msg_count
      FROM public.manychat_subscribers s
      WHERE COALESCE(s.canal, 'whatsapp') = 'whatsapp'
    )
    SELECT phone_key,
           array_agg(subscriber_id ORDER BY msg_count DESC, created_at ASC) AS ids
    FROM base
    WHERE phone_key IS NOT NULL AND length(phone_key) = 10
    GROUP BY phone_key
    HAVING count(*) > 1
  LOOP
    v_canonico := rec.ids[1];                 -- mais mensagens
    v_dups     := rec.ids[2:array_length(rec.ids, 1)];  -- as demais
    v_grupos := v_grupos + 1;

    -- 1) Move mensagens das duplicatas para a principal
    UPDATE public.manychat_mensagens
       SET subscriber_id = v_canonico
     WHERE subscriber_id = ANY(v_dups);
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_msgs_movidas := v_msgs_movidas + v_tmp;

    -- 2) Tags: remove da duplicata as que a principal já tem, depois move o resto
    DELETE FROM public.subscriber_tags dt
     WHERE dt.subscriber_id = ANY(v_dups)
       AND EXISTS (SELECT 1 FROM public.subscriber_tags ct
                    WHERE ct.subscriber_id = v_canonico AND ct.tag_id = dt.tag_id);
    UPDATE public.subscriber_tags SET subscriber_id = v_canonico
     WHERE subscriber_id = ANY(v_dups);

    -- 3) Log de atendimento → principal
    BEGIN
      UPDATE public.chat_atendimento_log SET subscriber_id = v_canonico
       WHERE subscriber_id = ANY(v_dups);
    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
    END;

    -- 4) Completa dados úteis na principal a partir das duplicatas (sem sobrescrever)
    UPDATE public.manychat_subscribers c
       SET lead_id = COALESCE(c.lead_id, d.lead_id),
           telefone = COALESCE(NULLIF(c.telefone, ''), d.telefone),
           email = COALESCE(NULLIF(c.email, ''), d.email),
           foto = COALESCE(NULLIF(c.foto, ''), d.foto),
           ultima_interacao = GREATEST(c.ultima_interacao, d.ult)
      FROM (
        SELECT max(lead_id::text)::uuid AS lead_id, max(telefone) AS telefone,
               max(email) AS email, max(foto) AS foto, max(ultima_interacao) AS ult
        FROM public.manychat_subscribers WHERE subscriber_id = ANY(v_dups)
      ) d
     WHERE c.subscriber_id = v_canonico;

    -- 5) Remove as duplicatas (já sem mensagens)
    DELETE FROM public.manychat_subscribers WHERE subscriber_id = ANY(v_dups);
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_dups_removidas := v_dups_removidas + v_tmp;
  END LOOP;

  RAISE NOTICE 'Consolidação: % grupos, % duplicatas removidas, % mensagens movidas',
    v_grupos, v_dups_removidas, v_msgs_movidas;

  -- Auditoria (best-effort — nunca aborta a consolidação)
  BEGIN
    INSERT INTO public.system_events (tipo, descricao, metadata)
    VALUES ('chat_dedup',
            format('Conversas duplicadas consolidadas: %s grupos, %s removidas, %s msgs movidas',
                   v_grupos, v_dups_removidas, v_msgs_movidas),
            jsonb_build_object('grupos', v_grupos, 'removidas', v_dups_removidas, 'msgs_movidas', v_msgs_movidas));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

DROP FUNCTION IF EXISTS public._norm_phone_tmp(text);
