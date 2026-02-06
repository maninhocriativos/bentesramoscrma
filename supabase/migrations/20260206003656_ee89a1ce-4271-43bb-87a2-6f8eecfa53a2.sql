-- =====================================================
-- ADICIONAR CAMPOS FALTANTES PARA ANTI-DUPLICAÇÃO
-- =====================================================

-- 1) Adicionar hash_unico e origem na tabela processo_movimentacoes
ALTER TABLE public.processo_movimentacoes
ADD COLUMN IF NOT EXISTS hash_unico text,
ADD COLUMN IF NOT EXISTS origem text DEFAULT 'escavador';

-- Atualizar movimentações existentes com hash (sintaxe corrigida)
UPDATE public.processo_movimentacoes m
SET hash_unico = encode(
  digest(
    COALESCE(p.numero_processo, '') || '|' || 
    COALESCE(to_char(m.data_movimento, 'YYYY-MM-DD HH24:MI'), '') || '|' || 
    COALESCE(lower(trim(m.movimento_titulo)), '') || '|' || 
    COALESCE(lower(trim(m.movimento_descricao)), ''),
    'sha1'
  ),
  'hex'
)
FROM public.processos p
WHERE p.id = m.processo_id
AND m.hash_unico IS NULL;

-- Criar índice único anti-duplicação
DROP INDEX IF EXISTS processo_movimentacoes_hash_idx;
CREATE UNIQUE INDEX processo_movimentacoes_hash_idx ON public.processo_movimentacoes (hash_unico) WHERE hash_unico IS NOT NULL;

-- 2) Criar tabela de partes do processo se não existir
CREATE TABLE IF NOT EXISTS public.processo_partes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nome text NOT NULL,
  polo text,
  tipo_pessoa text,
  documento text,
  advogados jsonb,
  hash_unico text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS processo_partes_hash_idx;
CREATE UNIQUE INDEX processo_partes_hash_idx ON public.processo_partes (hash_unico) WHERE hash_unico IS NOT NULL;
CREATE INDEX IF NOT EXISTS processo_partes_processo_idx ON public.processo_partes (processo_id);

ALTER TABLE public.processo_partes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View processo partes" ON public.processo_partes;
CREATE POLICY "View processo partes" ON public.processo_partes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Insert processo partes" ON public.processo_partes;
CREATE POLICY "Insert processo partes" ON public.processo_partes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Delete processo partes" ON public.processo_partes;
CREATE POLICY "Delete processo partes" ON public.processo_partes
  FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- 3) Criar tabela de logs de sincronização
CREATE TABLE IF NOT EXISTS public.processo_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  cnj text,
  origem_tentada text NOT NULL,
  status text NOT NULL,
  http_code integer,
  mensagem text,
  duracao_ms integer,
  movimentacoes_novas integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processo_sync_log_processo_idx ON public.processo_sync_log (processo_id);
CREATE INDEX IF NOT EXISTS processo_sync_log_created_idx ON public.processo_sync_log (created_at DESC);

ALTER TABLE public.processo_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View sync logs" ON public.processo_sync_log;
CREATE POLICY "View sync logs" ON public.processo_sync_log
  FOR SELECT USING (has_role(auth.uid(), 'Administrador') OR has_role(auth.uid(), 'Gerente'));

DROP POLICY IF EXISTS "Insert sync logs" ON public.processo_sync_log;
CREATE POLICY "Insert sync logs" ON public.processo_sync_log
  FOR INSERT WITH CHECK (true);

-- 4) Funções para gerar hash único
CREATE OR REPLACE FUNCTION public.gerar_hash_movimentacao(
  p_cnj text,
  p_data timestamp with time zone,
  p_titulo text,
  p_descricao text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  normalized_desc text;
BEGIN
  normalized_desc := COALESCE(lower(trim(regexp_replace(p_descricao, '\s+', ' ', 'g'))), '');
  
  RETURN encode(
    digest(
      COALESCE(p_cnj, '') || '|' || 
      COALESCE(to_char(p_data, 'YYYY-MM-DD HH24:MI'), '') || '|' || 
      COALESCE(lower(trim(p_titulo)), '') || '|' || 
      normalized_desc,
      'sha1'
    ),
    'hex'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_hash_parte(
  p_processo_id uuid,
  p_tipo text,
  p_nome text,
  p_documento text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN encode(
    digest(
      COALESCE(p_processo_id::text, '') || '|' || 
      COALESCE(lower(trim(p_tipo)), '') || '|' || 
      COALESCE(lower(trim(p_nome)), '') || '|' || 
      COALESCE(p_documento, ''),
      'sha1'
    ),
    'hex'
  );
END;
$$;