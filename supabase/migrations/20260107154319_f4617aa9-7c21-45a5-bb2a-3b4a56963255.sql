-- Corrigir o horário do compromisso da Janira de hoje
-- O compromisso é às 17h de Manaus = 21h UTC
UPDATE compromissos 
SET data_inicio = '2026-01-07 21:00:00+00'
WHERE id = '35ef6203-94c6-40dc-a47a-f09dbef3ff7d';

-- Deletar compromissos duplicados para amanhã (08/01) - manter apenas o primeiro
DELETE FROM compromissos 
WHERE id IN ('31e4de55-1396-4064-ac6d-5a7170b56b58', '32585957-c532-4e69-a34c-a1da68e5993b')
AND lead_id = '159269a2-ca79-4fb1-bf1e-8a7673aaf948';