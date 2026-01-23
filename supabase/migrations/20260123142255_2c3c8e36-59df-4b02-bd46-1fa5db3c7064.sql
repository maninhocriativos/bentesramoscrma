-- Update RLS policies to include Secretaria for leads_juridicos

-- Drop existing policies
DROP POLICY IF EXISTS "View leads by role" ON leads_juridicos;
DROP POLICY IF EXISTS "Insert leads by role" ON leads_juridicos;
DROP POLICY IF EXISTS "Chefia gerencia leads" ON leads_juridicos;

-- Recreate with Secretaria included

-- SELECT: Add Secretaria
CREATE POLICY "View leads by role" ON leads_juridicos
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR 
  has_role(auth.uid(), 'Gerente'::app_role) OR 
  has_role(auth.uid(), 'Advogado'::app_role) OR
  has_role(auth.uid(), 'Secretaria'::app_role)
);

-- INSERT: Add Secretaria
CREATE POLICY "Insert leads by role" ON leads_juridicos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador'::app_role) OR 
  has_role(auth.uid(), 'Gerente'::app_role) OR 
  has_role(auth.uid(), 'Advogado'::app_role) OR
  has_role(auth.uid(), 'Secretaria'::app_role)
);

-- UPDATE: Add Secretaria (along with Advogado)
CREATE POLICY "Update leads by role" ON leads_juridicos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR 
  has_role(auth.uid(), 'Gerente'::app_role) OR 
  has_role(auth.uid(), 'Advogado'::app_role) OR
  has_role(auth.uid(), 'Secretaria'::app_role)
);