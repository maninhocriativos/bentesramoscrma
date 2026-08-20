-- Estado persistido do backfill de mensagens do Instagram: a varredura do
-- histórico completo não cabe numa única execução de function (tempo de
-- execução limitado + rate limit da Meta), então guarda o cursor de onde
-- parou pra function retomar sozinha nas próximas execuções via cron —
-- mesmo padrão gradual já usado pro sync de intimações do DJEN.
CREATE TABLE IF NOT EXISTS public.instagram_backfill_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resume_url TEXT,
  fully_synced BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Linha única de estado
INSERT INTO public.instagram_backfill_state (resume_url, fully_synced)
SELECT NULL, false
WHERE NOT EXISTS (SELECT 1 FROM public.instagram_backfill_state);

ALTER TABLE public.instagram_backfill_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem estado do backfill do Instagram"
ON public.instagram_backfill_state FOR SELECT
USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Cron a cada 20 min: enquanto não terminar a varredura completa, continua de
-- onde parou; depois de completa, só revisa a 1ª página (atividade recente)
-- como rede de segurança contra alguma mensagem que o webhook em tempo real
-- eventualmente perca.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'instagram-backfill-gradual') THEN
    PERFORM cron.unschedule('instagram-backfill-gradual');
  END IF;
END;
$$;

SELECT cron.schedule(
  'instagram-backfill-gradual',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/instagram-backfill',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjYxOTMsImV4cCI6MjA4MDU0MjE5M30.ewhDXc8qxAXdAevO-LMU_HOzu7oGUbj-p6Tj39hyUgg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
