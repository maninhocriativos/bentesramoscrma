-- Os dois backups diários (03:00 UTC) estavam travando TODA noite sem
-- terminar, mas o pg_cron reportava "sucesso" porque só confirma que a
-- chamada HTTP foi enviada, não que a function terminou. Confirmado nos logs:
--
-- backup-chat-drive: "Memory limit exceeded" — tenta rebaixar a tabela
-- INTEIRA de mensagens (58962 linhas e crescendo) pra memória toda noite,
-- monta JSON+CSV completos. Sem incremento nenhum: é dia após dia mais lento
-- e vai continuar travando pra sempre, cada vez pior. Além disso é redundante
-- com o backup-mensagens-drive, que já cobre TODAS as mensagens das últimas
-- 24h (csv diário completo + pastas por lead) de forma incremental.
--
-- backup-mensagens-drive: "CPU Time exceeded" — bug separado (corrigido no
-- código: codificação base64 de mídia sem dividir em pedaços), não o volume
-- de dados. Mantido como o backup diário de verdade.
--
-- Decisão: desativa o cron do backup-chat-drive (função continua disponível
-- pra rodar manualmente sob demanda, se precisar de um dump completo pontual
-- num formato diferente). O backup-mensagens-drive continua sendo o backup
-- automático diário — pasta configurada em GOOGLE_DRIVE_FOLDER_ID.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backup-chat-drive-daily') THEN
    PERFORM cron.unschedule('backup-chat-drive-daily');
  END IF;
END;
$$;
