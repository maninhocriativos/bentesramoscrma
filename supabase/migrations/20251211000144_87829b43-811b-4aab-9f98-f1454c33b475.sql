-- Criar bucket para extratos bancários
INSERT INTO storage.buckets (id, name, public)
VALUES ('extratos-bancarios', 'extratos-bancarios', false);

-- Políticas RLS para o bucket de extratos
CREATE POLICY "Usuários autenticados podem fazer upload de extratos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'extratos-bancarios' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem ver seus extratos"
ON storage.objects FOR SELECT
USING (bucket_id = 'extratos-bancarios' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar seus extratos"
ON storage.objects FOR DELETE
USING (bucket_id = 'extratos-bancarios' AND auth.role() = 'authenticated');