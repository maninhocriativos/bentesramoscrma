-- Drop partial indexes and create proper unique constraints
DROP INDEX IF EXISTS processo_movimentacoes_hash_unico_key;
DROP INDEX IF EXISTS processo_movimentacoes_hash_idx;
DROP INDEX IF EXISTS processo_partes_hash_unico_key;
DROP INDEX IF EXISTS processo_partes_hash_idx;

-- Create non-partial unique indexes
ALTER TABLE processo_movimentacoes ADD CONSTRAINT processo_movimentacoes_hash_unico_unique UNIQUE (hash_unico);
ALTER TABLE processo_partes ADD CONSTRAINT processo_partes_hash_unico_unique UNIQUE (hash_unico);