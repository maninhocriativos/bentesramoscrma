-- Corrigir leads com status inválidos
-- "Lead Morno" e "Lead Quente" são status antigos que devem ser "Em Atendimento"
UPDATE leads_juridicos 
SET status = 'Em Atendimento', updated_at = now()
WHERE status IN ('Lead Morno', 'Lead Quente');

-- Garantir que todos os leads tenham um status válido
-- Atualizar qualquer lead com status NULL ou vazio para 'Lead Frio'
UPDATE leads_juridicos 
SET status = 'Lead Frio', updated_at = now()
WHERE status IS NULL OR status = '';