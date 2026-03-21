-- Fix lead_state_history: restrict open policies to authenticated users only
DROP POLICY IF EXISTS "Users can view lead state history" ON public.lead_state_history;
DROP POLICY IF EXISTS "System can insert lead state history" ON public.lead_state_history;

-- SELECT: only authenticated users
CREATE POLICY "Authenticated users can view lead state history"
  ON public.lead_state_history FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only service_role (from edge functions / DB functions)
CREATE POLICY "Service role can insert lead state history"
  ON public.lead_state_history FOR INSERT
  TO service_role
  WITH CHECK (true);