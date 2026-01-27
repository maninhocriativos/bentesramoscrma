-- Adicionar coluna tipo_origem para categorizar leads por fonte
ALTER TABLE leads_juridicos 
ADD COLUMN IF NOT EXISTS tipo_origem TEXT DEFAULT 'indefinido';

-- Atualizar leads existentes baseado na lógica de categorização
UPDATE leads_juridicos
SET tipo_origem = CASE
  -- Leads de tráfego pago (campanhas de marketing)
  WHEN fonte_trafego IN ('trafego_pago', 'instagram', 'google_ads', 'facebook_ads') THEN 'trafego'
  WHEN canal_origem IN ('instagram', 'facebook', 'google') THEN 'trafego'
  -- Leads antigos sem fonte definida = WhatsApp direto (clientes legados)
  WHEN created_at < NOW() - INTERVAL '30 days' AND (fonte_trafego IS NULL OR fonte_trafego = '' OR fonte_trafego = 'organico') THEN 'whatsapp_direto'
  -- WhatsApp orgânico também é direto
  WHEN fonte_trafego = 'organico' AND canal_origem = 'whatsapp' THEN 'whatsapp_direto'
  WHEN canal_origem = 'whatsapp' AND (fonte_trafego IS NULL OR fonte_trafego = '') THEN 'whatsapp_direto'
  -- Demais ficam como indefinido para categorização manual
  ELSE 'indefinido'
END
WHERE tipo_origem IS NULL OR tipo_origem = 'indefinido';

-- Criar índice para otimizar consultas por tipo de origem
CREATE INDEX IF NOT EXISTS idx_leads_tipo_origem ON leads_juridicos(tipo_origem);