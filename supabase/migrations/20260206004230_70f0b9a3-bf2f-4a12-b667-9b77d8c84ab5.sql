-- Adicionar colunas faltantes na tabela processos
ALTER TABLE public.processos
ADD COLUMN IF NOT EXISTS cnj_normalizado text,
ADD COLUMN IF NOT EXISTS fonte_preferida text DEFAULT 'datajud',
ADD COLUMN IF NOT EXISTS cache_valid_until timestamp with time zone;

-- Criar índice para busca rápida por CNJ normalizado
CREATE INDEX IF NOT EXISTS processos_cnj_normalizado_idx ON public.processos (cnj_normalizado);

-- Preencher cnj_normalizado para registros existentes (remove pontuação)
UPDATE public.processos
SET cnj_normalizado = regexp_replace(numero_processo, '[^0-9]', '', 'g')
WHERE cnj_normalizado IS NULL AND numero_processo IS NOT NULL;