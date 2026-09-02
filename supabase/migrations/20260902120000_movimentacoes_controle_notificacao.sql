-- Corrige o bug de "notificação processual reenvia movimentação antiga":
-- o sistema não tinha controle de QUAL movimentação já foi comunicada ao
-- cliente, só de QUANDO pode notificar de novo (processos.ultima_notificacao_at).
-- A mensagem sempre pegava os primeiros itens de movimentos_json, que pode
-- reordenar/ser reescrito inteiro a cada sync — resultado: cliente recebendo
-- de novo movimentação que já tinha sido avisada semanas atrás.
--
-- processo_movimentacoes já faz upsert por hash único (cnj+data+título+
-- descrição) a cada sync — uma linha nova = movimentação genuinamente nova.
-- Usamos isso como fonte de verdade: notificado_em marca quando a movimentação
-- foi avaliada para notificação (enviada ou descartada por irrelevância).

ALTER TABLE public.processo_movimentacoes
  ADD COLUMN IF NOT EXISTS notificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS relevante boolean;

-- Backfill: marca todo o histórico existente como já avaliado, para não
-- despejar anos de movimentação acumulada como "novidade" no primeiro sync
-- depois desta migration.
UPDATE public.processo_movimentacoes
SET notificado_em = now()
WHERE notificado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_processo_movimentacoes_pendentes
  ON public.processo_movimentacoes (processo_id, data_movimento DESC)
  WHERE notificado_em IS NULL;

-- Desativa o cron duplicado de processo-auto-sync: -daily (07:00 UTC, todo dia)
-- já cobre terça/sexta; -ter-sex era uma segunda entrada nunca consolidada,
-- que só aumentava a frequência com que o bug acima ficava visível.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processo-auto-sync-ter-sex') THEN
    PERFORM cron.unschedule('processo-auto-sync-ter-sex');
  END IF;
END;
$$;
