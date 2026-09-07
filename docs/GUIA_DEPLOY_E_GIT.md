# Guia de commit, push e deploy — CRM Bentes Ramos

> **Para quem é:** qualquer agente (Claude Code, Codex, Cursor, humano) que for mexer neste
> workspace. Leia este arquivo ANTES de commitar, pushar ou deployar qualquer coisa.
> O histórico de tudo que já foi feito no sistema está em [HISTORICO.md](HISTORICO.md).
>
> Atualizado em 2026-09-07. Se algo aqui estiver diferente do que você encontrar no
> repositório, o repositório vence — e corrija este guia no mesmo commit.

---

## 1. Mapa do workspace

A pasta `D:\crm-bentes_ramos` **não é um repositório git válido** (a `.git` da raiz tem só
uma subpasta `info` vazia — resquício). Os projetos reais são quatro subpastas, cada uma
com seu próprio git:

| Pasta | O que é | Remoto GitHub | Deploy |
|---|---|---|---|
| `bentesramoscrma/` | **CRM principal** (frontend + Supabase) | `maninhocriativos/bentesramoscrma` | Automático no push pra `main` (seção 3) |
| `peticoes-cloudflare/` | Worker Cloudflare: motor de petições/contratos (D1 + R2) | **nenhum** (só git local) | Manual, `wrangler deploy` (seção 4) |
| `peticoes-modelos-admin/` | Site admin (Vite+React) pra cadastrar modelos `.docx` | **nenhum** (só git local) | Manual, `npm run deploy` (seção 4) |
| `portal-cliente/` | Worker Cloudflare: Área do Cliente (D1 + SPA em assets) | **nenhum** (só git local) | Manual, `wrangler deploy` (seção 4) |

Outros itens da raiz (`audlogs.json`, `disc.json`, `supabase/` vazio, `.agents/` vazio)
são sobras sem função. Ignore.

**Sempre rode `git` de dentro da subpasta certa.** Rodar na raiz dá
`fatal: not a git repository`.

---

## 2. Regras de ouro (checklist de 30 segundos)

1. **Deploy do CRM é `git push origin main`.** Não rode `supabase db push`,
   `supabase functions deploy` nem `netlify deploy` localmente — o GitHub Actions e o
   Netlify fazem isso sozinhos no push. (O Claude Code em auto-mode bloqueia esses comandos
   de qualquer forma.)
2. **Migration nova = mostrar o SQL pro usuário antes de pushar.** Ele pediu isso
   explicitamente depois de "uma otimização quebrou o chat inteiro". Ensaie no banco de
   produção com `begin; ...; rollback;` quando for DDL/UPDATE em massa (seção 3.4).
3. **Só commite o que você mudou.** Este repo vive com WIP alheio na working tree
   (hoje: `src/pages/HistoricoAtendimentoPage.tsx`). Use `git add <arquivo>` explícito,
   nunca `git add -A` ou `git add .`.
4. **Nunca commite:** `docs/SECRETS.local.md`, `public/templates-novos/` (petições reais
   com dados pessoais de clientes), `scratch_*.cjs`, `supabase/.temp/`, `.env*`.
5. **Credenciais ficam em `bentesramoscrma/docs/SECRETS.local.md`.** Leia esse arquivo
   antes de dizer "não tenho acesso a X". Nunca cole o valor de um secret no chat, em
   log ou em commit.
6. **Verifique ao vivo antes de dizer "pronto".** `gh run list` pra ver o workflow, SQL
   de leitura ou log da edge function pra confirmar o efeito real. "O código parece
   certo" não conta como verificação neste projeto.
7. **Commits em português (pt-BR)**, prefixo `feat|fix|chore|perf|refactor(escopo): ...`,
   e a linha `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` quando for o Claude.
8. **Registre o que fez** ao final: acrescente uma entrada em [HISTORICO.md](HISTORICO.md)
   (seção "Linha do tempo") no mesmo commit da mudança, ou no commit seguinte.

