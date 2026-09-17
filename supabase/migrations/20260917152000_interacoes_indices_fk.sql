-- Auditoria geral (2026-09-17): interacoes.cliente_id e interacoes.processo_id
-- são foreign keys sem índice — confirmado em pg_stat_statements com
-- consultas reais custando tempo nelas (WHERE processo_id = X, WHERE
-- cliente_id = ANY(...)). Não é o mesmo bug da metadata->>chave (aqui é
-- índice de coluna simples faltando mesmo, não problema de JSONB).
--
-- Existem ~44 outras colunas de FK sem índice no banco (processos.cliente_id,
-- honorarios.processo_id, tarefas.processo_id, etc.) — deixadas de fora
-- desta migration de propósito: sem evidência direta de consulta lenta
-- nelas hoje, adicionar índice tem custo real (escrita mais lenta, espaço)
-- e não compensa sem prova. Só essas duas têm prova concreta.

CREATE INDEX IF NOT EXISTS idx_interacoes_processo_id ON public.interacoes (processo_id) WHERE processo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interacoes_cliente_id ON public.interacoes (cliente_id) WHERE cliente_id IS NOT NULL;
