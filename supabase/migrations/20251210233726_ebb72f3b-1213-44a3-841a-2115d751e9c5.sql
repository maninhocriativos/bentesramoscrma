-- Add approved field to perfis table for admin approval workflow
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT false;

-- Update handle_new_user function to set aprovado based on invite status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_role app_role;
  is_invited boolean := false;
BEGIN
  -- Check if there's a pending invite for this email
  SELECT role INTO pending_role
  FROM public.pending_invites
  WHERE email = new.email
  AND accepted_at IS NULL;
  
  is_invited := pending_role IS NOT NULL;
  
  -- Use pending role or default to Administrador for first user
  IF is_invited THEN
    -- Insert profile with pending role - approved since invited
    INSERT INTO public.perfis (id, email, cargo, aprovado)
    VALUES (new.id, new.email, pending_role::text, true);
    
    -- Insert role in user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, pending_role);
    
    -- Mark invite as accepted
    UPDATE public.pending_invites
    SET accepted_at = now()
    WHERE email = new.email;
  ELSE
    -- Non-invited users need admin approval
    INSERT INTO public.perfis (id, email, cargo, aprovado)
    VALUES (new.id, new.email, 'Advogado', false);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'Advogado');
  END IF;
  
  RETURN new;
END;
$$;

-- Update existing users to be approved (they already have access)
UPDATE public.perfis SET aprovado = true WHERE aprovado IS NULL OR aprovado = false;