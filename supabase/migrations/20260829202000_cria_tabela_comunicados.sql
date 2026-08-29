-- Tabela nova pro mural de "Comunicados do escritório" da Área do Cliente
-- (portal externo, Cloudflare Worker separado — ver supabase/functions/
-- cliente-portal-data). Não existia nenhum conceito de aviso geral no sistema
-- até agora. Gerenciado pela equipe dentro do próprio CRM (aba nova em
-- Configurações, a construir); lido pelo portal do cliente via Edge Function
-- com service role — RLS aqui só protege contra acesso direto via API pública
-- do Supabase (anon/authenticated), não é o mecanismo real de proteção do
-- portal do cliente (esse é o CPF validado no Worker).

CREATE TABLE public.comunicados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         text NOT NULL DEFAULT 'info' CHECK (tipo IN ('importante', 'processo', 'info')),
  titulo       text NOT NULL,
  corpo        text NOT NULL,
  ativo        boolean NOT NULL DEFAULT true,
  publicado_em timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comunicados_ativo_publicado ON public.comunicados (ativo, publicado_em DESC);

ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

-- Equipe (mesmos cargos que já gerenciam conteúdo administrativo) pode ver e
-- gerenciar. O cliente final NUNCA acessa esta tabela direto — só através da
-- Edge Function cliente-portal-data, que usa service role e ignora RLS.
CREATE POLICY "Staff can view comunicados" ON public.comunicados
  FOR SELECT
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Advogado'::app_role) OR has_role(auth.uid(), 'Secretaria'::app_role) OR
    has_role(auth.uid(), 'Atendente'::app_role) OR has_role(auth.uid(), 'Estagiário'::app_role)
  );

CREATE POLICY "Staff can manage comunicados" ON public.comunicados
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role)
  );

CREATE POLICY "Staff can update comunicados" ON public.comunicados
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role)
  );

CREATE POLICY "Staff can delete comunicados" ON public.comunicados
  FOR DELETE
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role)
  );

CREATE TRIGGER set_comunicados_updated_at
  BEFORE UPDATE ON public.comunicados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
