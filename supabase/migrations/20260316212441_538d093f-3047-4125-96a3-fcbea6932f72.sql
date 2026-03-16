INSERT INTO notificacoes_internas (user_id, titulo, mensagem, tipo, lida, link, dados)
VALUES (
  '5c775450-665f-4f43-99cb-efb6167d4e20',
  '33 intimações não lidas',
  'Você possui 33 intimações/movimentações pendentes de leitura nos seus processos. Acesse para verificar prazos.',
  'alerta',
  false,
  '/intimacoes',
  '{"source": "intimacoes_oab", "count": 33}'::jsonb
);