-- leads_juridicos.created_at não tinha índice — toda paginação de useLeads.ts
-- (ORDER BY created_at DESC) fazia Seq Scan + sort em memória a cada página.
-- Rápido hoje (tabela pequena, ~3.6k linhas), mas cresce sem limite; barato
-- de adicionar agora. Achado investigando lentidão geral relatada pelo
-- usuário (não era a causa principal — essa foi o Seq Scan em
-- manychat_mensagens.metadata->>message_id, corrigido em commit separado —
-- mas a variância enorme dessa query no pg_stat_statements sugere que ela
-- também sofria com a contenção causada por aquele outro bug).
CREATE INDEX IF NOT EXISTS idx_leads_juridicos_created_at ON public.leads_juridicos (created_at DESC);
