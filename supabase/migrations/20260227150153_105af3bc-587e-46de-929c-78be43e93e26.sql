
-- Table for starred/favorited messages
CREATE TABLE public.starred_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.manychat_mensagens(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- RLS
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stars"
  ON public.starred_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for soft-deleted messages (for me only)
CREATE TABLE public.deleted_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.manychat_mensagens(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own deletions"
  ON public.deleted_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add deleted_for_all column to messages
ALTER TABLE public.manychat_mensagens 
  ADD COLUMN IF NOT EXISTS deleted_for_all boolean DEFAULT false;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_starred_messages_user ON public.starred_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_user ON public.deleted_messages(user_id);
