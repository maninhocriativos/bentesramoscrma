-- Auditoria de segurança (2026-08-25): furos confirmados AO VIVO no banco de
-- produção (checado direto via pg_policies, não só pelas migrations — achamos
-- 1 caso a mais, em processos, que uma auditoria anterior tinha marcado como já
-- corrigido só por olhar o histórico de arquivos, sem checar o estado real).
-- Este migration só REMOVE acesso indevido ou ADICIONA travas — não tira
-- nenhuma permissão que a equipe usa legitimamente hoje.
--
-- IMPORTANTE: antes de remover as políticas permissivas de leads_juridicos e
-- processos, este migration primeiro AMPLIA as políticas "by role" pra incluir
-- 'Estagiário' — o cargo já é liberado pelo próprio frontend (usePerfil:
-- canAccessLeads/canAccessProcessos incluem isEstagiario, e useProcessos.ts tem
-- lógica dedicada de co_responsavel_id pra estagiário) e existe pelo menos um
-- usuário real e aprovado com esse cargo hoje (Gabriel Cesar). A política
-- "by role" atual NÃO incluía Estagiário — sem esse ajuste, remover a política
-- permissiva teria cortado o acesso dele a leads e processos silenciosamente
-- (RLS nunca dá erro, só devolve lista vazia).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) leads_juridicos
-- 1a) Amplia as políticas "by role" pra incluir Estagiário (só então a política
-- permissiva abaixo deixa de fazer falta pra esse cargo).
DROP POLICY IF EXISTS "View leads by role" ON public.leads_juridicos;
CREATE POLICY "View leads by role" ON public.leads_juridicos
  FOR SELECT
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Advogado'::app_role) OR has_role(auth.uid(), 'Secretaria'::app_role) OR
    has_role(auth.uid(), 'Atendente'::app_role) OR has_role(auth.uid(), 'Estagiário'::app_role)
  );

DROP POLICY IF EXISTS "Insert leads by role" ON public.leads_juridicos;
CREATE POLICY "Insert leads by role" ON public.leads_juridicos
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Advogado'::app_role) OR has_role(auth.uid(), 'Secretaria'::app_role) OR
    has_role(auth.uid(), 'Atendente'::app_role) OR has_role(auth.uid(), 'Estagiário'::app_role)
  );

DROP POLICY IF EXISTS "Update leads by role" ON public.leads_juridicos;
CREATE POLICY "Update leads by role" ON public.leads_juridicos
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Advogado'::app_role) OR has_role(auth.uid(), 'Secretaria'::app_role) OR
    has_role(auth.uid(), 'Atendente'::app_role) OR has_role(auth.uid(), 'Estagiário'::app_role)
  );
-- Delete não muda: já era só Administrador/Gerente, igual ao canDelete do frontend.

-- 1b) Só agora remove a política permissiva "Authenticated users full access"
-- (qual/with_check = true, FOR ALL) — hoje ela anula toda restrição de cargo,
-- porque políticas RLS se somam por OR.
DROP POLICY IF EXISTS "Authenticated users full access" ON public.leads_juridicos;
-- "Service role full access leads" NÃO é tocada — é o backend (Edge Functions),
-- não usuários finais, e precisa continuar com acesso total.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1c) processos: MESMO padrão de furo encontrado ao vivo (política permissiva
-- "Authenticated users can view/insert/update/delete processos", qual = true,
-- coexistindo com as políticas "by role"), e a mesma lacuna de Estagiário na
-- política "by role" (View/Insert processos, Update processos).
DROP POLICY IF EXISTS "View processos authenticated" ON public.processos;
CREATE POLICY "View processos authenticated" ON public.processos
  FOR SELECT
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Secretaria'::app_role) OR has_role(auth.uid(), 'Advogado'::app_role) OR
    has_role(auth.uid(), 'Estagiário'::app_role)
  );

DROP POLICY IF EXISTS "Insert processos by role" ON public.processos;
CREATE POLICY "Insert processos by role" ON public.processos
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Secretaria'::app_role) OR has_role(auth.uid(), 'Advogado'::app_role) OR
    has_role(auth.uid(), 'Estagiário'::app_role)
  );

DROP POLICY IF EXISTS "Update processos" ON public.processos;
CREATE POLICY "Update processos" ON public.processos
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role) OR
    has_role(auth.uid(), 'Secretaria'::app_role) OR has_role(auth.uid(), 'Advogado'::app_role) OR
    has_role(auth.uid(), 'Estagiário'::app_role)
  );
-- "Only admins can delete processos" não muda — igual ao canDelete do frontend.

DROP POLICY IF EXISTS "Authenticated users can view processos" ON public.processos;
DROP POLICY IF EXISTS "Authenticated users can insert processos" ON public.processos;
DROP POLICY IF EXISTS "Authenticated users can update processos" ON public.processos;
DROP POLICY IF EXISTS "Authenticated users can delete processos" ON public.processos;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) perfis: a política de auto-edição ("Users can update own profile" /
-- "Usuários podem editar seu próprio perfil", ambas auth.uid() = id, sem
-- with_check) restringe QUAL LINHA o usuário edita, mas não QUAIS CAMPOS — ou
-- seja, qualquer usuário pode fazer um UPDATE no próprio perfil setando
-- cargo = 'Administrador' ou aprovado = true. Trigger abaixo bloqueia essa
-- mudança específica para quem não é Administrador, sem tocar nas políticas
-- (edição de nome/telefone/oab etc. continua liberada normalmente).
--
-- auth.uid() IS NULL é tratado como "passa" de propósito: é o caso de
-- admin-approve-invite/accept-invite atualizando perfis com a service_role key
-- (sem JWT de usuário associado) — essas Edge Functions já fazem sua própria
-- checagem de quem pode chamar; bloquear aqui quebraria a aprovação real de
-- convites. O trigger existe pra fechar o auto-serviço via API/PostgREST com a
-- sessão do próprio usuário, não pra desconfiar do backend (que já tem RLS
-- bypassada por completo via service_role, mesma fronteira de confiança).
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR has_role(auth.uid(), 'Administrador'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.cargo IS DISTINCT FROM OLD.cargo THEN
    RAISE EXCEPTION 'Apenas Administradores podem alterar o cargo de um perfil';
  END IF;

  IF NEW.aprovado IS DISTINCT FROM OLD.aprovado THEN
    RAISE EXCEPTION 'Apenas Administradores podem aprovar/reprovar um perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.perfis;
CREATE TRIGGER trg_prevent_self_privilege_escalation
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_privilege_escalation();

-- Limpeza: política duplicada (mesma condição exata da "Users can update own
-- profile", nome antigo em português) — remove só a redundância, nenhum acesso
-- muda, a outra política equivalente continua valendo.
DROP POLICY IF EXISTS "Usuários podem editar seu próprio perfil" ON public.perfis;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) manychat_mensagens / manychat_subscribers: política de INSERT sem "TO
-- authenticated" vale por padrão para PUBLIC — inclui o papel "anon", ou seja,
-- dá pra inserir mensagem falsa numa conversa de cliente só com a chave pública
-- do site, sem nenhum login. Restringe pra quem está autenticado (equipe),
-- que é quem de fato usa essa gravação (chat, webhooks via service_role — que
-- já ignora RLS de qualquer forma).
DROP POLICY IF EXISTS "Insert mensagens" ON public.manychat_mensagens;
CREATE POLICY "Insert mensagens" ON public.manychat_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Insert subscribers" ON public.manychat_subscribers;
CREATE POLICY "Insert subscribers" ON public.manychat_subscribers
  FOR INSERT TO authenticated
  WITH CHECK (true);
