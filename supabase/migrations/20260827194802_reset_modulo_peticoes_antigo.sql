-- Reset completo do módulo antigo de Petições (Supabase). O fluxo passou a
-- rodar 100% no backend novo (Cloudflare Worker + D1 + R2, ver
-- src/lib/peticoesV2Client.ts e o repo peticoes-cloudflare) — as rotas
-- /peticoes* do CRM não usam mais essas tabelas. Modelos serão recadastrados
-- do zero via a ferramenta de upload nova.

-- Arquivos do bucket de storage (templates e petições geradas em .docx/.pdf)
delete from storage.objects where bucket_id = 'peticoes-modelos';

-- Dados (ordem respeita as foreign keys: versions -> petitions -> models/action_types)
delete from public.petition_versions;
delete from public.petitions_v2;
delete from public.petition_models_v2;
delete from public.action_types;
