-- 1. Fix: Employee Personal Information Exposed (perfis)
-- Drop conflicting policies and create proper authenticated-only access
DROP POLICY IF EXISTS "Admins and Gerentes can view all profiles" ON perfis;
DROP POLICY IF EXISTS "Admins can view all profiles" ON perfis;
DROP POLICY IF EXISTS "Users can view own profile" ON perfis;
DROP POLICY IF EXISTS "Politica Correta de Leitura" ON perfis;

-- Create single unified SELECT policy requiring authentication
CREATE POLICY "View profiles authenticated" ON perfis
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    auth.uid() = id OR
    has_role(auth.uid(), 'Administrador') OR
    has_role(auth.uid(), 'Gerente')
  )
);

-- 2. Fix: Legal Case Information Accessible Without Authentication (processos)
DROP POLICY IF EXISTS "View processos" ON processos;

CREATE POLICY "View processos authenticated" ON processos
FOR SELECT USING (
  auth.role() = 'authenticated' AND (
    has_role(auth.uid(), 'Administrador') OR
    has_role(auth.uid(), 'Secretaria') OR
    has_role(auth.uid(), 'Advogado')
  )
);

-- 3. Fix: Any User Can Modify Any Appointment (compromissos)
DROP POLICY IF EXISTS "Authenticated users can update compromissos" ON compromissos;

CREATE POLICY "Update own or managed compromissos" ON compromissos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Gerente') OR
  responsavel_id = auth.uid()
);