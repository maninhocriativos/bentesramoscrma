
DROP POLICY IF EXISTS "Only admins can delete compromissos" ON compromissos;

CREATE POLICY "Only admins can delete compromissos" ON compromissos
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'Administrador'::app_role)
  OR has_role(auth.uid(), 'Secretaria'::app_role)
);
