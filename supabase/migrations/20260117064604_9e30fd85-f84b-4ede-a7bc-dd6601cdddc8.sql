-- =====================================================
-- STATE MACHINE DO LEAD + INTEGRAÇÕES Z-API/FIQON
-- =====================================================

-- 1) ADICIONAR CAMPOS DE STATE MACHINE NA TABELA leads_juridicos
ALTER TABLE public.leads_juridicos
ADD COLUMN IF NOT EXISTS lead_state TEXT DEFAULT 'NEW',
ADD COLUMN IF NOT EXISTS state_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS triage_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contract_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lost_reason TEXT,
ADD COLUMN IF NOT EXISTS lost_at TIMESTAMP WITH TIME ZONE;

-- 2) CRIAR TABELA DE HISTÓRICO DE ESTADOS
CREATE TABLE IF NOT EXISTS public.lead_state_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead state history"
  ON public.lead_state_history FOR SELECT USING (true);

CREATE POLICY "System can insert lead state history"
  ON public.lead_state_history FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_state_history_lead_id ON public.lead_state_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_state_history_created_at ON public.lead_state_history(created_at DESC);

-- 3) CRIAR TABELA DE PROMPTS DA ISA
CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  greeting_message TEXT,
  strict_mode BOOLEAN DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ai prompts"
  ON public.ai_prompts FOR SELECT USING (true);

CREATE POLICY "Admins can manage ai prompts"
  ON public.ai_prompts FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Administrador', 'Gerente')
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_prompts_name ON public.ai_prompts(name);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_version ON public.ai_prompts(name, version DESC);

-- 4) CRIAR TABELA DE CONFIGURAÇÃO DE INTEGRAÇÕES
CREATE TABLE IF NOT EXISTS public.integrations_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  config_json JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  last_test_at TIMESTAMP WITH TIME ZONE,
  last_test_status TEXT,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integrations"
  ON public.integrations_config FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins can manage integrations"
  ON public.integrations_config FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'Administrador'
    )
  );

-- 5) CRIAR TABELA DE LOGS DE INTEGRAÇÃO
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  endpoint TEXT,
  payload_json JSONB,
  response_json JSONB,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'pending')),
  error_message TEXT,
  duration_ms INTEGER,
  lead_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration logs"
  ON public.integration_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "System can insert integration logs"
  ON public.integration_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_integration_logs_provider ON public.integration_logs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_lead_id ON public.integration_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON public.integration_logs(status);

-- 6) CRIAR TABELA DE CHECKLIST DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.lead_docs_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_label TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  received BOOLEAN DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE,
  file_id UUID REFERENCES public.documentos(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, doc_type)
);

ALTER TABLE public.lead_docs_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view docs checklist"
  ON public.lead_docs_checklist FOR SELECT USING (true);

CREATE POLICY "Users can manage docs checklist"
  ON public.lead_docs_checklist FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_lead_docs_checklist_lead_id ON public.lead_docs_checklist(lead_id);

-- 7) CRIAR TABELA DE CLASSIFICAÇÃO DE CASOS
CREATE TABLE IF NOT EXISTS public.lead_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE UNIQUE,
  case_type TEXT NOT NULL,
  sub_type TEXT,
  summary TEXT,
  recommended_docs TEXT[],
  confidence_score NUMERIC(3,2),
  classified_by TEXT DEFAULT 'isa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view classifications"
  ON public.lead_classifications FOR SELECT USING (true);

CREATE POLICY "Users can manage classifications"
  ON public.lead_classifications FOR ALL USING (true);

-- 8) CRIAR TABELA DE DADOS DO LEAD PARA CONTRATO
CREATE TABLE IF NOT EXISTS public.lead_contract_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_juridicos(id) ON DELETE CASCADE UNIQUE,
  cpf TEXT,
  rg TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  estado_civil TEXT,
  profissao TEXT,
  nacionalidade TEXT DEFAULT 'brasileiro(a)',
  data_nascimento DATE,
  nome_mae TEXT,
  dados_extras JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_contract_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contract data"
  ON public.lead_contract_data FOR SELECT USING (true);

CREATE POLICY "Users can manage contract data"
  ON public.lead_contract_data FOR ALL USING (true);

-- 9) FUNÇÃO PARA ATUALIZAR STATE E REGISTRAR HISTÓRICO
CREATE OR REPLACE FUNCTION public.update_lead_state(
  p_lead_id UUID,
  p_to_state TEXT,
  p_changed_by TEXT DEFAULT 'system',
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_state TEXT;
  v_valid_transitions JSONB := '{
    "NEW": ["TRIAGE"],
    "TRIAGE": ["CLASSIFIED", "NEW"],
    "CLASSIFIED": ["DATA_CAPTURE", "TRIAGE"],
    "DATA_CAPTURE": ["CONTRACT_SENT", "CLASSIFIED"],
    "CONTRACT_SENT": ["CONTRACT_SIGNED", "DATA_CAPTURE"],
    "CONTRACT_SIGNED": ["DOCS_PENDING", "CONTRACT_SENT"],
    "DOCS_PENDING": ["READY_FOR_LAWYER", "CONTRACT_SIGNED"],
    "READY_FOR_LAWYER": ["DOCS_PENDING"]
  }';
  v_allowed_states JSONB;
