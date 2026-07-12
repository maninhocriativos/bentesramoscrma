# CRM Bentes Ramos

CRM jurídico do escritório **Bentes Ramos**. Gestão de leads, processos, petições,
contratos, financeiro, agenda e atendimento omnichannel (WhatsApp, Instagram, Meta Leads),
com uma assistente de IA ("Isa") para automações.

> ⚠️ **Este projeto NÃO usa Lovable.** O fluxo de trabalho é **git + Supabase + Netlify**.
> Ainda existem resquícios do Lovable no código (dependência, URLs de assets e um gateway de IA) —
> veja [Dívidas técnicas do Lovable](#dívidas-técnicas-do-lovable).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 18 + TypeScript + shadcn/ui + Tailwind CSS |
| Estado/dados | TanStack React Query, React Router v6 |
| Backend | Supabase — Postgres + Auth + Storage + Realtime |
| Funções serverless | 71 Supabase Edge Functions (Deno) em `supabase/functions/` |
| Hospedagem (frontend) | **Netlify** |
| CI/CD | GitHub Actions (deploy de functions e migrations no push para `main`) |
| PWA | `vite-plugin-pwa` (service worker versionado por build) |

Supabase project ref: `qgenaltkjtlvwfgykpxq`

---

## Rodando localmente

Pré-requisitos: **Node.js 18+** (o repo usa `bun.lock`, mas `npm` funciona).

```sh
# 1. Instalar dependências
npm install        # ou: bun install

# 2. Configurar variáveis de ambiente (ver seção abaixo)
#    Copie o modelo e preencha:
cp .env.example .env   # se existir; senão veja "Variáveis de ambiente"

# 3. Subir o dev server (porta 8080)
npm run dev
```

Scripts disponíveis:

| Comando | O que faz |
|---|---|
| `npm run dev` | Dev server em `http://localhost:8080` |
| `npm run build` | Build de produção |
| `npm run build:dev` | Build em modo development |
| `npm run lint` | ESLint |
| `npm run preview` | Preview do build |

---

## Variáveis de ambiente

**Frontend** (`.env`, prefixo `VITE_`, embarcadas no bundle — não são segredo):

```
VITE_SUPABASE_URL=https://qgenaltkjtlvwfgykpxq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=qgenaltkjtlvwfgykpxq
```

**Backend** (secrets das Edge Functions) ficam no painel do Supabase
(`Project Settings → Edge Functions → Secrets`), **não** no `.env`.
A lista completa e onde obter cada um está documentada em `docs/SECRETS.local.md`
(arquivo local, fora do git).

---

## Estrutura

```
bentesramoscrma/
├── src/
│   ├── pages/          # 37 rotas (Dashboard, Leads, Processos, Petições, ...)
│   ├── components/     # UI por domínio (crm, processos, contratos, chat, ...)
│   ├── contexts/       # PerfilContext (usuário/permissões)
│   ├── hooks/          # hooks reutilizáveis
│   ├── integrations/   # supabase (client + types) e zapsign
│   └── lib/            # utilitários (PDF, laudos, etc.)
├── supabase/
│   ├── functions/      # 71 Edge Functions (Deno)
│   ├── migrations/     # 214 migrations SQL
│   └── config.toml     # config de deploy das functions (verify_jwt por função)
├── public/
│   ├── _redirects      # rewrite SPA para Netlify
│   ├── images/         # assets (logos, prova social)
│   └── templates-zapsign/  # PDFs de contratos
└── .github/workflows/  # deploy de functions, migrations e automações agendadas
```

---

## Deploy

O deploy é **automático via GitHub Actions** ao dar push na branch `main`:

- **Frontend** → Netlify (build automático a cada push).
- **Edge Functions** → `.github/workflows/deploy.yml` faz deploy de todas as
  funções em `supabase/functions/*` (exceto `_shared`).
- **Migrations** → `.github/workflows/deploy-migrations.yml` roda `supabase db push`
  (CLI oficial), que aplica só as migrations realmente novas com base no histórico
  de migrations do próprio Supabase — sem cutoff de data.
- **Automações agendadas** → `intimacoes-auto-sync.yml`, `processo-auto-sync.yml`,
  `traffic-followup-automation.yml` (cron).

Secrets do CI (no GitHub): `SUPABASE_ACCESS_TOKEN`.

---

## Remoção do Lovable — concluída ✅

O projeto nasceu no Lovable e foi totalmente desacoplado dele:

| Item | Status |
|---|---|
| `README.md` boilerplate | ✅ Reescrito (este arquivo) |
| Dep `lovable-tagger` | ✅ Removida do package.json (regenerar lockfile no próximo install) |
| `playwright.config.ts` / `playwright-fixture.ts` | ✅ Reescritos com Playwright padrão (`@playwright/test`) |
| Gateway de IA (`LOVABLE_API_KEY` + `ai.gateway.lovable.dev`) | ✅ Migrado para **OpenAI (primário) + Claude (fallback)** via `supabase/functions/_shared/ai-helper.ts` |
| URLs `bentesramoscrma.lovable.app` (assets) | ✅ Centralizadas em `siteConfig.ts` (frontend) e `_shared/site.ts` (functions), resolvidas por `SITE_URL`/origem real |
| Pasta `.lovable/` | ✅ Removida |

**Config de IA:** modelos ajustáveis por env `OPENAI_MODEL` (default `gpt-4o`) e
`ANTHROPIC_MODEL` (default `claude-sonnet-4-20250514`). Funções migradas:
`petition-rewrite`, `calculadora-financeira`, `petition-generate-v3`,
`isa-multimodal` (só OpenAI — visão/áudio), `isa-reply-manychat` (limpeza de var morta).

**Pendência única:** rodar `bun install` (ou `npm install`) para regenerar os
lockfiles sem `lovable-tagger`.
