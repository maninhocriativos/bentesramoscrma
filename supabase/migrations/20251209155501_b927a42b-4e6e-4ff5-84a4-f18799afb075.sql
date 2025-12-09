-- Remover políticas problemáticas de leads_juridicos que usam subquery em perfis
DROP POLICY IF EXISTS "Equipe autorizada acessa leads" ON leads_juridicos;
DROP POLICY IF EXISTS "Apenas Chefia edita leads" ON leads_juridicos;
DROP POLICY IF EXISTS "Equipe visualiza leads" ON leads_juridicos;
DROP POLICY IF EXISTS "Chefia gerencia leads" ON leads_juridicos;

-- Criar novas políticas usando has_role()
CREATE POLICY "Equipe visualiza leads" ON leads_juridicos
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Secretaria') OR
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Chefia gerencia leads" ON leads_juridicos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Gerente')
);

-- Remover políticas problemáticas de processos
DROP POLICY IF EXISTS "Visualizacao Processos" ON processos;
DROP POLICY IF EXISTS "Operacao Processos" ON processos;
DROP POLICY IF EXISTS "Admin total processos" ON processos;
DROP POLICY IF EXISTS "Apenas Admin e Advogado veem Processos" ON processos;
DROP POLICY IF EXISTS "View processos based on role" ON processos;
DROP POLICY IF EXISTS "Update processos based on role" ON processos;

-- Criar novas políticas usando has_role()
CREATE POLICY "View processos" ON processos
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Secretaria') OR
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Update processos" ON processos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR
  has_role(auth.uid(), 'Secretaria') OR
  has_role(auth.uid(), 'Advogado')
);

-- Remover políticas problemáticas de compromissos
DROP POLICY IF EXISTS "Admin limpa agenda" ON compromissos;

-- Remover políticas problemáticas de perfis que causam recursão
DROP POLICY IF EXISTS "Leitura de Perfis" ON perfis;
DROP POLICY IF EXISTS "Edicao de Perfis" ON perfis;