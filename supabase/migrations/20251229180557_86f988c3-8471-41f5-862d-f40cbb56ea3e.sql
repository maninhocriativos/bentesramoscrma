-- Create app_settings table for storing configuration key/value pairs
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view app_settings"
ON public.app_settings
FOR SELECT
USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Only admins can insert settings
CREATE POLICY "Admins can insert app_settings"
ON public.app_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'Administrador'::app_role));

-- Only admins can update settings
CREATE POLICY "Admins can update app_settings"
ON public.app_settings
FOR UPDATE
USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Only admins can delete settings
CREATE POLICY "Admins can delete app_settings"
ON public.app_settings
FOR DELETE
USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();