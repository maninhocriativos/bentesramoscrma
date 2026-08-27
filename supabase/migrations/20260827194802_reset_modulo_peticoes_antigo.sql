-- Reset completo do módulo antigo de Petições (Supabase). O fluxo passou a
-- rodar 100% no backend novo (Cloudflare Worker + D1 + R2, ver
-- src/lib/peticoesV2Client.ts e o repo peticoes-cloudflare) — as rotas
-- /peticoes* do CRM não usam mais essas tabelas. Modelos serão recadastrados
-- do zero via a ferramenta de upload nova.

-- Os arquivos do bucket de storage (peticoes-modelos) são limpos à parte,
-- via Storage API/CLI — o Supabase bloqueia DELETE direto em storage.objects
-- por SQL (SQLSTATE 42501).

-- Dados (ordem respeita as foreign keys: versions -> petitions -> models/action_types)
delete from public.petition_versions;
delete from public.petitions_v2;
delete from public.petition_models_v2;
delete from public.action_types;
