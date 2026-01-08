-- Corrigir nomes e telefones com colchetes nos subscribers
UPDATE manychat_subscribers 
SET 
  nome = CASE 
    WHEN nome LIKE '[%]' THEN TRIM(BOTH FROM REPLACE(REPLACE(nome, '[', ''), ']', ''))
    ELSE nome 
  END,
  telefone = CASE 
    WHEN telefone LIKE '[%]' OR telefone LIKE '{{%}}' THEN TRIM(BOTH FROM REPLACE(REPLACE(REPLACE(REPLACE(telefone, '[', ''), ']', ''), '{{', ''), '}}', ''))
    ELSE telefone 
  END,
  canal = CASE 
    WHEN REPLACE(REPLACE(telefone, '[', ''), ']', '') ~ '^55[0-9]{10,11}$' THEN 'whatsapp'
    ELSE canal 
  END,
  updated_at = NOW()
WHERE nome LIKE '[%' OR telefone LIKE '[%' OR telefone LIKE '{{%}}';

-- Corrigir canal para contatos com telefone brasileiro que estão como facebook
UPDATE manychat_subscribers 
SET canal = 'whatsapp', updated_at = NOW()
WHERE canal = 'facebook' 
  AND telefone IS NOT NULL 
  AND telefone ~ '^55[0-9]{10,11}$';