---

## 3. Repositório principal: `bentesramoscrma/`

### 3.1 Stack e endereços

- Frontend: Vite + React 18 + TypeScript + shadcn/ui + Tailwind, PWA.
  Hospedado no **Netlify** — produção em `https://bentesramoscrm.com.br`
  (site Netlify `bentesramoscrm.netlify.app`). Rewrite SPA em `public/_redirects`.
- Backend: **Supabase**, project ref `qgenaltkjtlvwfgykpxq`
  (Postgres + Auth + Storage + Realtime + 81 Edge Functions em Deno + pg_cron).
- Branch única: `main`. Não há branches de feature em uso; commits vão direto na `main`.
- Identidade git (config local do repo, já configurada): `maninhocriativos` /
  `maninhocriativos@gmail.com`.
- `gh` CLI já está autenticado como `maninhocriativos` nesta máquina.

### 3.2 O que dispara o quê no push pra `main`

| Caminho alterado | Quem reage | O que acontece |
|---|---|---|
| Qualquer arquivo | **Netlify** (integração direta com o GitHub, sem workflow) | `npm run build` e publica o frontend. Leva 1–3 min. |
| `supabase/migrations/**` | `.github/workflows/deploy-migrations.yml` | `supabase link` + `supabase db push --linked`. Aplica só as migrations ainda não registradas no histórico do Supabase. |
| `supabase/functions/**` | `.github/workflows/deploy.yml` | Faz deploy de **todas** as funções em `supabase/functions/*` (exceto `_shared`), uma a uma. |
| Os próprios `.yml` acima | O mesmo workflow | Reexecuta. |

Secret usado pelos workflows (configurado no GitHub, não no repo): `SUPABASE_ACCESS_TOKEN`.

Workflows agendados (não dependem de push, só chamam edge functions via `curl`):

| Workflow | Cron | Chama |
|---|---|---|
| `processo-auto-sync.yml` | a cada 15 min | `processo-auto-sync` (movimentações via DataJud) |
| `processo-djen-sync.yml` | a cada 20 min | `processo-djen-sync` (intimações DJEN por CNJ) |
| `traffic-followup-automation.yml` | 30 em 30 min, dias úteis 9h–18h Manaus | `traffic-followup-automation` |
| `intimacoes-auto-sync.yml` | só manual (`workflow_dispatch`) | `intimacoes-scheduler` — o agendamento real é via pg_cron (10h/16h/21h UTC) |

Além desses, há vários jobs **pg_cron** dentro do Postgres (Isa scheduler, lembretes,
backups, limpeza). Eles são criados/alterados por migration. Pra listar:
`select jobid, jobname, schedule, active from cron.job order by jobid;`

### 3.3 Fluxo padrão de uma mudança

```powershell
# 1. entre no repo certo
cd D:\crm-bentes_ramos\bentesramoscrma

# 2. veja o que já está sujo ANTES de mexer (pra não commitar WIP alheio)
git status

# 3. faça a mudança; valide localmente
npm run build          # obrigatório pra mudança de frontend
npx tsc --noEmit       # tipos
npm run lint           # eslint (há ~107 erros pré-existentes de no-explicit-any; não introduza novos)

# 4. adicione SÓ os seus arquivos
git add src/pages/Exemplo.tsx supabase/migrations/2026XXXXXXXXXX_descricao.sql

# 5. commit (mensagem longa: escreva num arquivo e use -F, o PowerShell não aceita heredoc)
git commit -m "fix(escopo): o que mudou, em português"

# 6. push = deploy
git push origin main

# 7. confirme que o deploy rodou
gh run list --limit 5
gh run watch            # acompanha o run em andamento
```

Se um workflow falhar: `gh run view <id> --log-failed`. Um push com migration quebrada
deixa o banco parcialmente aplicado — corrija com uma nova migration, nunca editando a
que já foi pushada.

