-- contract_reminders_zapsign restringia INSERT/UPDATE a Administrador, diferente da
-- tabela equivalente do ClickSign (contract_reminders), que libera qualquer usuário
-- autenticado. Isso deixaria o novo botão "Vincular Lead" do ZapSign quebrado
-- silenciosamente (RLS nega) para Gerente/Advogado/Secretaria. Alinha as duas.
DROP POLICY IF EXISTS "Admins can insert contracts" ON contract_reminders_zapsign;
DROP POLICY IF EXISTS "Admins can update contracts" ON contract_reminders_zapsign;

CREATE POLICY "Authenticated users can insert contracts"
  ON contract_reminders_zapsign FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contracts"
  ON contract_reminders_zapsign FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
