-- Create table for custom contract templates
CREATE TABLE public.modelos_contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.modelos_contratos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "View modelos contratos" ON public.modelos_contratos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert modelos contratos" ON public.modelos_contratos
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'Administrador') OR 
    has_role(auth.uid(), 'Gerente') OR 
    has_role(auth.uid(), 'Advogado')
  );

CREATE POLICY "Update modelos contratos" ON public.modelos_contratos
  FOR UPDATE USING (
    has_role(auth.uid(), 'Administrador') OR 
    has_role(auth.uid(), 'Gerente')
  );

CREATE POLICY "Delete modelos contratos" ON public.modelos_contratos
  FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- Trigger for updated_at
CREATE TRIGGER update_modelos_contratos_updated_at
  BEFORE UPDATE ON public.modelos_contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();