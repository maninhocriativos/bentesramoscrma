-- Add UPDATE policy for pending_invites
CREATE POLICY "Admins can update invites"
ON public.pending_invites
FOR UPDATE
USING (has_role(auth.uid(), 'Administrador'::app_role))
WITH CHECK (has_role(auth.uid(), 'Administrador'::app_role));