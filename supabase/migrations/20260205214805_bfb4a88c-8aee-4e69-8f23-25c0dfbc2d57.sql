-- Garantir que a instância de TRÁFEGO/ISA seja a default do sistema
-- (assim, qualquer chamada que não passar instance_id NÃO cai no config legado)

UPDATE public.zapi_instances
SET is_default = CASE
  WHEN instance_id = '3EDDF959BC2B81F86B410203B614D70E' THEN true
  ELSE false
END,
    is_active = CASE
  WHEN instance_id = '3EDDF959BC2B81F86B410203B614D70E' THEN true
  ELSE COALESCE(is_active, true)
END,
    updated_at = now();
