# CRM Bentes Ramos — instruções para agentes

Antes de commitar, pushar ou deployar, leia:

- [docs/GUIA_DEPLOY_E_GIT.md](docs/GUIA_DEPLOY_E_GIT.md) — como o deploy funciona
  (push pra `main` = deploy automático via Netlify + GitHub Actions), o que nunca
  commitar, como aplicar migration, credenciais, armadilhas de shell.
- [docs/HISTORICO.md](docs/HISTORICO.md) — tudo que já foi feito no sistema, pendências
  abertas e decisões de produto que não devem ser revertidas sem o usuário.

Resumo das regras:
1. Deploy é `git push origin main`. Não rode `supabase db push` / `functions deploy` local.
2. Migration nova: mostre o SQL ao usuário antes do push.
3. `git add` só dos seus arquivos (há WIP alheio na working tree). Nunca `git add -A`.
4. Credenciais em `docs/SECRETS.local.md` (gitignored). Nunca cole valores no chat.
5. Verifique ao vivo (`gh run list`, SQL, logs) antes de dizer "pronto".
6. Commits em português; ao terminar, registre a sessão em `docs/HISTORICO.md`.
