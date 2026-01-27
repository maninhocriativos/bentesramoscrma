-- Criar tabela para múltiplas instâncias Z-API
CREATE TABLE public.zapi_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  token TEXT NOT NULL,
  client_token TEXT,
  webhook_secret TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  last_test_at TIMESTAMP WITH TIME ZONE,
  last_test_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.zapi_instances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar instâncias Z-API"
ON public.zapi_instances
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'Administrador'::app_role
));

CREATE POLICY "Gerentes podem visualizar instâncias Z-API"
ON public.zapi_instances
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('Administrador'::app_role, 'Gerente'::app_role)
));

-- Trigger para updated_at
CREATE TRIGGER update_zapi_instances_updated_at
BEFORE UPDATE ON public.zapi_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca rápida da instância default
CREATE INDEX idx_zapi_instances_default ON public.zapi_instances (is_default) WHERE is_active = true;

-- Índice para busca por número de telefone
CREATE INDEX idx_zapi_instances_phone ON public.zapi_instances (phone_number) WHERE is_active = true;