-- Habilitar REPLICA IDENTITY FULL para que o Realtime funcione corretamente
ALTER TABLE public.leads_juridicos REPLICA IDENTITY FULL;

-- Garantir que a tabela está na publicação de realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'leads_juridicos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads_juridicos;
  END IF;
END $$;