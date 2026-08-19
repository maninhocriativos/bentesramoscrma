-- Bug: intimações sincronizadas pelo cron (ou por sync manual sob a OAB do
-- escritório) ficam com advogado_id = null, propositalmente (ver comentário
-- em IntimacoesPage.tsx handleSync) — quem clicou nem sempre é o dono da OAB.
-- O front-end já resolve o "responsável" por fallback de OAB nesse caso
-- (resolverResponsavel em IntimacoesPage.tsx), mas a policy de RLS do SELECT
-- só liberava advogado_id = auth.uid(), então essas linhas ficavam invisíveis
-- pra qualquer usuário que não fosse Administrador/Gerente — mesmo sendo o
-- dono real daquela OAB. Resultado: intimações reais no banco, sumindo da tela.

DROP POLICY IF EXISTS "Users can view own intimacoes" ON public.intimacoes;
CREATE POLICY "Users can view own intimacoes"
  ON public.intimacoes
  FOR SELECT
  USING (
    advogado_id = auth.uid()
    OR has_role(auth.uid(), 'Administrador'::app_role)
    OR has_role(auth.uid(), 'Gerente'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = auth.uid()
        AND p.oab_numero IS NOT NULL
        AND p.oab_numero = intimacoes.oab_numero
        AND COALESCE(p.oab_uf, 'AM') = COALESCE(intimacoes.oab_uf, 'AM')
    )
  );

DROP POLICY IF EXISTS "Users can update own intimacoes" ON public.intimacoes;
CREATE POLICY "Users can update own intimacoes"
  ON public.intimacoes
  FOR UPDATE
  USING (
    advogado_id = auth.uid()
    OR has_role(auth.uid(), 'Administrador'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.perfis p
      WHERE p.id = auth.uid()
        AND p.oab_numero IS NOT NULL
        AND p.oab_numero = intimacoes.oab_numero
        AND COALESCE(p.oab_uf, 'AM') = COALESCE(intimacoes.oab_uf, 'AM')
    )
  );
