-- 1) Remove duplicates in manychat_mensagens by provider message_id (keep the oldest row)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY (metadata->>'message_id')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.manychat_mensagens
  WHERE coalesce(metadata->>'message_id', '') <> ''
)
DELETE FROM public.manychat_mensagens m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

-- 2) Enforce uniqueness for provider message ids going forward
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'manychat_mensagens_message_id_unique'
  ) THEN
    CREATE UNIQUE INDEX manychat_mensagens_message_id_unique
      ON public.manychat_mensagens ((metadata->>'message_id'))
      WHERE coalesce(metadata->>'message_id', '') <> '';
  END IF;
END $$;

-- 3) Helpful non-unique index for filtering by message_id (if planner chooses)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'manychat_mensagens_message_id_idx'
  ) THEN
    CREATE INDEX manychat_mensagens_message_id_idx
      ON public.manychat_mensagens ((metadata->>'message_id'))
      WHERE coalesce(metadata->>'message_id', '') <> '';
  END IF;
END $$;