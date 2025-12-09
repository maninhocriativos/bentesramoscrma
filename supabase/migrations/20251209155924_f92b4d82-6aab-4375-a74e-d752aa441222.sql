-- 1. Remover política permissiva de INSERT em processos
DROP POLICY IF EXISTS "Authenticated users can insert processos" ON processos;

-- Criar política de INSERT baseada em roles
CREATE POLICY "Insert processos by role" ON processos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Advogado') OR
  has_role(auth.uid(), 'Secretaria')
);

-- 2. Corrigir políticas de perfis para proteger dados pessoais
-- Manter apenas políticas que usam has_role ou verificam o próprio usuário
CREATE POLICY "Admins and Gerentes can view all profiles" ON perfis
FOR SELECT USING (
  auth.uid() = id OR
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Gerente')
);

-- 3. Tornar leads_juridicos mais restritivo (remover Secretaria do SELECT geral)
DROP POLICY IF EXISTS "Equipe visualiza leads" ON leads_juridicos;
DROP POLICY IF EXISTS "Todos criam leads" ON leads_juridicos;
DROP POLICY IF EXISTS "Equipe cadastra leads" ON leads_juridicos;

-- Apenas Admin, Gerente e Advogado podem ver leads
CREATE POLICY "View leads by role" ON leads_juridicos
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Advogado')
);

-- Apenas Admin, Gerente e Advogado podem criar leads
CREATE POLICY "Insert leads by role" ON leads_juridicos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Advogado')
);