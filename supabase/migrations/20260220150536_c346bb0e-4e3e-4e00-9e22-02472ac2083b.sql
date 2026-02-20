
-- Table to track user page access history
CREATE TABLE public.access_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_email text,
  user_name text,
  page_path text NOT NULL,
  page_title text,
  accessed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast queries by user and date
CREATE INDEX idx_access_logs_user_date ON public.access_logs (user_id, accessed_at DESC);
CREATE INDEX idx_access_logs_accessed_at ON public.access_logs (accessed_at DESC);

-- Enable RLS
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Admins and Gerentes can view all access logs
CREATE POLICY "Admins can view all access logs"
ON public.access_logs
FOR SELECT
USING (has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role));

-- Any authenticated user can insert their own logs
CREATE POLICY "Users can insert own access logs"
ON public.access_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can delete
CREATE POLICY "Admins can delete access logs"
ON public.access_logs
FOR DELETE
USING (has_role(auth.uid(), 'Administrador'::app_role));
