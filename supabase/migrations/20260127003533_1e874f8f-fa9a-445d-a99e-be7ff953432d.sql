-- ===========================================
-- Migration: Add contract reuse tracking and lead traffic source
-- ===========================================

-- 1. Add traffic source field to leads (to identify paid traffic vs organic)
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS fonte_trafego TEXT DEFAULT NULL;

-- Valid values: 'trafego_pago', 'organico', 'indicacao', 'site', 'instagram', 'google_ads', 'facebook_ads', 'outro'
COMMENT ON COLUMN public.leads_juridicos.fonte_trafego IS 'Traffic source: trafego_pago, organico, indicacao, etc.';

-- 2. Add additional contracts count for reuse rate tracking
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS contratos_adicionais INTEGER DEFAULT 0;

COMMENT ON COLUMN public.leads_juridicos.contratos_adicionais IS 'Number of additional contracts closed with this client (for reuse rate)';

-- 3. Add first_message_source to track where lead came from initially
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS canal_origem TEXT DEFAULT NULL;

COMMENT ON COLUMN public.leads_juridicos.canal_origem IS 'Channel where lead first contacted: instagram, whatsapp, facebook, site';

-- 4. Create table for Z-API follow-ups
CREATE TABLE IF NOT EXISTS public.zapi_followups (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
    subscriber_id TEXT NOT NULL,
    telefone TEXT NOT NULL,
    
    -- Follow-up stages (FAST and SLOW)
    stage_fast INTEGER DEFAULT 0,
    stage_slow INTEGER DEFAULT 0,
    
    -- Timing
    primeiro_contato_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_inbound_at TIMESTAMP WITH TIME ZONE,
    last_outbound_at TIMESTAMP WITH TIME ZONE,
    next_followup_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    respondido BOOLEAN DEFAULT FALSE,
    respondido_em TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'ativo', -- 'ativo', 'pausado', 'concluido', 'bloqueado'
    lock_reason TEXT,
    
    -- Tracking
    total_followups_enviados INTEGER DEFAULT 0,
    ultimo_tipo_enviado TEXT, -- 'FAST_1', 'FAST_2', 'SLOW_1', etc.
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on zapi_followups
ALTER TABLE public.zapi_followups ENABLE ROW LEVEL SECURITY;

-- RLS policies for zapi_followups
CREATE POLICY "View zapi_followups authenticated" 
ON public.zapi_followups 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Insert zapi_followups" 
ON public.zapi_followups 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Update zapi_followups" 
ON public.zapi_followups 
FOR UPDATE 
USING (true);

CREATE POLICY "Delete zapi_followups admin only" 
ON public.zapi_followups 
FOR DELETE 
USING (has_role(auth.uid(), 'Administrador'::app_role));

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_zapi_followups_lead_id ON public.zapi_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_zapi_followups_next_followup ON public.zapi_followups(next_followup_at) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_zapi_followups_subscriber ON public.zapi_followups(subscriber_id);

-- 5. Add unique constraint on phone to prevent duplicates in subscribers
-- First, we need to normalize existing data - add normalized_phone column
ALTER TABLE public.manychat_subscribers
ADD COLUMN IF NOT EXISTS telefone_normalizado TEXT;

-- Create function to normalize phone numbers
CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT)
RETURNS TEXT AS $$
DECLARE
    cleaned TEXT;
BEGIN
    IF phone IS NULL OR phone = '' OR phone = '{{wa_id}}' THEN
        RETURN NULL;
    END IF;
    
    -- Remove all non-numeric characters
    cleaned := regexp_replace(phone, '[^0-9]', '', 'g');
    
    -- If empty after cleaning, return null
    IF cleaned = '' THEN
        RETURN NULL;
    END IF;
    
    -- Add Brazil country code if missing
    IF length(cleaned) = 10 OR length(cleaned) = 11 THEN
        cleaned := '55' || cleaned;
    END IF;
    
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Create index on normalized phone
CREATE INDEX IF NOT EXISTS idx_subscribers_telefone_normalizado ON public.manychat_subscribers(telefone_normalizado);

-- 6. Create trigger to auto-normalize phone on insert/update
CREATE OR REPLACE FUNCTION update_normalized_phone()
RETURNS TRIGGER AS $$
BEGIN
    NEW.telefone_normalizado := normalize_phone_number(NEW.telefone);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_normalize_phone ON public.manychat_subscribers;
CREATE TRIGGER trg_normalize_phone
BEFORE INSERT OR UPDATE OF telefone ON public.manychat_subscribers
FOR EACH ROW
EXECUTE FUNCTION update_normalized_phone();

-- 7. Update existing subscribers with normalized phones
UPDATE public.manychat_subscribers
SET telefone_normalizado = normalize_phone_number(telefone)
WHERE telefone IS NOT NULL AND telefone != '{{wa_id}}';