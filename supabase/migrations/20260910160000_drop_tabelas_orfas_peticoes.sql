-- Limpeza de tabelas 100% órfãs do módulo de Petições (auditoria 2026-09-10,
-- ver docs/HISTORICO.md). O motor de petições roda inteiramente no Worker
-- Cloudflare (D1 + R2) desde 27/08/2026 — nada em src/ referencia mais
-- nenhuma dessas 6 tabelas Postgres. Confirmado antes deste DROP:
--   - zero FK de fora deste grupo de 6 tabelas apontando pra elas;
--   - zero view dependente;
--   - petitions_v2/petition_models_v2/action_types/petition_versions já
--     estavam zeradas pela migration 20260827194802 (só o schema sobrou);
--   - modelos_peticao (34 linhas) e peticoes_geradas (1 linha) nunca tinham
--     sido nem citadas na limpeza de agosto — dado real, mas órfão de
--     verdade; exportado como backup local antes deste DROP (fora do repo).
DROP TABLE IF EXISTS petition_versions;
DROP TABLE IF EXISTS petitions_v2;
DROP TABLE IF EXISTS petition_models_v2;
DROP TABLE IF EXISTS action_types;
DROP TABLE IF EXISTS peticoes_geradas;
DROP TABLE IF EXISTS modelos_peticao;
