
-- Add Gerente to all processos policies
DROP POLICY IF EXISTS "View processos authenticated" ON processos;
CREATE POLICY "View processos authenticated" ON processos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Administrador'::app_role)
  OR has_role(auth.uid(), 'Gerente'::app_role)
  OR has_role(auth.uid(), 'Secretaria'::app_role)
  OR has_role(auth.uid(), 'Advogado'::app_role)
);

DROP POLICY IF EXISTS "Update processos" ON processos;
CREATE POLICY "Update processos" ON processos
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'Administrador'::app_role)
  OR has_role(auth.uid(), 'Gerente'::app_role)
  OR has_role(auth.uid(), 'Secretaria'::app_role)
  OR has_role(auth.uid(), 'Advogado'::app_role)
);

DROP POLICY IF EXISTS "Insert processos by role" ON processos;
CREATE POLICY "Insert processos by role" ON processos
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'Administrador'::app_role)
  OR has_role(auth.uid(), 'Gerente'::app_role)
  OR has_role(auth.uid(), 'Secretaria'::app_role)
  OR has_role(auth.uid(), 'Advogado'::app_role)
);

DROP POLICY IF EXISTS "Only admins can delete processos" ON processos;
CREATE POLICY "Only admins can delete processos" ON processos
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'Administrador'::app_role)
  OR has_role(auth.uid(), 'Gerente'::app_role)
);
