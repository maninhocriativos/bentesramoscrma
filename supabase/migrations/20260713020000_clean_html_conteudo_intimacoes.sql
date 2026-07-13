-- As publicações do DJEN às vezes vêm como HTML bruto (documento inteiro com
-- DOCTYPE/head/style) em "texto"; o codigo de captura (intimacoes-oab) ja foi
-- corrigido pra limpar isso em itens novos, mas os ja salvos ficaram sujos.
-- Limpeza pontual (regex equivalente ao stripHtml do codigo) sobre os
-- registros existentes com HTML detectavel; inofensiva em conteudo ja limpo.
update intimacoes
set conteudo = trim(regexp_replace(
      regexp_replace(
        regexp_replace(conteudo, '<script[^>]*>.*?</script>', ' ', 'gis'),
        '<style[^>]*>.*?</style>', ' ', 'gis'
      ),
      '<[^>]+>', ' ', 'g'
    ))
where conteudo ~ '<[a-zA-Z][^>]*>';

update intimacoes
set conteudo = trim(regexp_replace(
      replace(replace(replace(conteudo, '&nbsp;', ' '), '&amp;', '&'), '&lt;', '<'),
      '\s+', ' ', 'g'
    ))
where conteudo like '%&nbsp;%' or conteudo like '%&amp;%' or conteudo like '%&lt;%';