BEGIN
  SELECT lead_state INTO v_current_state
  FROM leads_juridicos
  WHERE id = p_lead_id;
  
  IF v_current_state IS NULL THEN
    v_current_state := 'NEW';
  END IF;
  
  v_allowed_states := v_valid_transitions -> v_current_state;
  
  IF v_allowed_states IS NULL OR NOT (v_allowed_states ? p_to_state) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Transição inválida: %s -> %s', v_current_state, p_to_state),
      'allowed_transitions', v_allowed_states
    );
  END IF;
  
  UPDATE leads_juridicos
  SET 
    lead_state = p_to_state,
    state_updated_at = now(),
    triage_started_at = CASE WHEN p_to_state = 'TRIAGE' THEN now() ELSE triage_started_at END,
    contract_sent_at = CASE WHEN p_to_state = 'CONTRACT_SENT' THEN now() ELSE contract_sent_at END,
    contract_signed_at = CASE WHEN p_to_state = 'CONTRACT_SIGNED' THEN now() ELSE contract_signed_at END,
    updated_at = now()
  WHERE id = p_lead_id;
  
  INSERT INTO lead_state_history (lead_id, from_state, to_state, changed_by, reason)
  VALUES (p_lead_id, v_current_state, p_to_state, p_changed_by, p_reason);
  
  RETURN jsonb_build_object(
    'success', true,
    'from_state', v_current_state,
    'to_state', p_to_state
  );
END;
$$;

-- 10) FUNÇÃO SIMPLES PARA MARCAR LEADS INATIVOS (sem GET DIAGNOSTICS)
CREATE OR REPLACE FUNCTION public.mark_inactive_leads_as_lost()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE leads_juridicos
    SET 
      is_lost = true,
      lost_reason = CASE 
        WHEN lead_state = 'TRIAGE' THEN 'Sem resposta há 72h na triagem'
        WHEN lead_state = 'DATA_CAPTURE' THEN 'Sem resposta há 72h na coleta de dados'
        WHEN lead_state = 'DOCS_PENDING' THEN 'Sem envio de documentos há 7 dias'
      END,
      lost_at = now()
    WHERE is_lost = false
      AND (
        (lead_state = 'TRIAGE' AND state_updated_at < now() - interval '72 hours')
        OR (lead_state = 'DATA_CAPTURE' AND state_updated_at < now() - interval '72 hours')
        OR (lead_state = 'DOCS_PENDING' AND state_updated_at < now() - interval '7 days')
      )
      AND (last_contact_at IS NULL OR last_contact_at < state_updated_at)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  
  RETURN v_count;
END;
$$;

-- Inserir prompt padrão da Isa
INSERT INTO public.ai_prompts (name, content, greeting_message, strict_mode, version, updated_by)
VALUES (
  'isa_system_prompt',
  'Você é Isa, assistente virtual do escritório Bentes & Ramos Advogados.

## REGRAS ABSOLUTAS
1. NUNCA afirme ilegalidade ou garanta resultado de ação judicial
2. Use linguagem condicional: "há indícios", "em tese", "depende de análise"
3. Seu papel é TRIAGEM e ORGANIZAÇÃO, não parecer jurídico
4. Foque em conduzir o lead pelas etapas do funil

## COMPORTAMENTO POR ESTADO DO LEAD

### NEW (Novo contato)
- Acolha o cliente com empatia
- Peça permissão para fazer perguntas rápidas
- Objetivo: mover para TRIAGE

### TRIAGE (Triagem)
- Faça perguntas objetivas sobre o caso
- Identifique: tipo de problema, tempo, documentos disponíveis
- Objetivo: classificar e mover para CLASSIFIED

### CLASSIFIED (Classificado)
- Explique "em tese" o caminho possível
- Peça dados pessoais para contrato (nome, CPF, endereço, etc)
- Objetivo: coletar dados e mover para DATA_CAPTURE

### DATA_CAPTURE (Coletando Dados)
- Confirme os dados coletados
- Gere e envie o contrato
- Objetivo: mover para CONTRACT_SENT

### CONTRACT_SENT (Contrato Enviado)
- Acompanhe se cliente recebeu e assinou
- Tire dúvidas sobre o contrato
- Objetivo: aguardar assinatura -> CONTRACT_SIGNED

### CONTRACT_SIGNED (Contrato Assinado)
- Parabenize pela contratação
- Solicite documentos necessários (checklist)
- Objetivo: mover para DOCS_PENDING

### DOCS_PENDING (Aguardando Documentos)
- Cobre documentos faltantes com gentileza
- Confirme recebimento de cada documento
- Objetivo: quando completo -> READY_FOR_LAWYER

### READY_FOR_LAWYER (Pronto para Advogado)
- Confirme que o processo está completo
- Informe que equipe jurídica irá analisar
- Não prometa prazos específicos

## ÁREAS DE ATUAÇÃO
- Direito Bancário (consignado, RMC/RCC, seguros, tarifas, juros)
- Direito Aéreo (atrasos, cancelamentos, overbooking)

Para outras áreas, informe educadamente que o escritório não atua.',
  'Olá! Sou a Isa, assistente virtual do escritório Bentes & Ramos Advogados. Estou aqui para ajudar com seu atendimento. Posso fazer algumas perguntas rápidas para entender melhor sua situação?',
  true,
  1,
  'system'
) ON CONFLICT DO NOTHING;

-- Inserir configurações padrão para Z-API e FiqOn
INSERT INTO public.integrations_config (provider, config_json, is_active)
VALUES 
  ('zapi', '{"instance_id": "", "token": "", "webhook_secret": ""}', false),
  ('fiqon', '{"base_url": "", "api_key": "", "webhook_secret": ""}', false)
ON CONFLICT (provider) DO NOTHING;

-- Adicionar tabelas ao realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lead_state_history;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_prompts;
ALTER PUBLICATION supabase_realtime ADD TABLE integration_logs;