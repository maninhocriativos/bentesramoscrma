-- Achado: a fila automática de intimações (intimacoes-scheduler → job em
-- intimacoes_sync_jobs → intimacoes-worker → intimacoes-oab) está travada
-- desde 2026-08-27 16:00 UTC — ZERO jobs novos criados desde então (11 dias),
-- confirmado consultando a tabela ao vivo.
--
-- Causa raiz: claim_next_intimacoes_sync_job() reenfileira jobs travados em
-- 'processing' há mais de 20 minutos voltando-os pra 'pending', mas nunca
-- checava se attempts já tinha esgotado max_attempts. Um job da OAB 7526/AM
-- (cron_meiodia, criado 2026-08-27 16:00) travou em 'processing' com
-- attempts=6=max_attempts, foi reenfileirado como 'pending' por essa função,
-- e como a condição de claim exige "attempts < max_attempts", nunca mais foi
-- pego por ninguém — ficou pending pra sempre (zumbi). O índice único
-- uq_intimacoes_sync_jobs_active_per_oab (job_type, oab_numero, oab_uf) WHERE
-- status IN ('pending','processing') então bloqueia qualquer INSERT novo do
-- scheduler pra essa mesma OAB — todo cron desde então tenta criar o job,
-- recebe erro de chave duplicada, loga o erro e segue reportando "sucesso"
-- (mesmo padrão silencioso já visto com Escavador/Anthropic). O sync manual
-- ("Sincronizar agora" em Intimações) continua funcionando porque chama
-- intimacoes-oab diretamente, sem passar pela fila — por isso a sensação de
-- "às vezes funciona, automático não".

-- 1) Corrige a função: job travado que já esgotou as tentativas vira 'failed'
--    de verdade (com completed_at), não volta pra 'pending' pra sempre.
CREATE OR REPLACE FUNCTION public.claim_next_intimacoes_sync_job()
RETURNS SETOF public.intimacoes_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimed public.intimacoes_sync_jobs;
BEGIN
  -- Jobs travados em 'processing' que ainda têm tentativa disponível: voltam
  -- pra 'pending' pra serem tentados de novo.
  UPDATE public.intimacoes_sync_jobs
  SET
    status = 'pending',
    run_after = now(),
    updated_at = now(),
    last_error = COALESCE(last_error, 'stale job requeued automatically')
  WHERE status = 'processing'
    AND started_at < now() - interval '20 minutes'
    AND attempts < max_attempts;

  -- Jobs travados em 'processing' que JÁ esgotaram as tentativas: marca como
  -- falhado de vez, em vez de reenfileirar pra sempre (era o bug — deixava um
  -- job "pending" que a query de claim abaixo nunca mais pegava, bloqueando
  -- pra sempre o índice único por OAB e impedindo qualquer job novo).
  UPDATE public.intimacoes_sync_jobs
  SET
    status = 'failed',
    completed_at = now(),
    updated_at = now(),
    last_error = COALESCE(last_error, '') || ' | stale job travado após esgotar tentativas'
  WHERE status = 'processing'
    AND started_at < now() - interval '20 minutes'
    AND attempts >= max_attempts;

  WITH next_job AS (
    SELECT id
    FROM public.intimacoes_sync_jobs
    WHERE job_type = 'fetch_intimacoes'
      AND status = 'pending'
      AND run_after <= now()
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.intimacoes_sync_jobs j
  SET
    status = 'processing',
    started_at = now(),
    attempts = j.attempts + 1,
    updated_at = now(),
    last_error = NULL
  FROM next_job
  WHERE j.id = next_job.id
  RETURNING j.* INTO claimed;

  IF claimed.id IS NOT NULL THEN
    RETURN NEXT claimed;
  END IF;

  RETURN;
END;
$function$;

-- 2) Destrava o zumbi que já existe hoje (id conhecido, confirmado travado
--    desde 2026-08-27 — sem isso, a correção da função acima só evita NOVOS
--    zumbis, esse aqui continuaria ocupando o índice único pra sempre).
UPDATE public.intimacoes_sync_jobs
SET
  status = 'failed',
  completed_at = now(),
  updated_at = now(),
  last_error = COALESCE(last_error, '') || ' | corrigido manualmente 2026-09-07: zumbi bloqueava a fila de sync automático desde 2026-08-27'
WHERE status = 'pending'
  AND attempts >= max_attempts;
