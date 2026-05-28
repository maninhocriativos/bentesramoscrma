-- Habilita Realtime na tabela user_page_permissions para que o
-- PerfilContext receba atualizações ao vivo quando o admin mudar
-- as permissões de um usuário — sem precisar de logout/login.
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_page_permissions;
