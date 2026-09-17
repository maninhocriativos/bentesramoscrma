-- Auditoria geral (2026-09-17): "Direcionar conversa pra colega" (menu de
-- atribuição no Chat Interno) está gravando em manychat_subscribers.assigned_to
-- — coluna que nunca existiu no banco. Toda tentativa de uso falha com
-- "Não foi possível direcionar a conversa" (erro do PostgREST por coluna
-- inexistente, capturado e mostrado como toast genérico). Achado via
-- typecheck (npx tsc --noEmit -p tsconfig.app.json), confirmado no schema
-- real antes de corrigir.
--
-- Mesmo tipo (uuid) e mesma convenção de attending_by/last_attended_by
-- (sem FK explícita) — assigned_to representa "designado pra atender",
-- conceito separado de attending_by ("atendendo agora mesmo").

ALTER TABLE public.manychat_subscribers ADD COLUMN IF NOT EXISTS assigned_to uuid;
