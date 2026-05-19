-- Permissões por tela por usuário
-- Admins são isentos (acesso total independente desta tabela)
CREATE TABLE IF NOT EXISTS user_page_permissions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  page_id    text        NOT NULL,
  enabled    boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_id)
);

ALTER TABLE user_page_permissions ENABLE ROW LEVEL SECURITY;

-- Admins podem ler e gravar qualquer permissão
CREATE POLICY "admins_manage_page_permissions"
  ON user_page_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'Administrador'
    )
  );

-- Usuários podem ler as próprias permissões
CREATE POLICY "users_read_own_page_permissions"
  ON user_page_permissions
  FOR SELECT
  USING (user_id = auth.uid());
