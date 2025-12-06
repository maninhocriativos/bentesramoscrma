-- Allow admins to view ALL profiles (not just their own)
CREATE POLICY "Admins can view all profiles"
ON public.perfis FOR SELECT
USING (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to update any profile
CREATE POLICY "Admins can update all profiles"
ON public.perfis FOR UPDATE
USING (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.perfis FOR DELETE
USING (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to insert profiles (for manual user creation)
CREATE POLICY "Admins can insert profiles"
ON public.perfis FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to view all user_roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to update user roles
CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to insert user roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'Administrador')
);

-- Allow admins to delete user roles
CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'Administrador')
);