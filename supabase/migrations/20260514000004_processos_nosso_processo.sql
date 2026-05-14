-- Coluna para marcar processos que são de responsabilidade do escritório
-- DEFAULT true: novos processos adicionados pelo CRM são automaticamente "nossos"
-- Processos trazidos do DataJud por CPF de outros escritórios podem ser marcados como false
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS nosso_processo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_processos_nosso ON public.processos(nosso_processo)
  WHERE nosso_processo = true;

COMMENT ON COLUMN public.processos.nosso_processo IS
  'true = processo sob responsabilidade do escritório Bentes & Ramos. false = processo de outro advogado encontrado via DataJud/CPF.';

-- Também muda o default de frequência para 30 dias
ALTER TABLE public.processos
  ALTER COLUMN frequencia_notificacao_dias SET DEFAULT 30;

-- Atualizar processos existentes que tinham 7 dias para 30 dias
UPDATE public.processos
  SET frequencia_notificacao_dias = 30
WHERE frequencia_notificacao_dias = 7;
