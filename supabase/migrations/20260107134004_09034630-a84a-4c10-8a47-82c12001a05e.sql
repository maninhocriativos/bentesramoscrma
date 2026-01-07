-- Deletar log de lembrete anterior para permitir novo teste
DELETE FROM system_events 
WHERE entidade_id = '8c1c626e-473b-408c-82b8-963fa07f7ace' 
AND acao LIKE '%lembrete%';