### 3.4 Migrations (banco)

- Local: `supabase/migrations/`. Nome: `YYYYMMDDHHMMSS_descricao_curta.sql` (UTC).
  Existem 264 migrations; a mais recente em 2026-09-07 é
  `20260904150000_intimacoes_tarefas_duplicadas_merge.sql`.
- Escreva a migration idempotente quando possível (`if not exists`, `drop ... if exists`
  antes de recriar policy/trigger).
- **Antes de pushar**: mostre o SQL ao usuário. Se for DDL sensível ou UPDATE em massa,
  ensaie em produção dentro de uma transação com rollback:

  ```powershell
  # token em docs/SECRETS.local.md; exporte pra variável, nunca cole no comando
  $env:SUPABASE_ACCESS_TOKEN = "<valor do arquivo>"
  # escreva o SQL num arquivo com begin; ... ; rollback; e rode:
  supabase db query --linked -f ensaio.sql
  ```

- **Depois do push**: confirme com `gh run list --workflow=deploy-migrations.yml` E com
  uma consulta real (`pg_policies`, `pg_trigger`, `information_schema.columns`...).
  O push ter dado "success" não prova que a policy/trigger ficou como você queria.
- Coisas que já saíram do controle de migration (foram aplicadas direto no banco em
  algum momento): a check constraint `leads_juridicos_isa_agent_check`, alguns jobs
  pg_cron antigos, e uma atualização em massa de `contract_reminders` em 2026-04-11.
  Sempre consulte o estado vivo, não só o histórico de arquivos.
- Ajustes de runtime (pausar cron, `cron.alter_job`) podem ser feitos direto no banco
  com aprovação do usuário, mas registre no HISTORICO.md porque não ficam em migration.

### 3.5 Edge Functions (Supabase)

- Local: `supabase/functions/<nome>/index.ts`. Helpers compartilhados em
  `supabase/functions/_shared/` (`ai-helper.ts`, `site.ts`, `movimento-relevancia.ts`...).
- `supabase/config.toml` define `verify_jwt` por função. **57 funções têm
  `verify_jwt = false`** — são webhooks (Z-API, ClickSign, Meta, Instagram), crons e
  pontes internas. As que precisam de proteção usam header de secret compartilhado
  (`x-bridge-secret`, `PUSH_SEND_SECRET`, `ZAPI_WEBHOOK_SECRET`...). Função nova que
  não for webhook: deixe `verify_jwt = true` (padrão) ou proteja com secret.
- Secrets das funções ficam no painel do Supabase (Project Settings → Edge Functions →
  Secrets), **não** em `.env`. A lista de nomes e onde obter cada um está em
  `docs/SECRETS.local.md`. Depois de setar um secret, ele **não pode ser lido de volta**
  (write-only) — anote o valor no SECRETS.local.md na hora.
- Deploy: push pra `main` tocando `supabase/functions/**`. O workflow redeploya todas.
- Logs: não existe `supabase functions logs` nesta versão da CLI. Use a Management API:
  `GET https://api.supabase.com/v1/projects/qgenaltkjtlvwfgykpxq/analytics/endpoints/logs.all?sql=<SQL url-encoded>&iso_timestamp_start=<ISO>&iso_timestamp_end=<ISO>`
  consultando `function_logs` (campo `event_message`). Sem a janela de tempo explícita
  ele devolve quase nada.
- IA: `_shared/ai-helper.ts` usa OpenAI como primário (env `OPENAI_MODEL`, default
  `gpt-4o`). A Isa (`isa-auto-process`) usa **só OpenAI** desde 2026-08-17 (créditos
  Anthropic zeraram). Não reintroduza Anthropic sem falar com o usuário.

### 3.6 Frontend (Netlify)

