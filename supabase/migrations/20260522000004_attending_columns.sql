-- Rastreia qual usuário está atendendo cada conversa no momento
-- attending_since permite expirar visualmente após 15 min de inatividade
ALTER TABLE manychat_subscribers
  ADD COLUMN IF NOT EXISTS attending_by   uuid,
  ADD COLUMN IF NOT EXISTS attending_nome text,
  ADD COLUMN IF NOT EXISTS attending_since timestamptz;
