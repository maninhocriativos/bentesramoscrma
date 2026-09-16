-- Backup em background dos anexos do chat (documento/foto/áudio/vídeo) pra
-- um armazenamento secundário (Cloudflare R2, Worker chat-storage) — pedido
-- do usuário por redundância. Essa coluna só marca o que já foi copiado; o
-- CRM continua lendo/exibindo tudo do Supabase Storage normalmente, nada no
-- caminho ao vivo do chat muda. Ver docs/SECRETS.local.md §2.8.

ALTER TABLE public.manychat_mensagens ADD COLUMN r2_backup_key text NULL;

-- Ajuda a consulta do job de backup (roda em lotes, a cada 15-30min) a achar
-- rápido só as mensagens de mídia ainda não copiadas, sem escanear a tabela
-- inteira a cada rodada.
CREATE INDEX idx_manychat_mensagens_backup_pendente
  ON public.manychat_mensagens (tipo, created_at)
  WHERE r2_backup_key IS NULL AND tipo IN ('image', 'audio', 'document', 'video');
