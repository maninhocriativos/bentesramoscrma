-- Add columns to track Google Drive sync status
ALTER TABLE public.documentos
ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
ADD COLUMN IF NOT EXISTS drive_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';

-- Create index for faster sync queries
CREATE INDEX IF NOT EXISTS idx_documentos_sync_status ON public.documentos(sync_status);
CREATE INDEX IF NOT EXISTS idx_documentos_drive_file_id ON public.documentos(drive_file_id);

-- Comment on columns
COMMENT ON COLUMN public.documentos.drive_file_id IS 'Google Drive file ID when synced';
COMMENT ON COLUMN public.documentos.drive_synced_at IS 'Last sync timestamp with Google Drive';
COMMENT ON COLUMN public.documentos.sync_status IS 'Sync status: pending, synced, error, syncing';