-- 1. Fix lead_contract_data: restrict to authenticated users
DROP POLICY IF EXISTS "Users can manage contract data" ON public.lead_contract_data;
DROP POLICY IF EXISTS "Users can view contract data" ON public.lead_contract_data;

CREATE POLICY "Authenticated users can manage contract data"
ON public.lead_contract_data FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Fix lead_classifications: restrict to authenticated users
DROP POLICY IF EXISTS "Users can manage classifications" ON public.lead_classifications;
DROP POLICY IF EXISTS "Users can view classifications" ON public.lead_classifications;

CREATE POLICY "Authenticated users can manage classifications"
ON public.lead_classifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Fix procuracoes: restrict to authenticated users
DROP POLICY IF EXISTS "Users can create procuracoes" ON public.procuracoes;
DROP POLICY IF EXISTS "Users can delete procuracoes" ON public.procuracoes;
DROP POLICY IF EXISTS "Users can update procuracoes" ON public.procuracoes;
DROP POLICY IF EXISTS "Users can view procuracoes" ON public.procuracoes;

CREATE POLICY "Authenticated users can manage procuracoes"
ON public.procuracoes FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Fix notificacoes_internas: restrict INSERT to authenticated + service_role
DROP POLICY IF EXISTS "System can insert notifications" ON public.notificacoes_internas;

CREATE POLICY "Authenticated users can insert notifications"
ON public.notificacoes_internas FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can insert notifications"
ON public.notificacoes_internas FOR INSERT
TO service_role
WITH CHECK (true);