-- 1. Remove anonymous read access from leads_juridicos (CRITICAL: PII exposure)
DROP POLICY IF EXISTS "Anon read access" ON public.leads_juridicos;

-- 2. Create role enum and user_roles table for proper server-side authorization
CREATE TYPE public.app_role AS ENUM ('Administrador', 'Advogado', 'Secretaria');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'Secretaria',
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Create SECURITY DEFINER function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Fix handle_new_user function with proper search_path and add role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.perfis (id, email, cargo)
  VALUES (new.id, new.email, 'Administrador');
  
  -- Insert role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'Administrador');
  
  RETURN new;
END;
$$;

-- 5. Update processos RLS policies to enforce role-based access

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can delete processos" ON public.processos;
DROP POLICY IF EXISTS "Authenticated users can insert processos" ON public.processos;
DROP POLICY IF EXISTS "Authenticated users can update processos" ON public.processos;
DROP POLICY IF EXISTS "Authenticated users can view processos" ON public.processos;

-- SELECT: Admins see all, Advogados see only their cases, Secretaria sees all
CREATE POLICY "View processos based on role"
ON public.processos FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Administrador') 
  OR public.has_role(auth.uid(), 'Secretaria')
  OR (public.has_role(auth.uid(), 'Advogado') AND advogado_responsavel = (SELECT nome FROM public.perfis WHERE id = auth.uid()))
);

-- INSERT: All authenticated users can create processos
CREATE POLICY "Authenticated users can insert processos"
ON public.processos FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Admins can update all, Advogados only their own cases
CREATE POLICY "Update processos based on role"
ON public.processos FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'Administrador')
  OR (public.has_role(auth.uid(), 'Advogado') AND advogado_responsavel = (SELECT nome FROM public.perfis WHERE id = auth.uid()))
  OR public.has_role(auth.uid(), 'Secretaria')
);

-- DELETE: Only Administrador can delete
CREATE POLICY "Only admins can delete processos"
ON public.processos FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'Administrador'));

-- 6. Update leads_juridicos policies to use role-based checks
DROP POLICY IF EXISTS "Authenticated users full access" ON public.leads_juridicos;

-- SELECT: All authenticated users can view leads
CREATE POLICY "Authenticated users can view leads"
ON public.leads_juridicos FOR SELECT
TO authenticated
USING (true);

-- INSERT: All authenticated users can create leads
CREATE POLICY "Authenticated users can insert leads"
ON public.leads_juridicos FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: All authenticated users can update leads
CREATE POLICY "Authenticated users can update leads"
ON public.leads_juridicos FOR UPDATE
TO authenticated
USING (true);

-- DELETE: Only Administrador can delete leads
CREATE POLICY "Only admins can delete leads"
ON public.leads_juridicos FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'Administrador'));