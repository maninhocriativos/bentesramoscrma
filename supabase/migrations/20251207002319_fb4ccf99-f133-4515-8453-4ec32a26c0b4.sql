-- First create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at column to leads_juridicos for tracking interactions
ALTER TABLE public.leads_juridicos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger for leads updated_at
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads_juridicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create compromissos table for agenda
CREATE TABLE public.compromissos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  tipo TEXT NOT NULL DEFAULT 'Reunião',
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  responsavel_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compromissos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view compromissos"
ON public.compromissos FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert compromissos"
ON public.compromissos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update compromissos"
ON public.compromissos FOR UPDATE
USING (true);

CREATE POLICY "Only admins can delete compromissos"
ON public.compromissos FOR DELETE
USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Create trigger for compromissos updated_at
CREATE TRIGGER update_compromissos_updated_at
BEFORE UPDATE ON public.compromissos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();