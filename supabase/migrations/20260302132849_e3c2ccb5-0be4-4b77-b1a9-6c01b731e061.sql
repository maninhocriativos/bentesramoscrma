DROP POLICY IF EXISTS "Update own or managed compromissos" ON compromissos;

CREATE POLICY "Update own or managed compromissos" ON compromissos
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'Administrador'::app_role)
  OR has_role(auth.uid(), 'Gerente'::app_role)
  OR has_role(auth.uid(), 'Secretaria'::app_role)
  OR (responsavel_id = auth.uid())
);