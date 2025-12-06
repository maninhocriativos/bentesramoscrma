-- Update RLS policy for leads to allow Gerente full access (like Admin)
DROP POLICY IF EXISTS "Admin e Gerente dominam Leads" ON public.leads_juridicos;

CREATE POLICY "Admin e Gerente dominam Leads" 
ON public.leads_juridicos 
FOR ALL 
USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR 
  has_role(auth.uid(), 'Gerente'::app_role) OR 
  (auth.uid() = id)
);

-- Allow Gerente to delete leads too
DROP POLICY IF EXISTS "Only admins can delete leads" ON public.leads_juridicos;

CREATE POLICY "Admins and Gerentes can delete leads" 
ON public.leads_juridicos 
FOR DELETE 
USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR 
  has_role(auth.uid(), 'Gerente'::app_role)
);

-- Block Gerente from processos (only Admin, Advogado, Secretaria can view)
DROP POLICY IF EXISTS "View processos based on role" ON public.processos;

CREATE POLICY "View processos based on role" 
ON public.processos 
FOR SELECT 
USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR 
  has_role(auth.uid(), 'Secretaria'::app_role) OR 
  (has_role(auth.uid(), 'Advogado'::app_role) AND (advogado_responsavel = (SELECT perfis.nome FROM perfis WHERE perfis.id = auth.uid())))
);