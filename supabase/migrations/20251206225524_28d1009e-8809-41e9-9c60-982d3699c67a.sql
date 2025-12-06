-- Add new columns to perfis table
ALTER TABLE public.perfis 
ADD COLUMN IF NOT EXISTS sobrenome text,
ADD COLUMN IF NOT EXISTS telefone text;

-- Create pending_invites table to track invitations
CREATE TABLE IF NOT EXISTS public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'Secretaria',
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invites
CREATE POLICY "Admins can view all invites"
ON public.pending_invites FOR SELECT
USING (public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Admins can insert invites"
ON public.pending_invites FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Admins can delete invites"
ON public.pending_invites FOR DELETE
USING (public.has_role(auth.uid(), 'Administrador'));

-- Update handle_new_user to check for pending invites and assign role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_role app_role;
BEGIN
  -- Check if there's a pending invite for this email
  SELECT role INTO pending_role
  FROM public.pending_invites
  WHERE email = new.email
  AND accepted_at IS NULL;
  
  -- Use pending role or default to Administrador for first user
  IF pending_role IS NOT NULL THEN
    -- Insert profile with pending role
    INSERT INTO public.perfis (id, email, cargo)
    VALUES (new.id, new.email, pending_role::text);
    
    -- Insert role in user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, pending_role);
    
    -- Mark invite as accepted
    UPDATE public.pending_invites
    SET accepted_at = now()
    WHERE email = new.email;
  ELSE
    -- Default behavior for non-invited users (first admin)
    INSERT INTO public.perfis (id, email, cargo)
    VALUES (new.id, new.email, 'Administrador');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'Administrador');
  END IF;
  
  RETURN new;
END;
$$;