-- Fix: required unique constraint so UPSERT ... onConflict: 'numero_processo' works

-- 1) Remove duplicates (keep most recently updated)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY numero_processo
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.processos
  WHERE numero_processo IS NOT NULL
)
DELETE FROM public.processos p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Ensure unique constraint/index exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'processos'
      AND indexname = 'processos_numero_processo_key'
  ) THEN
    CREATE UNIQUE INDEX processos_numero_processo_key ON public.processos (numero_processo);
  END IF;
END $$;