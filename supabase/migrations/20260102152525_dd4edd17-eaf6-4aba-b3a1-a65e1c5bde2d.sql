-- Corrigir tipos de mensagens existentes baseado na URL do conteúdo
UPDATE manychat_mensagens
SET tipo = 'audio'
WHERE tipo = 'text' 
  AND (conteudo ILIKE '%.ogg%' OR conteudo ILIKE '%.mp3%' OR conteudo ILIKE '%.wav%' OR conteudo ILIKE '%.m4a%');

UPDATE manychat_mensagens
SET tipo = 'image'
WHERE tipo = 'text' 
  AND (conteudo ILIKE '%.jpg%' OR conteudo ILIKE '%.jpeg%' OR conteudo ILIKE '%.png%' OR conteudo ILIKE '%.gif%' OR conteudo ILIKE '%.webp%');

UPDATE manychat_mensagens
SET tipo = 'video'
WHERE tipo = 'text' 
  AND (conteudo ILIKE '%.mp4%' OR conteudo ILIKE '%.webm%' OR conteudo ILIKE '%.mov%');