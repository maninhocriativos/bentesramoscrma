-- Enable REPLICA IDENTITY FULL for real-time updates on tarefas
ALTER TABLE tarefas REPLICA IDENTITY FULL;

-- Add tarefas to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tarefas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tarefas;
  END IF;
END $$;