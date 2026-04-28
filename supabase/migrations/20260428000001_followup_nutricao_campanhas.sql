-- ============================================================
-- Follow-up Nutrição e Campanhas
-- ============================================================

-- Tabela: opt-in de nutrição (após 3 follow-ups sem resposta)
CREATE TABLE IF NOT EXISTS followup_nutricao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   text NOT NULL,
  lead_id         uuid REFERENCES leads_juridicos(id) ON DELETE CASCADE,
  telefone        text NOT NULL,
  status          text NOT NULL DEFAULT 'pendente',  -- pendente | aceito | recusado
  optin_enviado_em timestamptz DEFAULT now(),
  resposta_em      timestamptz,
  ultima_campanha_id uuid,
  ultima_campanha_em timestamptz,
  proxima_campanha_em timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_followup_nutricao_status   ON followup_nutricao(status);
CREATE INDEX IF NOT EXISTS idx_followup_nutricao_telefone ON followup_nutricao(telefone);
CREATE INDEX IF NOT EXISTS idx_followup_nutricao_proxima  ON followup_nutricao(proxima_campanha_em) WHERE status = 'aceito';

ALTER TABLE followup_nutricao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view followup_nutricao"   ON followup_nutricao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert followup_nutricao" ON followup_nutricao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update followup_nutricao" ON followup_nutricao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role all nutricao"     ON followup_nutricao FOR ALL TO service_role USING (true);

-- Tabela: mensagens de campanha de nutrição
CREATE TABLE IF NOT EXISTS followup_campanhas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text NOT NULL,
  mensagem     text,
  tipo_midia   text NOT NULL DEFAULT 'text',  -- text | image | audio | video | document
  media_url    text,
  media_nome   text,
  legenda      text,    -- caption para imagem/vídeo
  ordem        integer NOT NULL DEFAULT 0,
  ativo        boolean NOT NULL DEFAULT true,
  intervalo_dias integer NOT NULL DEFAULT 7,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_campanhas_ordem ON followup_campanhas(ordem) WHERE ativo = true;

ALTER TABLE followup_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all followup_campanhas" ON followup_campanhas FOR ALL TO authenticated USING (true);
CREATE POLICY "Service role all campanhas"  ON followup_campanhas FOR ALL TO service_role  USING (true);

-- Storage bucket para mídias de campanha
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'followup-campanhas',
  'followup-campanhas',
  true,
  52428800,  -- 50 MB
  ARRAY['image/*','audio/*','video/*','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public read followup-campanhas') THEN
    CREATE POLICY "Public read followup-campanhas" ON storage.objects
      FOR SELECT USING (bucket_id = 'followup-campanhas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth upload followup-campanhas') THEN
    CREATE POLICY "Auth upload followup-campanhas" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'followup-campanhas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth update followup-campanhas') THEN
    CREATE POLICY "Auth update followup-campanhas" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'followup-campanhas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth delete followup-campanhas') THEN
    CREATE POLICY "Auth delete followup-campanhas" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'followup-campanhas');
  END IF;
END $$;