- Variáveis `VITE_*` (`.env`, não commitado): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_VAPID_PUBLIC_KEY`.
  No Netlify elas ficam na UI do site (não há `netlify.toml` no repo).
- Asset que precisa existir após qualquer reinstall: `public/opus-recorder/encoderWorker.min.js`
  (copiado manualmente de `node_modules/opus-recorder/dist/`, não é gerado pelo build).
- Não há credencial de login de teste disponível pros agentes. Validação de UI
  autenticada tem que ser pedida ao usuário (smoke-test). O que dá pra fazer sozinho:
  `npm run build`, `tsc`, e Playwright contra rotas públicas (`/auth`) ou contra uma
  rota de preview temporária que você remove antes do commit.
- Bug de classe recorrente neste frontend: **PostgREST corta silenciosamente em ~1000
  linhas** qualquer `.select()` sem `.range()`. `.limit(5000)` NÃO resolve. Tabelas que
  passam disso: `leads_juridicos` (~3.3k), `processos` (~1k), `manychat_subscribers`
  (~2.8k), `intimacoes`, `traffic_followups`, `compromissos`, `system_events`. Use
  `src/lib/fetchAllPaginated.ts` ou o loop de `.range()` de `useCompromissos.ts`.

### 3.7 O que NÃO commitar (e o que já está sujo hoje)

Ignorados pelo `.gitignore`: `node_modules`, `dist`, `*.local`, `docs/SECRETS.local.md`,
`*.secrets.md`, `.env.local`, logs.

**Untracked de propósito, nunca adicionar**: `public/templates-novos/` (13 petições
reais com CPF/nome de clientes — matéria-prima da templatização), `scratch_*.cjs` (14
scripts de conversão de template), `err.log`. `docs/INTEGRACAO_INSTAGRAM.md` e
`docs/RELATORIO_CHAT.md` estão untracked mas podem ser commitados se fizer sentido.

**Versionado mas não deveria**: `supabase/.temp/*` (cache da CLI; aparece modificado a
cada `supabase link`). Não inclua no commit. Pendência: adicionar ao `.gitignore` e
`git rm --cached`.

**WIP em andamento (não é seu, não clobbere)**: `src/pages/HistoricoAtendimentoPage.tsx`
tem uma alteração não commitada desde 2026-08-21 (cálculo do tempo de espera a partir da
primeira mensagem de entrada real, em vez do `created_at` do subscriber). Se precisar
tocar esse arquivo, pergunte ao usuário antes.

---

## 4. Projetos Cloudflare (deploy manual)

Os três projetos usam **Wrangler 4** instalado localmente em cada `node_modules`
(não há wrangler global). Rode via `npx wrangler ...` ou pelos scripts do `package.json`.
Credenciais: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` em `docs/SECRETS.local.md`;
exporte como variáveis de ambiente antes de rodar (`$env:CLOUDFLARE_API_TOKEN = ...`).

**Não há CI.** Commit local não publica nada; só `wrangler deploy` publica. O usuário já
autorizou (2026-08-28) o Claude rodar `wrangler deploy` e `wrangler d1 migrations apply
--remote` diretamente quando a mudança estiver pronta e testada.

**Não há remoto no GitHub** em nenhum dos três (situação em 2026-09-07). Isso significa
que todo trabalho existe só neste disco. Pendência aberta: criar os repositórios e
fazer o primeiro push. Até lá, commite localmente com frequência.

### 4.1 `peticoes-cloudflare/` — Worker `peticoes-poc`

- URL: `https://peticoes-poc.bentesramos.workers.dev`
  (consumido pelo CRM em `src/lib/peticoesV2Client.ts` e pelo admin).
- Bindings (`wrangler.toml`): D1 `peticoes-db` (`64878607-...`), R2 `peticoes-templates`
  e `peticoes-geradas`.
- Secrets do Worker: `TOKEN_SECRET` (= `PETICOES_TOKEN_SECRET` no CRM),
  `PETICOES_OPENAI_API_KEY`, `ZAPSIGN_API_TOKEN` (pendente), JWT público do Supabase.
  Setar com `npx wrangler secret put NOME`.
- Migrations D1: `migrations/000N_*.sql`. Aplicar com
  `npx wrangler d1 migrations apply peticoes-db --remote` (ou `--local` pra dev).
  Em 2026-09-07 as migrations 0002 e 0003 existem no disco mas **não está confirmado**
  se foram aplicadas no D1 remoto — verifique com `npx wrangler d1 migrations list
  peticoes-db --remote` antes de deployar código que dependa delas.
- Testes: `node scripts/test-engine.ts`, `scripts/test-block-marking.ts`,
  `scripts/test-field-schema.ts` (Node 24 roda `.ts` direto). 32 checks; rode os três
  antes de qualquer deploy. `npx tsc --noEmit` também.
- Dev: `npm run dev` (wrangler dev, porta 8787).
- Deploy: `npm run deploy`.
- **WIP não commitado desde 2026-08-27** (396 linhas): blocos dinâmicos do motor
  (grupos repetíveis, condicionais, campos computados) — ver HISTORICO 2026-08-30.

### 4.2 `peticoes-modelos-admin/` — site admin

- URL: `https://peticoes-modelos-admin.bentesramos.workers.dev` (assets estáticos,
  SPA fallback). Fala com o Worker acima.
- Build: `npm run build` (`tsc -b && vite build`). Lint: `oxlint`.
- Deploy: `npm run deploy` (faz build + `wrangler deploy`).
- **WIP não commitado desde 2026-08-27**: `src/App.tsx`, `src/api.ts` (332 linhas) e
  o arquivo novo `src/blockMarking.ts` (nem foi `git add`). Mesmo projeto de blocos
  dinâmicos.

### 4.3 `portal-cliente/` — Área do Cliente

- URL: `https://portal-cliente.bentesramos.workers.dev` (domínio próprio ainda não
  decidido).
- Bindings: D1 `portal-cliente-db` (`4e5e57c1-...`); SPA em `frontend/dist` servida
  via `[assets]` com `run_worker_first = ["/api/*"]`.
- Fluxo de deploy (dois passos, o frontend é um Vite separado):
  ```powershell
  cd portal-cliente\frontend; npm run build
  cd ..; npm run deploy
  ```
- Migrations D1: `npm run d1:migrate:remote` (só existe a 0001).
- O Worker fala com o Supabase **só** via Edge Functions `cliente-portal-lookup` e
  `cliente-portal-data` (header `x-bridge-secret` = `CLIENTE_PORTAL_BRIDGE_SECRET`).
  Nunca dê a service_role key pro Worker.
- Secrets do Worker: `BRIDGE_SECRET`, `SESSION_JWT_SECRET`, `ESCRITORIO_WHATSAPP`
  (ainda com placeholder `0000000000000`).
- Working tree limpa em 2026-09-07.

---

## 5. Credenciais e ambiente da máquina

- **Cofre único**: `bentesramoscrma/docs/SECRETS.local.md` (gitignored). Contém
  Supabase (`SUPABASE_ACCESS_TOKEN`, `DB_PASSWORD`, service role), Cloudflare, OpenAI,
  Anthropic, Z-API, Meta/Instagram, Google, ClickSign, ZapSign, Resend, CloudConvert,
  VAPID, DataJud, secrets dos Workers. Algumas linhas são placeholders vazios com um
  comentário `# onde:` — ausência lá é lacuna real.
- **Como usar um secret sem vazar**: leia o arquivo, atribua a uma variável de ambiente
  no shell, referencie a variável. Nunca monte um comando cujo texto contenha o valor.
  Cuidado com `sed`/`grep` usando `&` no replacement (reinsere o match inteiro).
- **PATH no Bash tool não persiste** entre chamadas. Se `node`/`supabase`/`gh` não forem
  encontrados: `export PATH="/c/Program Files/nodejs:/c/Users/conta/AppData/Roaming/npm:/c/Program Files/GitHub CLI:$PATH"`.
  No PowerShell tool normalmente já estão no PATH.
- **Supabase CLI** (`npm -g`): `supabase link --project-ref qgenaltkjtlvwfgykpxq`,
  `supabase db query --linked -f arquivo.sql` funcionam só com `SUPABASE_ACCESS_TOKEN`.
  Use pra **leitura e ensaio** (`begin/rollback`). Não use pra aplicar migration —
  isso é do GitHub Actions.
- **GitHub API sem `gh`**: `git credential fill` devolve o token que o git já tem; a
  linha `password=` serve de Bearer pra `api.github.com`.
- **Chrome/Edge** existem em `C:\Program Files` pra Playwright (`channel: 'chrome'`).
- **Playwright** (`@playwright/test`, já em `package.json`) — o binário do Chromium
  está instalado no cache global da máquina (`C:\Users\conta\AppData\Local\ms-playwright`,
  fora do repo, não precisa reinstalar a cada sessão). Ver seção "Teste visual" abaixo
  pra como usar.
- **Node 24** (roda `.ts` direto com type-stripping). Supabase CLI e GitHub CLI via
  winget/npm.

### Armadilhas de shell já sofridas

- PowerShell 5.1: sem `&&`, sem heredoc bash, sem `??`. Mensagem de commit longa:
  escreva num arquivo e use `git commit -F arquivo`. SQL longo: arquivo + `-f`.
- Comando composto que seta `$env:Path` com `C:\Program Files` E roda `Remove-Item`
  é bloqueado pelo sandbox. Separe em duas chamadas.
- Git Bash mangla caminhos absolutos Windows passados pra `node -e`. Use caminhos
  relativos dentro do projeto.
- `taskkill /F /IM node.exe /T` mata TODOS os node da máquina (dev servers de outros
  projetos inclusive). Prefira matar pelo PID.
- Avisos `LF will be replaced by CRLF` são normais aqui; ignore.

---

## 6. Convenção de commits

- Idioma: **português**. Descreva o efeito pro usuário, não a técnica
  (`fix(chat): campo de mensagem vazava texto entre conversas ao trocar de cliente`).
- Prefixos usados: `feat`, `fix`, `chore`, `perf`, `refactor`, `ci`, `style`, `docs`.
  Escopo entre parênteses quando ajuda: `(intimacoes)`, `(tarefas)`, `(mobile)`,
  `(peticoes)`, `(isa)`, `(leads)`, `(db)`, `(cron)`.
- Um commit por assunto. Migration + código que depende dela vão **no mesmo commit**
  (os dois workflows disparam juntos).
- Rodapé quando o autor for o Claude:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Não faça `--amend`, `push --force` nem `rebase -i`. Reverta com `git revert`.
- Não commite/pushe sem o usuário ter pedido a mudança. Commitar documentação e
  correções que ele pediu é ok; abrir frente nova não.

---

## 7. Teste visual no navegador (Playwright)

Desde 2026-09-07 dá pra abrir o CRM de verdade num navegador headless e olhar o
resultado, em vez de confiar só em `tsc`/`build`. O Chromium do Playwright já está
instalado (cache global da máquina, fora do repo — não precisa `npx playwright
install` de novo; rode só se `npx playwright install --dry-run chromium` disser que
falta algo).

**Padrão de uso** — subir o dev server, navegar, tirar screenshot, olhar com o Read
tool (a imagem é lida diretamente, multimodal) e derrubar o servidor pelo PID certo:

```bash
# 1. Subir o dev server em background (porta 8080)
export PATH="/c/Program Files/nodejs:$PATH"
(npm run dev > /tmp/dev_server.log 2>&1 &)
sleep 6

# 2. Script de navegação (escrever dentro da pasta do projeto — import relativo
#    a node_modules só resolve rodando de lá, não do scratchpad)
cat > _pw_screenshot.mjs <<'EOF'
import { chromium } from 'playwright-core';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', m => logs.push(`[console:${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:8080/auth', { waitUntil: 'networkidle' });
await page.screenshot({ path: '<caminho absoluto no scratchpad>/screenshot.png' });
console.log('title=', await page.title());
console.log('LOGS:', JSON.stringify(logs));
await browser.close();
EOF
node _pw_screenshot.mjs
rm -f _pw_screenshot.mjs

# 3. Derrubar SÓ o dev server (nunca `taskkill /F /IM node.exe /T` — mata
#    todo processo Node da máquina, dev servers de outros projetos inclusive)
netstat -ano | grep ":8080" | grep LISTENING   # pega o PID da última coluna
taskkill //F //PID <PID>
```

Depois, ler o PNG gerado com o Read tool pra inspecionar visualmente.

**O que dá pra testar assim**: qualquer página pública (`/auth`, `/politica-privacidade`
etc.), erros de console/JS, layout responsivo (mude o `viewport`), e telas atrás de
login **desde que se crie uma rota de preview temporária** sem `RequireAuth` em
`App.tsx` — só fazer isso e **reverter antes de commitar** (`git diff App.tsx` tem
que voltar vazio). Foi assim que o casco mobile e o AppLayoutRoute foram
verificados visualmente antes (ver [[project_mobile_app_shell_20260829]] na memória).

**O que NÃO dá pra testar assim**: a aplicação autenticada de verdade — não há
credencial de login de teste neste ambiente. Pra confirmar uma mudança que só
aparece logado (ex.: um alerta na sidebar, um dado do Dashboard), a validação final
continua sendo pedir smoke-test ao usuário, como já era antes do Playwright — o
navegador headless reduz o que precisa de smoke-test, não elimina.

Playwright também tem `channel: 'chrome'`/`'msedge'` disponível (`playwright.config.ts`
já usa o projeto `chromium` puro) caso o Chromium baixado apresente algum problema —
Chrome e Edge do sistema existem em `C:\Program Files`.

---

## 8. Verificação: o que significa "pronto" aqui

| Tipo de mudança | Mínimo antes de dizer que está pronto |
|---|---|
| Frontend | `npm run build` + `tsc --noEmit` limpos; push; Netlify publicou; **pedir smoke-test ao usuário** (sem login de teste). |
| Migration | SQL mostrado ao usuário; ensaio com rollback se for sensível; push; `gh run` success; consulta ao estado vivo confirmando. |
| Edge Function | Push; `gh run` success; chamada real ou evento real observado nos logs (`function_logs`) com o resultado esperado. |
| Cron / automação | Esperar (ou disparar via `workflow_dispatch`) uma execução real e conferir a tabela de resultado (`intimacoes_sync_jobs`, `processo_sync_log`, `cron.job_run_details`). |
| Worker Cloudflare | Scripts de teste + `tsc`; `wrangler deploy`; `curl` na URL de produção. |

Se encontrar no meio do caminho um problema **ativo** de segurança ou de dado de cliente
(RLS aberta, vazamento, automação falhando em silêncio), o usuário quer que seja
**corrigido na hora**, não só reportado.

---

## 9. Onde registrar o que foi feito

1. **[HISTORICO.md](HISTORICO.md)** — linha do tempo do sistema. Acrescente uma entrada
   datada (AAAA-MM-DD) com: o que mudou, commit(s), o que ficou pendente. É o registro
   que qualquer agente lê primeiro.
2. **Memória do Claude Code** (`C:\Users\conta\.claude\projects\d--crm-bentes-ramos\memory\`)
   — só pro Claude; guarda contexto entre sessões. Não substitui o HISTORICO.md.
3. **Planos aprovados** ficam em `C:\Users\conta\.claude\plans\*.md` (fora do repo).
   Os que estão em andamento estão referenciados no HISTORICO.md.
4. **README.md** do CRM — visão geral da stack. Atualize se mudar algo estrutural.
