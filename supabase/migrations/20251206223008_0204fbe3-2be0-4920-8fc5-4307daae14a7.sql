-- Enable RLS on perfis table
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.perfis
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.perfis
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Enable RLS on processos table
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view processos
CREATE POLICY "Authenticated users can view processos"
ON public.processos
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert processos
CREATE POLICY "Authenticated users can insert processos"
ON public.processos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update processos
CREATE POLICY "Authenticated users can update processos"
ON public.processos
FOR UPDATE
TO authenticated
USING (true);

-- Policy: Authenticated users can delete processos
CREATE POLICY "Authenticated users can delete processos"
ON public.processos
FOR DELETE
TO authenticated
USING (true);