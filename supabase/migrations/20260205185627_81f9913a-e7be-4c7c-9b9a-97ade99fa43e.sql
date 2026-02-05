-- =========================================
-- ADICIONAR CAMPOS PARA SEPARAÇÃO BENTES RAMOS vs TRÁFEGO
-- =========================================

-- 1. Campos na tabela leads_juridicos
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS linha_whatsapp text DEFAULT 'indefinido';

ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS empresa_tag text DEFAULT NULL;

ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS owner_tipo text DEFAULT 'isa';

ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS isa_ativa boolean DEFAULT true;

ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS whatsapp_numero_destino text DEFAULT NULL;

-- 2. Campos na tabela manychat_subscribers (incluindo instance_name se não existir)
ALTER TABLE public.manychat_subscribers
ADD COLUMN IF NOT EXISTS instance_name text DEFAULT NULL;

ALTER TABLE public.manychat_subscribers
ADD COLUMN IF NOT EXISTS linha_whatsapp text DEFAULT 'indefinido';

ALTER TABLE public.manychat_subscribers
ADD COLUMN IF NOT EXISTS empresa_tag text DEFAULT NULL;

-- =========================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- =========================================

CREATE INDEX IF NOT EXISTS idx_leads_linha_whatsapp ON public.leads_juridicos(linha_whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_tag ON public.leads_juridicos(empresa_tag);
CREATE INDEX IF NOT EXISTS idx_leads_owner_tipo ON public.leads_juridicos(owner_tipo);
CREATE INDEX IF NOT EXISTS idx_leads_isa_ativa ON public.leads_juridicos(isa_ativa);
CREATE INDEX IF NOT EXISTS idx_subscribers_linha_whatsapp ON public.manychat_subscribers(linha_whatsapp);
CREATE INDEX IF NOT EXISTS idx_subscribers_instance_name ON public.manychat_subscribers(instance_name);