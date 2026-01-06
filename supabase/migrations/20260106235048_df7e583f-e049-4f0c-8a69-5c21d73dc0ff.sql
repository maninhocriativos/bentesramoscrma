-- Habilitar REPLICA IDENTITY FULL para realtime completo
ALTER TABLE manychat_mensagens REPLICA IDENTITY FULL;
ALTER TABLE manychat_subscribers REPLICA IDENTITY FULL;

-- Adicionar tabelas ao publication de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE manychat_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE manychat_subscribers;