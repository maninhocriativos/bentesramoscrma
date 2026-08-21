-- traffic_followups.status nunca permitiu 'nutricao', mas
-- traffic-followup-automation/index.ts grava esse valor toda vez que um
-- lead avança pra lista de nutrição (e FollowupPage.tsx filtra por ele na
-- aba "🌱 Nutrição"). Toda tentativa de gravar 'nutricao' violava a check
-- constraint e falhava silenciosamente -- 410 erros só nas últimas 3h,
-- repetindo a cada rodada do cron pros mesmos leads que nunca conseguiam
-- transicionar de status.
ALTER TABLE public.traffic_followups DROP CONSTRAINT traffic_followups_status_check;
ALTER TABLE public.traffic_followups ADD CONSTRAINT traffic_followups_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'in_progress'::text, 'responded'::text, 'archived'::text, 'paused'::text, 'nutricao'::text]));
