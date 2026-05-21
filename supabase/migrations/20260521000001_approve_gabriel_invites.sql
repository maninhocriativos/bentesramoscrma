-- Confirma email e aprova os dois Gabriels que já criaram senha mas não conseguem logar
-- Emails: gabrielcesar@bentesramos.adv.br e gabrielcezar@bentesramos.org

-- 1. Confirma o email no auth.users (resolve "email ou senha inválidos")
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at         = NOW()
WHERE email IN (
  'gabrielcesar@bentesramos.adv.br',
  'gabrielcezar@bentesramos.org'
)
AND email_confirmed_at IS NULL;

-- 2. Aprova o perfil (resolve "conta não aprovada")
UPDATE public.perfis
SET
  aprovado = true,
  cargo    = COALESCE(cargo, 'Estagiário')
WHERE email IN (
  'gabrielcesar@bentesramos.adv.br',
  'gabrielcezar@bentesramos.org'
);

-- 3. Garante registro em user_roles (sem ON CONFLICT pois não há unique em user_id)
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'Estagiário'::public.app_role
FROM public.perfis p
WHERE p.email IN (
  'gabrielcesar@bentesramos.adv.br',
  'gabrielcezar@bentesramos.org'
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
);

-- 4. Marca os convites como aceitos
UPDATE public.pending_invites
SET accepted_at = NOW()
WHERE email IN (
  'gabrielcesar@bentesramos.adv.br',
  'gabrielcezar@bentesramos.org'
)
AND accepted_at IS NULL;
