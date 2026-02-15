-- Add unique constraints for hash_unico on processo_movimentacoes and processo_partes
CREATE UNIQUE INDEX IF NOT EXISTS processo_movimentacoes_hash_unico_key ON processo_movimentacoes(hash_unico) WHERE hash_unico IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS processo_partes_hash_unico_key ON processo_partes(hash_unico) WHERE hash_unico IS NOT NULL;