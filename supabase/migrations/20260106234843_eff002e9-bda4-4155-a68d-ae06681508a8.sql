-- Corrigir canal para WhatsApp onde tem telefone brasileiro (55...)
UPDATE manychat_subscribers 
SET canal = 'whatsapp', updated_at = now()
WHERE telefone LIKE '55%' AND canal != 'whatsapp';

-- Corrigir canal dos leads_juridicos onde a origem é ManyChat mas telefone é brasileiro
UPDATE leads_juridicos 
SET origem = 'WhatsApp', updated_at = now()
WHERE origem IN ('ManyChat', 'Facebook') 
AND telefone LIKE '55%';