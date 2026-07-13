-- Suporte ao sync de intimações/publicações do DJEN por processo (CNJ), não só
-- por OAB do advogado. Necessário porque o TJAM alimenta o DJEN nacionalmente
-- (confirmado: 10 mil+ comunicações/dia) mas não marca o advogado destinatário
-- de forma confiável — buscar por numeroOab nunca encontra nada do TJAM, mas
-- buscar por numeroProcesso funciona normalmente. Como já temos o CNJ de cada
-- processo cadastrado, dá pra contornar essa lacuna do TJAM sem depender de OAB.
alter table processos add column if not exists ultima_consulta_djen_at timestamptz;

create index if not exists idx_processos_ultima_consulta_djen
  on processos (ultima_consulta_djen_at)
  where status in ('Em Andamento', 'Suspenso');
