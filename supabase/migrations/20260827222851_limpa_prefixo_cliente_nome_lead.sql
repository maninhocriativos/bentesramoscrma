-- A equipe salva alguns contatos no WhatsApp Business com um prefixo de
-- organização interna (ex.: "Cliente - Maria Barbosa Pereira"), e a Z-API
-- devolve esse nome de contato salvo como pushName. O webhook (zapi-webhook)
-- gravava isso direto como nome do lead — corrigido em código nesta mesma
-- entrega pra sanitizar na origem (ver _shared/zapi-helper.ts,
-- sanitizarNomeContato) — esta migration limpa os 79 registros já afetados.
--
-- Esse prefixo quebrava também o vínculo automático de processos por nome
-- (useLeadProcessos.ts): a busca procurava pelo nome COM o prefixo, que
-- nunca bate com o nome real da parte no processo.
update public.leads_juridicos
set nome = regexp_replace(nome, '^\s*(cliente|contato|lead|cli)\s*[-:–—]\s*', '', 'i'),
    updated_at = now()
where nome ~* '^\s*(cliente|contato|lead|cli)\s*[-:–—]\s*';
