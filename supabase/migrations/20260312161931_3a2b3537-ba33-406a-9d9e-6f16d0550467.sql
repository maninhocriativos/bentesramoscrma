
-- Add OAB fields to perfis table
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS oab_numero text;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS oab_uf text DEFAULT 'AM';

-- Create intimacoes table to cache fetched intimações
CREATE TABLE IF NOT EXISTS public.intimacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advogado_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  oab_numero text NOT NULL,
  oab_uf text NOT NULL DEFAULT 'AM',
  processo_cnj text,
  processo_titulo text,
  tribunal text,
  tipo_intimacao text,
  conteudo text,
  data_intimacao timestamp with time zone,
  data_disponibilizacao timestamp with time zone,
  fonte text DEFAULT 'escavador',
  lida boolean DEFAULT false,
  lida_em timestamp with time zone,
  raw_json jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS for intimacoes
ALTER TABLE public.intimacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intimacoes" ON public.intimacoes
  FOR SELECT TO authenticated
  USING (advogado_id = auth.uid() OR has_role(auth.uid(), 'Administrador'::app_role) OR has_role(auth.uid(), 'Gerente'::app_role));

CREATE POLICY "System can insert intimacoes" ON public.intimacoes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own intimacoes" ON public.intimacoes
  FOR UPDATE TO authenticated
  USING (advogado_id = auth.uid() OR has_role(auth.uid(), 'Administrador'::app_role));

-- Add sync tracking columns to processos for optimized sync
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS sync_priority text DEFAULT 'normal';
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS sync_error_count integer DEFAULT 0;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS last_sync_error text;
