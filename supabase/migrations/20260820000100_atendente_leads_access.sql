-- Concede ao cargo 'Atendente' o mesmo acesso de leitura/criação/edição de leads
-- já dado à Secretaria (precisa rodar em transação separada da que criou o enum).

DROP POLICY IF EXISTS "View leads by role" ON leads_juridicos;
DROP POLICY IF EXISTS "Insert leads by role" ON leads_juridicos;
DROP POLICY IF EXISTS "Update leads by role" ON leads_juridicos;

CREATE POLICY "View leads by role" ON leads_juridicos
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR
  has_role(auth.uid(), 'Gerente'::app_role) OR
  has_role(auth.uid(), 'Advogado'::app_role) OR
  has_role(auth.uid(), 'Secretaria'::app_role) OR
  has_role(auth.uid(), 'Atendente'::app_role)
);

CREATE POLICY "Insert leads by role" ON leads_juridicos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador'::app_role) OR
  has_role(auth.uid(), 'Gerente'::app_role) OR
  has_role(auth.uid(), 'Advogado'::app_role) OR
  has_role(auth.uid(), 'Secretaria'::app_role) OR
  has_role(auth.uid(), 'Atendente'::app_role)
);

CREATE POLICY "Update leads by role" ON leads_juridicos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador'::app_role) OR
  has_role(auth.uid(), 'Gerente'::app_role) OR
  has_role(auth.uid(), 'Advogado'::app_role) OR
  has_role(auth.uid(), 'Secretaria'::app_role) OR
  has_role(auth.uid(), 'Atendente'::app_role)
);
