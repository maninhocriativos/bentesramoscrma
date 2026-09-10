# Histórico do sistema — CRM Bentes Ramos

> Registro cronológico de tudo que foi feito no CRM e nos módulos satélites, pra que
> qualquer agente (ou pessoa) saiba o que já existe, por que está do jeito que está, e
> o que ficou pendente. Como operar (commit/push/deploy) está em
> [GUIA_DEPLOY_E_GIT.md](GUIA_DEPLOY_E_GIT.md).
>
> **Regra:** toda sessão de trabalho acrescenta uma entrada na seção 3 (linha do tempo)
> e atualiza a seção 4 (pendências) se abriu ou fechou algo. Data no formato AAAA-MM-DD.
>
> Fontes desta primeira versão (2026-09-07): `git log` dos 4 repositórios (3.013 commits
> no CRM, 11 + 6 + 4 nos Workers), README.md, memória de sessões do Claude Code
> (jul–set/2026) e os workflows do GitHub Actions.

---

## 1. O que é o sistema

CRM jurídico do escritório **Bentes Ramos Advocacia e Consultoria Jurídica** (Manaus/AM,
OAB/AM 7526, advogado Andrey Augusto Bentes Ramos). Equipe de ~6 pessoas (admin,
advogados, estagiário, secretaria, atendentes). Operado tecnicamente pelo usuário
`maninhocriativos@gmail.com`.

Módulos do CRM principal (`bentesramoscrma`, 37 rotas):
Dashboard · Leads (lista/kanban/detalhe) · Processos · Intimações · Tarefas · Agenda ·
Chat omnichannel (WhatsApp via Z-API em 2 linhas, Instagram Direct) · Contratos
(ZapSign, ClickSign, fechados no chat) · Petições (motor novo em Cloudflare) ·
Financeiro · Documentos (Google Drive) · Meta Leads / Follow-up de tráfego · Assistentes
de IA ("Isa" no WhatsApp, "Donn@" interno) · Histórico de Atendimento · Usuários e
permissões · versão mobile "estilo app".

Módulos satélites (Cloudflare Workers, cada um com git próprio):
`peticoes-cloudflare` (motor de petições/contratos, D1 + R2) ·
`peticoes-modelos-admin` (cadastro de modelos `.docx`) ·
`portal-cliente` (Área do Cliente: login por CPF + código no WhatsApp).

Integrações externas ativas: Supabase, Netlify, Cloudflare, Z-API (WhatsApp), Meta
(Lead Ads, Instagram, CAPI), OpenAI, Google (Drive/Calendar/OAuth), ZapSign, ClickSign,
Resend (e-mail), CloudConvert, DJEN/Comunica PJe (CNJ), DataJud (CNJ), web-push (VAPID).
Abandonadas: Lovable (origem do projeto), Cal.com, Escavador, Anthropic (na Isa).

---

## 2. Fases do projeto (visão de alto nível)

| Período | Commits | Fase |
|---|---|---|
| 2025-01 | 1 | Template inicial Vite+React+shadcn (Lovable). |
| 2025-12 | 294 | Nascimento no Lovable. Leads, Drive, Isa, ManyChat, contratos, chat. Commits "Changes". |
| 2026-01 | 561 | Chat e Isa amadurecem: presença, retomada 24h, follow-ups, unificação de IDs Z-API, dedupe de leads. |
| 2026-02 | 327 | Meta Lead Ads, Isa na linha de tráfego, GerarContratoModal, badges de não lidas, primeiros ajustes mobile. |
| 2026-03 | 951 | **Pico.** Processos (DataJud/Escavador), intimações, agenda com KPIs, Petições Iniciais reescritas, roteamento por instância de WhatsApp, CPF em processos, correções de segurança, webhook dual-token. |
| 2026-04 | 327 | Unificação da página de Processos, extratos bancários, `_redirects` (Netlify), `deploy.yml`, redesign do ProcessoModalExpanded. Saída do Lovable começa. |
| 2026-05 | 293 | Roteamento Z-API endurecido, modelos Bradesco, Tarefas redesenhadas, Donn@, auto-enroll de follow-up, deep-link de agentes, convites/aprovação, `intimacoes-oab` reescrita, CI de migrations, DataJud + DJe-TJAM, tags. |
| 2026-06 | 66 | ZapSign (templates + envelope multi-docs), Instagram Direct no inbox, ZapSign assinados, busca de conversa no banco. Escavador fica sem crédito (~02/06). |
| 2026-07 | 95 | Sessões com Claude Code começam (09/07). DJEN como fonte de intimações, cobertura TJAM, auditoria Dashboard/Tarefas, agendamento próprio (Cal.com removido), templatização de petições, lentidão do chat resolvida. |
| 2026-08 | 92 | Auditorias grandes (Dashboard, truncamento, segurança/RLS), Isa migra pra OpenAI, isa_documentos, lembretes de audiência, drive-sync, Histórico de Atendimento, petições v2 em Cloudflare, mobile shell, Área do Cliente, push notifications. |
| 2026-09 | 6+ | Notificação processual com relevância por IA; Tarefas ↔ Agenda interligadas; esta documentação. |

Datas de marcos de infraestrutura:
- 2026-04-16 `public/_redirects` (Netlify) · 2026-04-17 `deploy.yml` (edge functions via Actions)
- 2026-05-16 `ci:` deploy dispara em mudança de workflow · 2026-05-23 `ci:` migrations via API
  (depois trocado por `supabase db push --linked` no `deploy-migrations.yml`)
- 2026-08-25 confirmado que deploy real é 100% via push (Netlify + 2 workflows)
- 2026-08-27 módulo de petições sai do Supabase e vira Worker Cloudflare (3 repos novos)

---

## 3. Linha do tempo detalhada (jul/2026 em diante)

A partir daqui cada entrada tem: **o que**, **por quê / causa raiz**, **commit(s)**,
**pendências**. Antes de jul/2026 só existe o `git log` (sem notas de sessão).

### 2026-07-09 a 07-14 — DJEN, Escavador sem crédito, cobertura TJAM
- **Descoberta crítica**: Escavador retornando HTTP 402 (sem crédito) desde ~2026-06-02.
  `intimacoes-oab` não tinha fallback → **zero intimações novas por 40+ dias** enquanto
  o workflow reportava sucesso (200 com lista vazia).
- **Fix**: DJEN (Comunica PJe Nacional, `comunicaapi.pje.jus.br`, grátis, sem chave)
  adicionado como fonte por OAB. Recuperou 90 intimações na primeira execução.
  Descoberta: busca por OAB **não funciona pro TJAM** no DJEN; por CNJ funciona.
- **Nova function** `processo-djen-sync`: varre cada processo por CNJ a cada 20 min,
  ordem "mais antigo primeiro" via `ultima_consulta_djen_at`, circuit-breaker após 3
  403 seguidos. Workflow `processo-djen-sync.yml`.
- `processo-auto-sync` (DataJud) reescrito pra se auto-limitar por **tempo** (~100 s) em
  vez de contagem fixa (estava em 6/dia, 821/864 processos atrasados). Cron a cada 15 min.
- `consulta-processos.persistirProcesso()` passa a resolver `cliente_id` sozinho
  (match único por nome → vincula; sem match → cria lead; ambíguo → deixa null).
  Backfill único levou vínculo de 31% pra 99% (274 → 878 de 886 processos).
- Correções: CPF formatado, advogado errado atribuído no sync manual, falso-positivo
  do DJe-TJAM (exigir termo a ~2500 chars do CNJ), entidades HTML, `RequireAuth`
  redirecionando pra `/chat` por fallback quebrado.
- **Decisão do usuário**: "grátis e gradual" (DJEN/DataJud) em vez de recarregar
  Escavador. Em 2026-08-22 virou definitivo: "escavador não usamos mais".
- **Decisão**: `notificacao_ativa` por processo continua **manual/opt-in** (só ~40/866
  processos notificam cliente automaticamente).

### 2026-07-14 a 07-15 — Auditoria Dashboard / Tarefas / Intimações
- Tarefas: kanban drag-and-drop, colunas com altura fixa (alinhamento), paginação,
  "Carga por Usuário" redesenhada, relatório PDF com prévia, popup de prazo crítico
  que reabria sozinho, `PresenceContext.fetchTeam()` ignorava erro.
- Dashboard: filtro passa a valer pra página inteira; "Total de Leads" dividia por
  cohort errado; prazos **fabricados** (`created_at + 30d`) removidos de `useAlertas` e
  `AgendaPrazosWidget`; `ConversionMetrics` reescrito (valor via `processos.valor_causa`,
  contagem via `lead_state` + `contratos_fechados`, segmento Escritório espelhado,
  `getSignedDate` parou de chutar data); dashboard antigo morto apagado.
- Intimações: rótulo de horário do cron corrigido (06h/12h/17h Manaus).
- `consulta-processos`: parte ativa em terminologia trabalhista/execução (Reclamante,
  Exequente…) não era reconhecida → "Sem identificação".
- 2026-07-15: `SUPABASE_ACCESS_TOKEN` encontrado em `docs/SECRETS.local.md` — a partir
  daqui as sessões têm acesso de leitura ao banco.

### 2026-07-16 — Contratos: badge de tráfego + link ClickSign 404 (`94ff56c9`)
- **Regra estabelecida**: `linha_whatsapp` é a fonte da verdade pra tráfego × escritório
  (`trafego_isa` = tráfego, `bentes_ramos_antigo` = escritório); `origem`/`tipo_origem`
  só desempatam quando a linha é indefinida. 24 + 44 leads estavam classificados errado.
- `isBadClicksignLink()` não reconhecia o fallback `/document/{key}` (exige login) como
  ruim → 55 `contract_reminders` presos desde uma atualização em massa de 2026-04-11.
  `fix-contract-links` ampliada. Status locais de ~6 contratos já cancelados corrigidos.
- Petições: soma automática do valor total, logo dourado padronizado, RG opcional, merge
  com marcadores MAIÚSCULOS (`e6d44b32`, `db9d4178`, `d85eda9b`).

### 2026-07-19 — Agendamento próprio, Cal.com removido, mídia do Instagram
- `AgendarConsultaModal.tsx` substitui o widget do Cal.com (que gravava a hora ATUAL em
  vez da escolhida). Presencial ou online; lembretes 24h/5h/2h e verificação de
  não-comparecimento via `isa-scheduler` (`a9d8ad25`).
- **Cal.com removido por completo** (`0b683fe5`): API quebrada há ~6 meses.
  `calcom-integration` reescrita sem provedor externo: disponibilidade = regra fixa
  (seg/qua/sex 09h–16h) × `compromissos`; online usa sala fixa Jitsi
  `meet.jit.si/BentesRamosAdvocacia-ConsultaJuridica`.
  **Testado e descartado**: Google Meet via Service Account sem Workspace/DWD não gera
  link (Google ignora `conferenceData` em silêncio).
- Instagram (`cc8651f3`): Meta manda `type:"file"` pra documento, front esperava
  `"document"`; 4 imagens antigas com URL pública do bucket privado recuperadas.
- Petições: prints por slot nomeado (`print_slots_json`, `b32d6c49`).

### 2026-07-20 — Lentidão geral do chat + envio de áudio
- **Causa raiz (via `pg_stat_statements`)**: índice único em
  `manychat_mensagens.metadata->>'message_id'` com predicado `COALESCE(...) <> ''` que o
  planner não prova → Seq Scan de 44k linhas em **cada** webhook do WhatsApp. Migration
  `20260720100004` recria com `IS NOT NULL`; condição morta `zapi_message_id` removida
  (`d323ee76`). 57–73 ms → 1,4 ms.
- Áudio: Chrome grava webm/opus → `zapi-send` mandava pro CloudConvert (média 12 s, pico
  63 s). Trocado por `opus-recorder` (Ogg/Opus no navegador), `295a096a`. Asset manual
  em `public/opus-recorder/`.
- Andrey (admin+advogado) não via processos (`534cb0c6`).

### 2026-07-20 a 07-22 — Templatização das petições iniciais
- Substituição dos modelos antigos por 12 templates `.docx` com marcadores `{{campo}}`,
  convertidos a partir de petições reais (em `public/templates-novos/`, **não
  versionado**, PII). Convenções: `reu_*` genérico, sufixo `_1/_2/_3` multi-contrato,
  `autoDobro()`/`autoExtenso()`, `nome_produto`, `cidade_peticao`.
- **6/12 prontos e no ar**: SUSEP, RCC, RMC, Venda Casada CLT PAN / C6 / Bradesco
  (`14d8db00`, `ea15c2d8`, `c15299a9`, `4265ad51`, `a780775b`).
- Faltam 6 (Facta ×2 bloqueados por erro de copy-paste no original; C6 INSS mapeado mas
  sem script; PAN INSS; Paraná Banco 3 contratos; descontos Bradesco/APEAM).
  Esse fluxo foi depois **superado** pelo motor novo em Cloudflare (2026-08-27).
- DJEN por nome (nacional) + resumo diário por e-mail (`9bf11c40`).

### 2026-08-05 e 08-09 — Bloqueio temporário; geoblock do DJEN
- 08-05: "bloqueio temporário do sistema" ativado e removido no mesmo dia (`472a1fba`,
  `a420587b`) — feature de trancar o CRM.
- 08-09/10: **todas as 4 fontes de intimação mortas**. Escavador 402; **DJEN 403 =
  geoblock de país do CloudFront** (provado: IP residencial BR → 200 com 247 resultados;
  runner do GitHub e Supabase → 403 "block access from your country"); DataJud 0
  resultados; DJe-TJAM corpo vazio. Workflow temporário de teste criado e apagado
  (`3f8e0b1a`, `35d9a79c`).
- **Decisão**: VPS no Brasil (~R$20–35/mês) rodando proxy simples, `DJEN_PROXY_URL` na
  function. **Usuário precisa provisionar** — não feito até 2026-09-07.

### 2026-08-16 a 08-18 — isa_documentos, Isa migra pra OpenAI
- Novo agente `isa_documentos` (`4d985724`, `07888b37`): primeiro contato dos leads de
  tráfego, coleta contrato/identidade/CPF/comprovante um por vez antes do handoff.
- **08-17 outage**: Anthropic sem crédito → Isa 100% muda (25 leads de tráfego atendidos
  só por humanos naquele dia). `isa-auto-process` trocado pra OpenAI (`gpt-4o`) sem
  fallback, por decisão do usuário (`f833d10a`). Retry em 429 (`17793d63`).
- Planilha de cobranças indevidas simplificada (`21e9c5bd`).

### 2026-08-19 a 08-20 — Audiências, RLS de intimações, Instagram, cargo Atendente
- Lembretes automáticos de audiência por WhatsApp 15d/7d/3d (`bed3eb63`), juntando
  tarefas + compromissos, modo force pra catch-up, horário no fuso do tribunal + campo
  de link (`c576100e`).
- RLS de `intimacoes`: SELECT não liberava por OAB (`b77d4e58`). Agendamento duplicado
  do GH Actions removido (pg_cron já cobria) (`aa49584c`).
- Modais de Tarefa/Compromisso nunca linkavam a processo (`a42a42d7`, `f418a413`).
- Instagram: áudio convertido pra formato aceito, backfill, documento/áudio via upload
  como anexo real (`768aa3c8`, `72c6da77`); filtro por canal; indicador "digitando".
- Cargo **Atendente** (leads, chat, documentos) (`95a25d52`).

### 2026-08-21 — 20 commits: Drive, documentos, Histórico de Atendimento, cron
- `drive-sync` só funcionava pra quem fez o OAuth original; não reprocessava presos em
  `syncing`; `download_file` quebrava acima de ~64 KB (`ef612bc1`, `5a26ddbc`, `3c296a62`).
- Documentos: prévia e download real, miniatura de imagem.
- Chat: texto + anexo iam separados; áudio sem upload salvava vazio; negrito markdown
  não normalizado (`60ce2271`, `71ad566d`, `7c5b899b`, `f60ed24d`).
- **Nova página Histórico de Atendimento** (admin): tempo até primeiro atendimento,
  paginação, modal por cliente (`b0679cd8`, `f44522d2`, `2b6be624`). Log de quem
  adiciona/remove tag (`25ee855b`).
- pg_cron: crons duplicados/mortos desativados, limpeza diária de `job_run_details`
  (`8e2e31d7`, `bfd38e30`). Check constraint de `traffic_followups` nunca permitia
  `nutricao` (`61ef7867`). Migration do backup diário registrada no git (`d8929d53`).
- Revert: fix do isa-documentos ↔ Drive (`b6637736` → `b5494e1e`).

### 2026-08-22 — Auditoria do Dashboard + bug de truncamento (9 commits)
- **3 números críticos** (`1dbd8aef`): "Valor da Causa" somava `lead.valor_causa`
  (2 de 3.345 leads, R$21k) em vez de `processos.valor_causa` (R$2,74M); "Tráfego Hoje"
  contava todo lead; taxa de conversão dividia cohorts diferentes (>100%).
- **ZapSign 72% "Indefinido"** (`d49aa1f1`): `useZapsignContratos` buscava todos os leads
  sem `.range()` → PostgREST cortou em ~1000. + "Vincular lead" manual (`286ec310`,
  migration abrindo RLS de `contract_reminders_zapsign`).
- **Mesmo bug em `useLeads`/`useProcessos`** (`c0da7810`): o Dashboard inteiro estava
  cego pros ~2.300 leads mais antigos. **Auditoria completa** (`a1979c37`): mais 8
  pontos (export CSV, ContratosPage/ClickSign, useMetaFormLeads, ExportTrafegoModal,
  FollowupPage, IntimacoesPage, IsaAutonomaPage ×2). Tabelas pequenas checadas e
  deixadas.
- **Contrato Fechado unificado** (`c081dc73`, `f8718438`): botão do chat cruzado com
  ZapSign/ClickSign, aba "Fechados no Chat", `valor_contrato`/`processo_id` no modal,
  retry do Meta CAPI, widget no Dashboard. Refactor: `useProviderContracts.ts`,
  `src/lib/leadOrigem.ts`.
- Tarefas de intimação: prazos e duplicidade (`34329c15`); KPIs de processos e
  permissões de agenda (`21903ab2`).
- **Achado de dado (não é bug)**: 626 de 784 contratos assinados não têm
  `contract_signed_at` (carga histórica) — métricas por período subcontam.
  Backfill é decisão do usuário, não foi feito.

### 2026-08-23 a 08-24
- `fetchTeam` blindado contra promise pendurada; "Nenhum membro" prematuro
  (`0e692161`, `8c7fef41`). Envio duplicado de "andamento do processo" (`83458710`).
- Partes de processo, vínculo de intimações, histórico de leads (`313d26e8`); quem
  enviou cada mensagem no ChatInbox (`03f8adad`); assinatura ZapSign e ClickSign
  (`4dde374c`).

### 2026-08-25 — Segurança (RLS), lentidão, lembretes pausados
- **Crítico, corrigido e verificado no banco** (`1929e358`, migration `20260825140000`):
  `leads_juridicos` e `processos` tinham policy `USING(true)` coexistindo com as por
  cargo (RLS faz OR → qualquer autenticado via tudo); `perfis` permitia se
  auto-promover a Administrador; INSERT em `manychat_mensagens/subscribers` aberto pro
  `anon`. Cargo Estagiário incluído nas policies; trigger anti-escalação libera
  `auth.uid() IS NULL` (service_role).
- Lentidão: paginação de `useLeads`/`useProcessos` (correta desde 08-22, mas
  sequencial) virou paralela em lotes de 4 — `src/lib/fetchAllPaginated.ts`
  (`74ee0b4a`). Lead Perdido não sumia do chat (mesmo commit).
- Diagnosticado: `AppLayout` remontava a cada navegação (28 páginas cada uma com seu
  wrapper) — corrigido em 08-26.
- **Lembretes de compromisso pausados** (`cron.alter_job(6, active=>false)`, job
  `isa-scheduler-14h`) a pedido do usuário. O "duplicado" que ele viu era a cliente
  reenviando a mensagem (`forwarded:true`). Reativar: `cron.alter_job(6, active=>true)`.
  Botão "Testar Lembretes" ainda dispara envio real.
- Migration `20260825120000` (coluna `message_id_key` + índice) aplicada, mas
  `zapi-webhook` **ainda consulta `metadata->>message_id`** — fix pela metade.
- Auditoria (3 subagentes) listou: ~50 edge functions sem auth, HMAC ausente em
  webhooks Meta/Instagram, race conditions (lead duplicado no zapi-webhook, ClickSign
  sem idempotência), botão "Sincronizar contatos" chamando função apagada, cron
  `retomada-leads-frios-hourly` chamando função inexistente, muito código morto
  (V1 de petições, `GerarContratoModal` 1114 linhas, `src/components/meta-leads/`).

### 2026-08-26 — Tags realtime, rascunho vazando, AppLayout
- Tags do chat não apareciam pros outros usuários: `subscriber_tags` nunca entrou na
  publication `supabase_realtime` (`2eb62ff0`, migration `20260826120000`).
- **Crítico**: campo de mensagem era state global → trocar de conversa antes de enviar
  mandava mensagem/anexo pro **WhatsApp errado**. Rascunho por conversa (`aa5612e5`).
- `AppLayoutRoute` compartilhado com `<Outlet/>`; 27 páginas trocam `<AppLayout>` por
  Fragment (`35fa044d`). `/chat` fica fora (tela cheia). Não testado logado.

### 2026-08-27 — 19 commits: Intimações, Petições v2 em Cloudflare, Leads
- Intimações: job não reagendava retry no 403 do DJEN; combobox travando; tipo de
  tarefa customizado não persistia; dropdown não fechava (`604239af` … `d9eb983b`).
- `useTarefas` e alertas do Isa truncavam em 1000 (`40062f9e`, `72ee23f4`).
- **Petições v2**: motor sai do Supabase (`petition-generate-v3`/docxTemplates no
  cliente + CloudConvert) e vira Worker Cloudflare `peticoes-poc` com D1 + R2 +
  docxtemplater server-side (`peticoes-cloudflare`, 11 commits no mesmo dia: PoC → D1 →
  R2 → JWT do Supabase → `TOKEN_SECRET` próprio → rotas de action-types/models →
  `/api/detect-fields` com IA → rotas de petições → `/api/models/:id/fields` → CORS →
  print do contrato + prévia). Site admin `peticoes-modelos-admin` (6 commits: cadastro
  standalone, detecção automática de marcadores regex+IA com revisão obrigatória,
  excluir tipo de ação, `aplicarMarcadores` só trocava 1ª ocorrência). No CRM: Edge
  Function `peticoes-issue-token` (ponte de auth), `peticoesV2Client.ts`, telas de
  catálogo/edição, admin de modelos removido do CRM; **fluxo novo vira o único**
  (`98bb23a0`, `490424bb`, `2a582af6`, `0e6aa683`, `96188970`, `49efc476`).
- Leads: aba "Registros" (anotações manuais), texto cortado no histórico, motivo de
  perda, prefixo interno quebrando vínculo de processos (`46d11a2d` … `3dddd94f`).

### 2026-08-28 — Contratos/Procuração via templates + ZapSign nativo (EM ANDAMENTO)
- Plano aprovado: `C:\Users\conta\.claude\plans\flickering-wibbling-spring.md`. Reusar o
  motor `{{marcador}}` pra contratos/procurações e usar a **API nativa de templates do
  ZapSign** (`POST /templates/create` + `/models/create-doc/`), que hoje nunca é usada
  (existe coluna morta `modelos_contratos.zapsign_template_id`).
- Feito local (não deployado): migration D1 `0002_contratos_schema.sql`,
  `contractsRoutes.ts`, `zapsignTemplates.ts` (sync graceful, testado contra API real →
  403 esperado sem token).
- **Bloqueado**: Worker precisa do `ZAPSIGN_API_TOKEN` (`wrangler secret put`). Fases
  4–9 (admin, CRUD de contratos, edge function, telas no CRM, aposentar
  `CriarContratoZapsignModal`/`docxTemplates.ts`/`ProcuracaoModal`) não começaram.
- Fix no CRM: compromisso de tarefa colidia com índice único lead+data (`2514b060`).

### 2026-08-29 — Mobile, Área do Cliente, push (7 commits)
- **Casco mobile** (`6ac8af64`): `src/config/navigation.ts` (fonte única de menu e
  permissões), `MobileTabBar`, `MobileMoreSheet`, `MobileDashboardScreen`; mesmo app
  web, `useIsMobile()` (768 px). Teste real no celular achou e corrigiu: bolha do chat
  interno colidindo com a tab bar, header do ChatInbox lotado (`9d1b6bdd`); tags em
  scroll horizontal + **`useIntimacoes` filtrava por `data_intimacao`, que o DJEN nunca
  preenche → Agenda/widgets vazios há meses** (`53d16169`); Calendar/Agenda mobile
  (`bdb747bf`); badge de KPI (`e96b4632`).
- Auditoria mobile: quebrados `MetaLeadsPage`/`FollowupPage` (inline styles, largura
  negativa); parciais `IntimacoesPage` (overflow-hidden), `TarefasPage` (DnD sem touch),
  `HistoricoAtendimento`, `LeadDetailPage`. Só Calendar foi corrigido.
- **Área do Cliente** (`14975e91` no CRM + repo `portal-cliente`): login por CPF +
  código via WhatsApp (não é Supabase Auth), sessão JWT HS256 7 dias, Edge Functions
  `cliente-portal-lookup`/`cliente-portal-data` protegidas por `x-bridge-secret`,
  Worker com D1 e SPA (Início, Processos, Comunicados, Documentos, Perfil), sidebar
  desktop + tabs mobile. Publicado em `portal-cliente.bentesramos.workers.dev`.
  Login testado ponta a ponta com o CPF do próprio usuário — **há um processo
  `[TESTE]` (status Arquivado) na tabela de produção**; perguntar se apaga.
- **Push notifications do chat** (`e6bed6aa`): `sw.js` já tinha handlers prontos;
  faltava o resto. VAPID, tabela `push_subscriptions`, `push-subscribe`, `push-send`
  (`PUSH_SEND_SECRET`), toggle no sino, `zapi-webhook` notifica só conversa com
  `assigned_to`. Não validado em navegador real.
- `docs/SECRETS.local.md` consolidado como cofre único de credenciais.

### 2026-08-30 — Petições com blocos dinâmicos (EM ANDAMENTO, não commitado)
- Plano: `C:\Users\conta\.claude\plans\imperative-conjuring-frog.md`. Motor passa a
  aceitar grupos repetíveis (N contratos), condicionais (ex.: "idoso" se
  `idade >= 60`) e campos computados (`threshold_bool`, `sum_array`, `monthly_series`).
- Fase 1 (motor, `petitionEngine.ts`) e Fase 2 (migration D1 `0003_field_schema.sql`,
  `blockMarking.ts` no admin, rota `/api/models/preview-schema`, seção "Blocos
  avançados" na UI) **prontas e testadas** (32 checks em 3 scripts, `tsc` limpo nos 2
  repos). Parado no teste visual da UI.
- Fase 3 (CRM: repetidor em `PeticaoEditarPage.tsx` + `petitionFields.ts`) não começou.
- **Nada commitado**: é o WIP que está nas working trees de `peticoes-cloudflare`
  (5 arquivos) e `peticoes-modelos-admin` (2 + `blockMarking.ts` novo) em 2026-09-07.

### 2026-09-02 — Notificação processual com relevância por IA (`47d8615a`, `16069c0f`)
- Bug: aviso de andamento ao cliente reenviava movimentação antiga. Não havia controle
  de **qual** movimentação já foi comunicada, só de **quando**; `movimentos_json` é
  reescrito a cada sync. `houveMudanca` no monitor era código morto.
- Fix: `processo_movimentacoes.notificado_em` + `.relevante` (migration
  `20260902120000`, com backfill), `_shared/movimento-relevancia.ts` (pendentes +
  classificação por IA via `ai-helper`), `processo-status-notify` e
  `processo-status-monitor` usam só pendentes relevantes. Cron duplicado
  `processo-auto-sync-ter-sex` desativado.
- Ajuste de produto (inspirado na IViJur): quando a janela libera, **sempre manda
  algo** — novidade relevante ou "sem novidades, seguimos acompanhando".
- Não observado ao vivo ainda.

### 2026-09-04 — Tarefas ↔ Agenda interligadas (`54d412ff`, `a6c12dba`, `2fc9d6fa`, `f7893284`)
- `responsaveis_ids uuid[]` em `tarefas` e `compromissos` (`responsavel_id` = 1º do
  array, mantido por trigger nos dois sentidos); `tarefas.tipo`,
  `compromissos.link_audiencia`; triggers `sync_compromisso_da_tarefa` e
  `sync_tarefa_do_compromisso` (esta só cria tarefa quando `origem='agenda'`, de
  propósito — origens `local`/`advbox`/`cal.com` não viram tarefa); anti-loop via
  `set_config('app.sync_origem')`; SECURITY DEFINER por causa da RLS.
- Busca de processo sem pontuação: coluna gerada `processos.numero_processo_digits`
  (NÃO usar `cnj_normalizado`, que é UNIQUE e chave do DataJud). Helper
  `src/lib/processoSearch.ts` nos 6 pontos de busca.
- Tipo e título viram dropdown (`TituloTarefaCombobox`, catálogo `TITULOS_TAREFA_BASE`).
- Intimações criavam 1 tarefa **por responsável** → 20 duplicatas; corrigido pra 1
  tarefa com N responsáveis; migration `20260904150000` fundiu as existentes (77 → 66).
- Ensaio em produção com `begin/rollback` (18 checagens). **Não testado na UI real**.
- Erro de processo registrado: migration pushada sem mostrar o SQL antes — não repetir.

### 2026-09-07 — Documentação operacional (esta)
- Verificação do workspace: CRM sincronizado com `origin/main`; 3 Workers sem remoto;
  WIP de 2026-08-27/30 não commitado nos dois repos de petições; `supabase/.temp/`
  versionado indevidamente; `.git` da raiz é casca vazia.
- Criados `docs/GUIA_DEPLOY_E_GIT.md`, `docs/HISTORICO.md`, `CLAUDE.md` (raiz do
  workspace e do CRM).

### 2026-09-07 (mesmo dia, sessão seguinte) — Alertas globais, relatório AdvBox, fila de intimações destravada (`eba2e2f7`)
- **Alerta de prazo crítico + chat interno viram globais.** Causa raiz de dois
  pedidos do usuário ao mesmo tempo: `/chat` (WhatsApp) é a única rota fora do
  `AppLayoutRoute` compartilhado — por isso quem passa o dia na tela de chat
  nunca via o popup de tarefa crítica (que só existia em `TarefasPage.tsx`)
  nem as notificações do chat interno da equipe. Extraído pro hook
  `useCriticalTasksAlert` + componente `CriticalTasksAlert`, montado em
  `AppLayout.tsx` e em `ChatPage.tsx` (as duas únicas montagens necessárias).
- **Relatório de tarefas reescrito** (`src/lib/tarefaReportGenerator.ts`) no
  formato usado por sistemas jurídicos como o AdvBox: prioridade, data/prazo,
  e por tarefa vinculada a processo — partes (`processo_partes`), número CNJ
  e tipo de ação (`processos.assunto`). `handleGenerateReport` busca esses
  dados sob demanda, só pros processos do filtro atual.
- **Achado real na investigação de intimações**: a fila automática
  (`intimacoes-scheduler`→`intimacoes_sync_jobs`→`intimacoes-worker`) estava
  **100% parada desde 2026-08-27 16:00 UTC (11 dias, zero jobs novos)**.
  `claim_next_intimacoes_sync_job()` reenfileirava jobs travados em
  `processing` de volta pra `pending` sem checar se `attempts` já tinha
  esgotado `max_attempts` — um job da OAB 7526/AM ficou "pending" zumbi pra
  sempre, e o índice único por OAB bloqueou qualquer job novo desde então
  (mesmo padrão de "automação reporta sucesso mas não faz nada" do Escavador/
  Anthropic). O "Sincronizar agora" manual continuava funcionando por chamar
  a function direto, sem passar pela fila — daí a sensação de "não é 100%".
  Corrigido via migration `20260907230000_fix_zombie_intimacoes_sync_job.sql`
  (ensaiada com begin/rollback antes de aplicar) e **verificado ao vivo**:
  chamada manual ao scheduler pós-deploy retornou `queued:1` e o job
  completou (636 itens do DJEN, já todos existentes via syncs manuais).
  **Não confundir com o geoblock do DJEN** (`processo-djen-sync`, sync por
  CNJ pro buraco do TJAM) — esse é OUTRO problema, ainda ativo (0 processos
  consultados nas últimas 24h), não corrigido nesta sessão, precisa da VPS
  BR já pendente desde 2026-08-09 (item 2 da lista de pendências).
- Ver [[project_alertas_globais_relatorio_advbox_20260907]] na memória do
  Claude Code para detalhe técnico completo.

### 2026-09-07 (mesmo dia, terceira sessão) — Teste visual com Playwright habilitado
- Usuário pediu pra instalar o navegador no projeto pra permitir teste visual.
  O binário do Chromium do Playwright já estava no cache global da máquina
  (`C:\Users\conta\AppData\Local\ms-playwright`), só faltava confirmar que
  funcionava a partir deste projeto — `@playwright/test` já é dependência
  (`playwright.config.ts` já existia, projeto `chromium`).
- Verificado ao vivo: subiu o dev server (`npm run dev`, porta 8080), abriu
  `/auth` com `playwright-core` num script `.mjs` dentro da pasta do projeto,
  capturou console/pageerror (só warnings inofensivos de future-flag do React
  Router) e tirou um screenshot real — renderizou perfeitamente com o tema
  visual da marca. Servidor derrubado depois pelo PID certo (nunca
  `taskkill /F /IM node.exe /T`, que mata todo Node da máquina).
- Documentado em `docs/GUIA_DEPLOY_E_GIT.md` seção 7 ("Teste visual no
  navegador") — padrão de comandos pronto pra reusar, e o lembrete de que isso
  não elimina a necessidade de smoke-test do usuário pra telas atrás de login
  (sem credencial de teste neste ambiente).

### 2026-09-08 — Relatório de Leads (Google Sheets) + fuso do cliente na audiência (`e3ad752a`, `04e04b8a`)
- **Confirmado pelo usuário**: fatura do Supabase (aviso de 08-25) estava paga —
  removida das pendências. Lembretes de compromisso (jobid 6) checados ao vivo,
  seguem pausados como esperado desde 08-25 (`96e7576c`).
- **Novo botão "Gerar Relatório" na tela de Leads** (`GerarRelatorioLeadsModal.tsx`):
  gera planilha do Google Sheets formatada (nome, telefone, email, status, origem,
  valor da causa, cidade/UF, histórico de interação resumido) a partir dos leads
  já filtrados na tela, com seleção manual (checkbox) de quem entra. Nova edge
  function `leads-relatorio-sheets` cria a planilha via API do Sheets, reusando
  o token OAuth do Google Drive já em produção (`get_office_token`). **Escopo
  novo** (`spreadsheets`) adicionado em `google-drive/index.ts` — o token
  conectado hoje não tem esse escopo; usuário precisa clicar em "Conectar
  Google Drive" de novo (Documentos) pra reautorizar.
- **Lembrete de audiência agora respeita o fuso do ENDEREÇO do cliente**
  (`leads_juridicos.uf`), não só o fuso do tribunal (que já ajustava o texto
  exibido, não o envio). Brasil só tem 3 offsets relativos a Manaus — só quem
  está atrás (hoje, só Acre) precisa esperar; o resto já cai num horário normal
  sem mudança nenhuma. Quando precisa esperar, o envio é adiado via
  `system_events` (mesmo registro de dedup por janela 15/7/3d) e entregue por
  um novo poller (`isa-scheduler`, task `lembretes_audiencia_agendados`, cron
  a cada 10 min, migration `20260908120000`) — **ensaiada com begin/rollback**
  antes de aplicar, e o job novo confirmado `active:true` no banco pós-deploy.
- **Fix separado no mesmo push**: o widget "Chat da Equipe" (`ChatInterno.tsx`),
  fixo no canto inferior direito, tampava o botão de enviar mensagem em `/chat`
  desde que passou a ser montado ali também (sessão 09-07). Sobe acima do
  compositor só nessa rota; nas demais páginas continua igual.
- Ver [[project_relatorio_leads_sheets_fuso_audiencia_20260908]] na memória do
  Claude Code para detalhe técnico completo (achados de exploração, decisão de
  não reusar a fila `isa-lembrete-sender`, correção do arquivo OAuth certo).

### 2026-09-08 (mesmo dia, sessão seguinte) — Bug real de mensagens sumidas + credencial Netlify (`050e907c`)
- Usuário reportou que o botão do chat interno ainda tampava o enviar em `/chat`
  (`/chat` estreito, tipo janela redimensionada) e que mensagens pro Gabriel
  tinham sumido do chat interno. Investigado com SQL direto: **não era perda de
  dado** — `chat_mensagens` tinha 176 linhas, 14 do Gabriel, a última a poucos
  minutos. **Bug real achado**: `useChatInterno.ts` buscava com
  `order('created_at', {ascending: true}).limit(120)` — isso pega as 120
  mensagens **mais antigas**, não as mais recentes. Assim que o total passou de
  120, tudo que chegou depois ficava invisível a cada reload. Corrigido pra
  `ascending: false` + `.reverse()`.
- Diagnóstico do "deploy não subiu" (hash do bundle diferente do build local) foi
  **falso alarme** — builds do Vite geram hash diferente por ambiente mesmo com
  código idêntico; confirmado via API do Netlify (`published_deploy.commit_ref`)
  que o deploy realmente tinha ido ao ar.
- **Credencial nova**: `NETLIFY_API_TOKEN`/`NETLIFY_SITE_ID` (site `bentesramoscrm`,
  id `90c23e67-6736-4d11-8535-a1c2ad7eeaef`) adicionados a `docs/SECRETS.local.md`
  seção 12 — permite consultar status de deploy via API sem depender só do hash
  do bundle. Arquivo inteiro reorganizado (índice de status no topo) a pedido do
  usuário — "muito bagunçado".

### 2026-09-08 (mesmo dia, sessão seguinte) — Chat interno: filtros, colar print, formatação (`8f722128`)
- Filtro por remetente (dropdown) + busca de texto no "Chat da Equipe", aplicados
  sobre o histórico já carregado (sem query nova).
- Colar uma imagem da área de transferência (Ctrl+V) na caixa de mensagem agora
  anexa como print — reaproveita o mesmo fluxo de upload que o botão de anexo já
  tinha (`pendingFile`), sem infra nova.
- `MsgText` passa a renderizar `*negrito*`, `_itálico_` e `~riscado~` (padrão
  WhatsApp) além das @menções que já existiam — antes aparecia com os símbolos
  literais na tela.

### 2026-09-08 (mesmo dia, sessão seguinte) — Tarefas recorrentes (`5cc098a0`)
- Nova tabela `tarefas_recorrentes` (template: título, tipo, prioridade,
  responsáveis, frequência diária/semanal/mensal) + coluna
  `tarefas.tarefa_recorrente_id`. RLS espelha exatamente a de `tarefas`
  (checado ao vivo antes de escrever a migration): authenticated lê/cria/edita,
  só Administrador apaga.
- Edge function `tarefas-recorrentes-gerar` (cron diário, 04h Manaus) decide se
  cada recorrência ativa deve gerar hoje e insere em `tarefas` com `prazo_fatal`
  no mesmo dia — o trigger já existente (`sync_compromisso_da_tarefa`, de
  09-04) cuida sozinho de espelhar na Agenda, nenhum código novo pra isso.
  Dedup por `ultima_geracao_em` (não gera 2x no mesmo dia).
- Nova aba "Recorrentes" em Tarefas: criar/pausar/retomar/editar/excluir séries,
  reaproveitando `ResponsaveisSelect`/`TituloTarefaCombobox`/`TIPOS_TAREFA` que
  o modal de tarefa normal já usa.
- **Testado ao vivo end-to-end antes de entregar**: criada uma recorrência
  diária de teste via SQL, function invocada manualmente → gerou a tarefa +
  compromisso espelhado corretamente; invocada de novo no mesmo dia → não
  duplicou (`total_avaliadas: 0`); dados de teste apagados depois.
  **Não testado ainda**: criar uma recorrência pela UI de verdade e observar o
  primeiro ciclo 100% automático do cron (só rodou manual até agora).

### 2026-09-08 (mesmo dia, sessão seguinte) — Login de teste + cabeçalho do chat espremendo nome (`c7054c89`, `7b4626f3`, `f24fbf6b`)
- **Ajuste no cabeçalho de Leads** (`c7054c89`): campo de busca sem largura
  mínima virava um `<input>` de 0px em telas menores (o ícone de lupa é
  `absolute`, ficava visível mesmo com o campo colapsado — parecia que só
  faltava a caixa). Filtros de Origem/Etapa também empurravam os botões de
  Ação pra fora da tela entre ~1024-1280px; adiados pra `xl:` (Etapa
  continua acessível pelos pills clicáveis abaixo do header).
- **Credencial de teste adicionada**: usuário colocou o próprio login
  (`CRM_TEST_EMAIL`/`CRM_TEST_PASSWORD`) em `docs/SECRETS.local.md` seção 13,
  especificamente pra permitir verificação visual com dados reais via
  Playwright — **primeira vez nesta sessão que dá pra logar de verdade**.
  Uso combinado: só navegação/screenshot, nunca ação real (enviar mensagem,
  marcar lead, apagar algo).
- **Cabeçalho da conversa no chat** — duas rodadas:
  1. (`7b4626f3`) Tentativa inicial sem login: tags viravam `md:flex-wrap`
     (várias linhas) baseado na largura da JANELA inteira, não do painel de
     conversa — corrigido pra sempre 1 linha rolável. Insuficiente sozinho.
  2. (`f24fbf6b`) **Verificado ao vivo logado** numa conversa real
     (Josemias Ferreira Amorim): o nome do contato sumia por COMPLETO
     (largura zero) — não era só as tags, era Perdido/Contrato Fechado
     (com texto) + ~8 ícones de ação que não cabiam ao lado do nome no
     painel estreito. Usuário pediu explicitamente pra não quebrar linha.
     Fix: nome ganha `min-w-[200px]` garantido; Perdido/Contrato Fechado
     viram só ícone; fileira de ícones de ação rola horizontalmente quando
     não cabe tudo. Testado em 900/1109/1280px com a conversa real — nome
     sempre legível, nada mais desaparece.
- Ver [[project_chat_header_espremendo_nome_20260908]] na memória do
  Claude Code pra detalhe técnico completo (achados de diagnóstico, script
  de login usado, decisões de largura mínima).

---

### 2026-09-09 — Mensagens de chat cruzando entre clientes + login instável (`98f42b6d`, `d835476e`, `40471fdc`)
- **Chat mandando mensagem pro cliente errado** (`98f42b6d`): contatos do
  Facebook/Instagram sem telefone caíam num fallback em `api-hub` que
  buscava lead existente por `ilike('nome', '%nome%')` — substring sem
  checar telefone/email. Qualquer "José" ou "Raimundo" novo colava no
  primeiro lead que continha esse nome, misturando pessoas diferentes na
  mesma conversa (o chat agrupa por `lead_id`). Confirmado no banco: 27
  leads com 40 subscribers de pessoas distintas coladas por engano (ex.:
  1 lead "[Raimundo]" com Rai Sales, Raimundo Nonatos, Raimundo Mota e
  Raimundo Nonato Freitas — 4 pessoas reais diferentes). Fix: sem
  telefone/email confiável, cria lead novo (fallback que já existia) em
  vez de arriscar o match por nome. **Pendente**: separar os 27 casos já
  misturados — 6 confirmados com mensagem real de pessoas distintas
  (ensaiados com `begin/rollback`, script pronto, aguardando decisão do
  usuário pra aplicar); resto são falso-positivo (mesma pessoa, telefone
  em formato diferente) ou dado de teste/placeholder (`test_isa_456`,
  `{{1.\`Nome do Usuário\`}}`) sem ligação com o bug.
- **Login caindo sozinho, intermitente** (`d835476e`): `handleVisibilityChange`
  em `useAuth.ts` deslogava na primeira falha de `getSession()` ao voltar
  pra aba (troca de aba, notebook saindo de hibernação) — um soluço
  passageiro de rede já bastava. Agora tenta 3x com espera, igual ao
  `tryRefreshToken()` do `client.ts`.
- **Admin (e provavelmente outros cargos) jogado pra `/tarefas` ao abrir
  Dashboard/Leads/Processos/Financeiro direto** (`40471fdc`) — reproduzido
  100% das vezes ao abrir aba nova ou dar F5 nessas páginas. Causa: `useAuth()`
  é chamado de forma independente em ~40 arquivos (sem Context
  compartilhado); `PerfilContext` tem sua própria instância, que pode ver
  `user=null` por um instante antes de resolver `getSession()`, mesmo já
  tendo resolvido na instância do `RequireAuth`. Esse `null` transitório
  era tratado como logout confirmado (zerava `loading`/roles antes do
  fetch real terminar), e `RequireAuth` decidia a permissão errado nesse
  meio-tempo. Corrigido esperando `authLoading` resolver antes de decidir
  se é logout de verdade. Verificado ao vivo em produção: 7/7 cargas frias
  em 5 páginas sem redirecionamento indevido (antes falhava sempre).
  **Risco arquitetural que continua**: os outros ~39 usos de `useAuth()`
  fora de Context têm o mesmo tipo de corrida latente — não refatorado
  nesta sessão por ser mudança grande demais pra fazer sob pressão; considerar
  migrar `useAuth` pra Context compartilhado numa sessão dedicada.
- **Achado menor, não corrigido a fundo**: presença "quem está atendendo"
  no chat (`useChatAttending.ts`) tenta limpar o status ao fechar a aba via
  `navigator.sendBeacon`, mas isso sempre falha por CORS (Supabase retorna
  `Access-Control-Allow-Origin: *`, incompatível com beacon com credenciais)
  — suja o console, não afeta login nem envio de mensagem.

### 2026-09-09 (mesmo dia, sessão seguinte) — Mensagem enviada "some" da tela + ícone do chat interno tampando o enviar de áudio (`5b9cd1c2`)
- **Mensagem enviada aparece e desaparece sozinha** — reportado pela Amanda.
  Confirmado primeiro que não era perda real: toda mensagem recente dela
  estava salva no banco com `zapi_status: "success"` (entregue de verdade
  no WhatsApp). O bug era só na tela. Causa: em `sendMessage`/
  `uploadAndSendFile`/`sendAudioFromPreview`, a confirmação do envio (depois
  do `await` pro Z-API/Instagram/insert no banco) atualizava a tela com
  `setMessages(prev => ...)` sem checar se o atendente ainda estava na MESMA
  conversa. Quem atende muitas conversas em sequência (troca de conversa
  antes da confirmação voltar do servidor) tinha a mensagem injetada na
  conversa que estava na tela NAQUELE momento, não na conversa dona da
  mensagem; quando essa tela sincronizava sozinha depois (poll de 5s, volta
  de aba), a injeção errada desaparecia — daí "aparece e some depois de um
  tempo". Indício que confirmou o padrão de uso: `chat_atendimento_log`
  mostrando "quem está atendendo" trocando entre pessoas da equipe em
  poucos minutos, na mesma conversa, o dia inteiro. Fix: `applyMessageUpdate()`
  novo — só toca a tela (`setMessages`) se `selectedSubscriberRef.current`
  ainda for a conversa da mensagem; o cache (`messagesCacheRef`) sempre é
  atualizado, então ao voltar pra conversa certa os dados corretos já estão
  lá. Aplicado nos 3 pontos de envio (texto/arquivo/áudio) × 3 caminhos cada
  (sucesso, conflito de duplicata, erro) = ~11 chamadas corrigidas.
- **Ícone do Chat Interno tampando o botão de enviar áudio**: reportado com
  print — depois de gravar um áudio, a barra de prévia (player + enviar)
  aparece ACIMA da barra normal de digitar, mas o widget do Chat Interno
  (`ChatInterno.tsx`) tinha uma posição fixa (`5.5rem` do rodapé) calibrada
  só pra altura normal do compositor — ficava embaixo do botão verde de
  enviar da prévia. Fix: `ChatInterno` agora mede a altura real do
  compositor via `ResizeObserver` num elemento `#chat-compose-stack`
  (novo, em `ChatInbox.tsx`, envolvendo prévia + resposta + barra de
  digitar) e soma a diferença ao offset — funciona pra qualquer coisa que
  faça o compositor crescer (prévia de arquivo, barra de resposta), não só
  áudio. Verificado ao vivo em produção com gravação de áudio de teste
  (cancelada, nada foi enviado a cliente real).

---

### 2026-09-09 (mesmo dia, sessão seguinte) — useAuth() virou Context único (`996b827c`)
- Fecha a pendência 31 (risco arquitetural) registrada mais cedo hoje.
  `useAuth()` criava seu próprio estado — `getSession()`, `onAuthStateChange`,
  listener de `visibilitychange` — em CADA um dos ~40 arquivos que chamavam
  o hook, cada instância resolvendo a sessão no seu próprio tempo (foi assim
  que o bug do redirect indevido pra `/tarefas` aconteceu mais cedo hoje).
  Fix: `useAuth.ts` → `useAuth.tsx`, virou Context (`AuthProvider` guarda a
  lógica, montado uma vez em `App.tsx` acima do `PerfilProvider`; `useAuth()`
  só lê do Context). A assinatura do hook não mudou — nenhum dos ~40
  arquivos precisou ser tocado, só `useAuth.tsx` e `App.tsx`. Elimina o
  risco de corrida entre instâncias (agora só existe uma) e os listeners
  duplicados. Verificado: `tsc --noEmit` limpo, build ok, 16 cargas frias
  locais + 9 páginas em produção (incluindo `/chat`) sem erro de console
  nem redirecionamento indevido.

### 2026-09-09 (mesmo dia, sessão seguinte) — Documento/mensagem chegando duas vezes pro cliente (`acdab52d`)
- Reportado com print: cliente (Rafaela Farias) escreveu "você enviou duas
  devo considerar as duas?" depois de receber a mesma declaração de
  residência duas vezes no WhatsApp. Confirmado no banco: só existe UMA
  linha em `manychat_mensagens` para esse envio (`zapi_status:"success"`)
  — o problema não é duplicar o registro no CRM, é o envio real pro
  WhatsApp acontecendo duas vezes a partir do que o sistema acha ser uma
  única tentativa.
- Causa: `invokeZapiSend()` (`src/lib/zapiSendClient.ts`) tem um fallback
  que refaz a chamada pra `zapi-send` quando a primeira "parece" ter
  falhado por rede (`failed to fetch`, `networkerror`, etc). Esse tipo de
  erro do lado do navegador não garante que a função não rodou no
  servidor — se a resposta da tentativa original só demorou a voltar
  (Z-API lento, rede instável no escritório), o envio real já tinha ido
  pro WhatsApp; o fallback manda a mesma mensagem/documento de novo. A
  função `zapi-send` não tinha nenhuma proteção contra chamada repetida.
- Fix: `dedupe_key` (UUID gerado uma vez por envio, reaproveitado na
  tentativa original e no fallback). Nova tabela `zapi_send_dedupe`
  (migration ensaiada com `begin/rollback` antes de aplicar) — `zapi-send`
  grava um registro 'pending' antes de chamar o WhatsApp e 'done' com o
  resultado real depois; uma segunda chamada com a mesma chave espera e
  devolve o resultado já acontecido em vez de enviar de novo. Falha ao
  gravar na tabela (ex.: ordem de deploy, tabela ainda não existe) é
  best-effort — loga e segue o envio normal, nunca bloqueia por causa
  disso (evita que esse fix quebre o envio de mensagens se algo der errado
  com a tabela).
- Verificado ao vivo em produção com teste seguro (telefone fictício
  `5500000000000`, `message_id` inexistente, tipo `delete` — nada foi
  enviado a cliente real): 1ª chamada ~3s (round-trip real ao Z-API), 2ª
  chamada com a MESMA `dedupe_key` voltou em ~1,5s com a resposta idêntica
  já salva, sem contatar o Z-API de novo.

### 2026-09-09 (mesmo dia, sessão seguinte) — Tag comprida cortava sem aviso no cabeçalho do chat, de novo (`ab0e82fb`)
- Usuário reportou com print (tela da Anelize, notebook ~1366px): tag
  "ATENDIMENTO ANELIZE" (nome criado manualmente pela equipe) cortava no
  meio da palavra, sem "...". Reação inicial do usuário: "já fizemos isso
  ontem e o problema volta" — mas não é regressão do fix de 08-09
  ([[project_chat_header_espremendo_nome_20260908]]), é outro sintoma do
  mesmo padrão de design: a fileira de tags já rola horizontalmente
  (`overflow-x-auto`), mas a barra de rolagem fica escondida de propósito
  — sem nenhum indício visual, uma tag que não cabe parece cortada/quebrada
  em vez de "role pra ver mais". Reproduzido local e em produção em
  1366x768 na MESMA conversa do print (Gilmar Pereira): `scrollWidth` do
  container de tags (341px) > `clientWidth` (240px), confirmando que o
  texto realmente ficava fora da área visível sem aviso.
- Fix: `TagBadge.tsx` — nome da tag ganhou `max-width` (70px tamanho sm,
  110px md) com `truncate`, em vez de renderizar na largura natural
  inteira. Tag comprida agora aparece com "..." dentro da área visível
  (o `title` tooltip já existente mostra o nome completo ao passar o
  mouse); tags curtas (a maioria dos casos) não mudam nada visualmente —
  o limite só entra em ação quando o nome já passaria dele.
- Verificado ao vivo em produção na mesma conversa/tag do print: "Em
  Atendim..." e "ATENDIMEN..." aparecem inteiros e legíveis no cabeçalho.

### 2026-09-09 (mesmo dia, sessão seguinte) — Redesenho do cabeçalho do chat, a partir de mockup do usuário (`0fcec042`)
- Usuário desenhou um mockup (print, não Figma de verdade) mostrando o
  cabeçalho da conversa mais compacto: tags escondidas em dropdown em vez
  de fileira, botões Perdido/Contrato com texto em vez de só ícone, menos
  ícones na barra. Confirmado com ele por texto antes de implementar (3
  perguntas: tags só dentro do dropdown, tarja de lead é seleção única,
  quais ícones ficam) — sem isso teria adivinhado a taxonomia de tags.
- **Achado que destravou a implementação sem inventar dado novo**: o
  sistema de tags (`chat_tags`) já tinha categorias de seleção única
  (`origem`, `triagem`, `area` — troca automática ao escolher outra da
  mesma categoria) misturadas com categorias multi-select (`custom`,
  `status`, `outros`) numa fileira só. "Tarja de lead" do mockup é
  exatamente a categoria `origem` (Bentes Ramos, Desistiu, Indicação,
  Perdido, Retorno, Tráfego Pago) já pronta pra ser seu próprio dropdown.
- Mudanças: `TagSelector.tsx` ganhou prop opcional `triggerLabel` (sem
  quebrar o uso existente — sem o prop, comportamento idêntico a antes) que
  troca o gatilho "+ Tag" por um pill de seleção única mostrando a tag
  ativa. `ChatInbox.tsx`: duas instâncias do `TagSelector` (uma filtrada
  pra `origem` com `triggerLabel="Tarja de lead"`, outra com o resto pra
  "Adicionar tag") no lugar da fileira de badges; Lead Perdido/Contrato
  Assinado viraram pills com texto (mesmo onClick de sempre, mesmo modal)
  e passaram a aparecer em qualquer largura (antes só desktop); WhatsApp
  Web/Ligar saíram pra dentro do menu "..."; ícone de busca duplicado
  removido (já existia "Buscar na conversa" no mesmo menu).
- Verificado ao vivo em produção na mesma conversa real (Gilmar Pereira):
  histórico de mensagens intacto, dropdowns abrindo e mostrando as tags
  certas, menu "..." com os itens realocados, zero erro de console, testado
  também em 1366x768 e mobile (390px) antes de subir.
- Usuário avisou que vai desenhar uma versão mais completa no Figma de
  verdade depois — esse commit é a base funcional que a próxima iteração
  deve ajustar visualmente, não uma versão final fechada.
- **Correção no mesmo dia** (`8ce9913f`): usuário apontou que a estrutura
  não batia com o print original — lá, Tarja de lead/Adicionar tag/Lead
  perdido/Contrato assinado/ícones ficam todos na MESMA linha do telefone
  (empurrados à direita), não empilhados em linhas separadas como saiu na
  primeira tentativa. Corrigido: linha 2 do cabeçalho virou um único flex
  `justify-between` — telefone/status à esquerda (`shrink-0`, sempre
  visível), tarja+tag+pills+ícones à direita (`min-w-0 overflow-x-auto`,
  absorve o aperto e rola sozinho). Lição: numa mudança de layout a partir
  de mockup, replicar a árvore de linhas/colunas exata importa tanto quanto
  os elementos em si — ver [[project_chat_mistura_clientes_login_instavel_20260909]].
- **Segunda correção no mesmo dia** (`d293158f`): usuário mandou o link do
  Figma de verdade (`SISTEMA-BENTES-E-RAMOS`, node `1:2` "DESKTOP"). Usando
  `get_design_context` em vez de estimar num rascunho de baixa resolução,
  saíram 2 erros reais: rótulo é "Tags do lead" (não "Tarja de lead" — erro
  de leitura no rascunho pequeno) e as 4 pílulas usavam cor errada — "Tags
  do lead"/"Adicionar tag" são cinza sólido `#d9d9d9` com texto escuro
  `#1e2930` (eu tinha estilo tracejado/transparente); "Lead perdido" é
  vermelho puro `#ff0000`; "Contrato assinado" é `#21b849` exato (não o
  emerald padrão do Tailwind). Corrigido e verificado ao vivo em produção,
  cores lado a lado com o screenshot do node do Figma batendo.

### 2026-09-09 (mesmo dia, sessão seguinte) — Histórico de tags do lead nas dropdowns do chat (`985bcf73`)
- Usuário pediu pra ver quando cada tag foi adicionada/removida e por quem,
  direto no dropdown "Tags do lead"/"Adicionar tag". Achado: isso já era
  gravado desde sempre em `tag_change_log` (toda chamada de
  `addTagToSubscriber`/`removeTagFromSubscriber` em `useChatTags.ts` já
  insere lá — 579 linhas já existentes no banco), só nunca teve tela pra
  mostrar.
- Adicionado: seção "Histórico" no fim do popover do `TagSelector.tsx`
  (compartilhado pelas duas dropdowns) — busca `tag_change_log` filtrado
  pelo `subscriber_id` só quando o popover abre, com nome de quem mudou
  (join com `perfis`, FK já existia) e nome/cor da tag (join com
  `chat_tags`, FK já existia). Mostra "+ Nome da tag — adicionada por
  Fulano · há Xh" (ou "removida"), com o motivo quando a tag exigir
  (`requires_reason`).
- Verificado ao vivo em produção (lead "Gilmar Pereira"): histórico real
  mostrando "elaboração de contrato — adicionada por Anelize Matos · há
  cerca de 3 horas" e outras entradas corretas.

### 2026-09-09 (mesmo dia, sessão seguinte) — Tag mudada por Administrador não vai pro histórico (`9c7d219b`)
- Pedido do usuário: "eu como admin mudo as tags dos demais, minhas
  mudanças não podem aparecer no histórico" — ele usa a conta admin pra
  corrigir/testar tags de conversas de outras pessoas e não quer que isso
  fique registrado como se fosse uma mudança "oficial" visível pro resto
  da equipe no histórico que foi ao ar mais cedo hoje.
- `useChatTags.ts`: `addTagToSubscriber`/`removeTagFromSubscriber` só
  inserem em `tag_change_log` quando `!isAdmin` (via `usePerfil()`). A tag
  em si continua sendo aplicada/removida normalmente pra todo mundo — só
  o registro de auditoria fica de fora quando é o admin quem mudou.
- Não testado ao vivo com uma troca real de tag (evitei fazer uma ação real
  numa conversa de cliente só pra verificar) — é uma mudança pequena e
  isolada (um `if` em volta de um insert que já existia e já foi testado);
  `tsc`/build limpos. Pedir pro usuário confirmar na próxima vez que
  trocar uma tag como admin.

### 2026-09-09 (mesmo dia, sessão seguinte) — Visual unificado dos modais do chat (`04191ade`)
- Pedido do usuário logo após o redesign do header: "as tags que eu trocar
  não é para aparecer no sistema [ver item acima], e melhore todos os
  modais" — escopo confirmado por pergunta de esclarecimento: "Os modais do
  chat (Lead Perdido, Contrato, Agendar, Enviar contato, Criar tag)".
- Cada um desses 5 modais tinha um estilo de cabeçalho diferente e datado
  (banner gradiente vermelho cheio no Lead Perdido, ícone quadrado com
  barra de destaque no Contrato Fechado, barra sólida teal full-width no
  Agendar Consulta). Padronizado pra um único padrão: badge circular com
  ícone tonalizado (12% de opacidade da cor do contexto) + título
  `text-[15px] font-semibold` + subtítulo cinza, tudo dentro de
  `flex items-center gap-3 px-5 py-4 border-b border-border/60`, modelado no
  estilo que já existia em `ChatContractReminder.tsx`.
- Arquivos: `ContratoFechadoModal.tsx` (as duas visões: confirmação e
  formulário), `AgendarConsultaModal.tsx` (preservado o botão de voltar
  condicional por `step` e o botão de fechar), `SendContactModal.tsx`
  (só padronizado tamanho do ícone/badge, já estava próximo do padrão),
  `TagSelector.tsx` (dialog "Nova tag personalizada"). O Lead Perdido já
  tinha sido ajustado dentro do `ChatInbox.tsx`.
- Verificado ao vivo em produção via Playwright logado (conta real), abrindo
  os 5 modais numa conversa real (Ciente - Edvan Lima da Cruz): todos
  renderizando o padrão novo, nenhum erro de console, `tsc`/build limpos
  antes de subir.

### 2026-09-10 — Relatório de Leads (formatação), redesenho de Documentos, auditoria + Fase 2 do gerador de petições
- **Relatório de Leads → Sheets**: pendência #26 fechada — usuário reconectou
  o Google Drive e habilitou a API do Sheets no Google Cloud (erro real era
  a API nunca ter sido ligada no projeto, não bug de código). Formatação
  ficou "péssima" na 1ª versão (linhas gigantes, sem cor da marca) —
  corrigido: cabeçalho marrom/dourado, largura de coluna fixa, zebra,
  altura de linha travada em 90px, 3 itens por coluna longa (era 5) com
  texto mais curto. Nova coluna "Ações Realizadas (Equipe)" (mesmo dado da
  aba Registros do lead). Commits `f7b23ab4`, `3a0792fb`.
- **Exclusão de documentos** (Drive + Local) adicionada em `DocumentosPage.tsx`
  — Drive vai pra lixeira (recuperável 30d), local é permanente, com
  confirmação. Achado testando: documento novo não aparecia na lista sem
  F5 (modal de upload usa sua própria instância de `useDocumentos()`,
  desconectada da tela) — corrigido com callback `onUploaded`. Commits
  `6933df0b`, `ac63f35d`.
- **Redesenho da página de Documentos** seguindo o Figma real
  (`SISTEMA-BENTES-E-RAMOS`, node `documentos-desktop`) via
  `get_design_context` — cores/espaçamento exatos, fontes do projeto
  mantidas (Inter/Poppins, não as do Figma). Nenhuma função removida, só
  reorganizada: ações de arquivo viraram "Baixar" + menu "⋯", pasta de
  cliente abre com 1 clique, ícone/cor por tipo de arquivo. Verificado
  visualmente (Playwright, dev local + produção) antes e depois do deploy.
  Commit `12846641`. Versão mobile (`documentos-mobile`) ainda não feita.
- **Auditoria técnica do Gerador de Petições** (pedida explicitamente antes
  de qualquer código, ver `docs/` desta sessão): motor real roda 100% no
  Worker Cloudflare (`peticoes-cloudflare`, D1+R2) desde 27/08, com site
  separado (`peticoes-modelos-admin`) pra cadastro de modelo. **Achado
  central**: só 1 modelo real em produção ("Peticao_documento"/"Venda
  Casada") — os outros ~11 modelos antigos nunca migraram pra cá.
  Confirmado: nenhuma célula desse motor toca petições — os fluxos de
  Contratos/Procuração ZapSign são 100% separados (client-side +
  função `zapsign` do Supabase), decisão do usuário de manter assim.
- **Fase 2 da reestruturação** (fechar buraco de segurança + limpar código
  morto, antes de qualquer mudança de arquitetura):
  - CRUD de `action-types`/`models`/`detect-fields` no Worker não tinha
    **nenhuma autenticação** (qualquer um com a URL criava/apagava modelo,
    e o endpoint de IA custa dinheiro real por chamada). Fechado com header
    `X-Admin-Secret` nas rotas de escrita (leitura continua pública, é o
    que o CRM usa). Verificado ao vivo: GET sem header ok, POST/DELETE sem
    header 401, com header ok — testado também pela UI real do site admin.
    Ver `MODELS_ADMIN_SECRET` em `SECRETS.local.md` §2.2.
  - 6 tabelas Postgres órfãs apagadas (`petitions_v2`, `petition_models_v2`,
    `action_types`, `petition_versions` — já zeradas desde 27/08 — e
    `modelos_peticao`/`peticoes_geradas`, com 34+1 linhas reais nunca
    citadas na limpeza anterior; exportadas como backup local antes do
    `DROP`). Sem FK externa nem view dependente, confirmado antes.
  - 5 Edge Functions órfãs do sistema V1/V3 apagadas do Supabase
    (`petition-generate`, `petition-generate-v3`, `petition-pdf`,
    `petition-rewrite`, `petition-validate`) — zero caller no código atual.
  - No mesmo commit dos repos Cloudflare (sem remoto Git, local apenas):
    WIP de sessão anterior (27/08-30/08, blocos dinâmicos + scaffolding de
    Contratos) finalmente commitado junto — estava sem commit há >10 dias.
- **Fase 3 (mesmo dia, mesma sessão) — versionamento de modelo**: hoje um
  `PATCH` sobrescrevia a mesma linha e o `.docx` do template era imutável
  (editar = apagar e recriar, perdendo o vínculo com petições já geradas).
  Cada versão nova passa a ser sua PRÓPRIA linha em `petition_models`
  (mesmo `version_group_id`, `version_number` incrementado) — `petitions.
  model_id` continua apontando pro id exato da versão usada, então
  petições antigas continuam intactas sem precisar de coluna nova nelas.
  Migration `0004_model_versioning.sql` (aditiva). `listModels()` só
  devolve a versão corrente por padrão — **o CRM não precisou mudar nada**.
  Novos endpoints: `POST /api/models/:id/versions` (cria versão, herda o
  resto se não informado) e `GET /api/models/versions/:group_id`
  (histórico). `deleteModel` promove a versão anterior automaticamente se
  apagar a corrente. UI no site admin: badge "vN" clicável abre histórico,
  botão de upload por linha cria versão nova sem sobrescrever. Testado ao
  vivo (curl, fluxo completo v1→v2→listagens→apagar v2 promove v1) com um
  tipo de ação descartável, sem tocar no modelo real em produção.
  **Achado na Fase 3**: migrations `0002`/`0003` (contratos e
  field_schema) só existiam como arquivo local — nunca tinham sido
  aplicadas no D1 remoto de verdade (bookkeeping da `0001` também estava
  fora do sistema de migrations, corrigido). Aplicadas as 3 juntas.
- **Fase 4 (mesmo dia) — Layout Mestre do escritório**: o rodapé (timbre)
  era um XML fixo no código — trocar telefone/endereço exigia deploy.
  Migration `0005_office_layout.sql` (tabela singleton no D1); o XML do
  rodapé passou a ser gerado a partir desses dados
  (`gerarRodapeXml()`), mesma estrutura visual, só o conteúdo é dinâmico
  agora. Novos endpoints `GET`/`PATCH /api/office-layout` (leitura
  pública, escrita com o segredo). Escopo desta fase: só o rodapé
  (cabeçalho/logo/margens/fonte ficam pra depois se pedido). Seção nova
  no site admin pra editar sem precisar de deploy. **Verificado ao vivo
  de um jeito que prova de verdade**: mudou o telefone via API pra um
  valor de teste, gerou uma petição real com o modelo em produção,
  baixou o `.docx` e conferiu o texto de teste dentro do
  `word/footer1.xml` — depois revertido e a petição de teste apagada.
- **Ainda não feito** (fases seguintes do plano, aguardando o usuário
  retomar): camada semântica de IA (JSON de seções em vez de marcador
  plano) + schema dinâmico rico — a parte mais pesada — depois formulário
  dinâmico estendido + geração textual por IA + validador dados×gerado.
- **Anelize não conseguia enviar áudio no chat** (`dc1fb560`): investigado
  com dado real antes de qualquer suposição — no banco, ela nunca teve
  nenhuma mensagem de áudio registrada (nem sucesso nem erro), enquanto
  outros usuários enviavam normalmente. Usuário mandou o print do erro
  ("Microfone não disponível"), batendo exatamente com a string hardcoded
  em `ChatInbox.tsx`. Não era bug — é `getUserMedia` sendo recusado
  (permissão de microfone bloqueada no navegador dela), mas a mensagem
  genérica não dizia o motivo nem o que fazer. Melhorada pra usar o tipo
  do `DOMException` (`NotAllowedError`/`NotFoundError`/`NotReadableError`)
  e dar instrução específica. Ainda depende dela liberar o microfone nas
  configurações do navegador — a mensagem só explica, não desbloqueia.

### 2026-09-10 (mesmo dia, sessão seguinte) — Redesenho das telas de Petições (Figma real) + responsividade mobile
- Usuário mandou print das miniaturas de 18 frames do Figma
  (`SISTEMA-BENTES-E-RAMOS`) — 9 desktop + 9 mobile: dashboard, modal
  "Nova Petição" e as 7 etapas do formulário (cliente, endereço, réu,
  contrato, valores, outros, revisão). Confirmado que eram do arquivo
  real antes de implementar.
- **`PeticoesPage.tsx`** (dashboard) redesenhado a partir dos nodes
  `37:8`/`37:123`: 4 cards de estatística, busca + filtros em pill,
  tabela com paleta da marca, painel "Biblioteca de Modelos". Todos os
  hooks/handlers originais preservados. Achado ao comparar com o
  arquivo antes da reescrita: o header original usava `<AppHeader>`
  (sino de notificação, nome/cargo, sair) — a reescrita inicial tinha
  derrubado isso; corrigido plugando `NotificacoesBell`/`useAuth`/
  `usePerfil` de verdade no novo header, em vez de ícones estáticos.
- **`PeticaoEditarPage.tsx`** (wizard de 7 etapas) redesenhado a partir
  dos nodes `37:200`/`37:1216` com o mesmo "chrome" (header, stepper,
  card, rodapé de ações) pras 7 etapas — só muda `currentStep`. Mesmo
  cuidado com o `AppHeader`, aplicado preventivamente desta vez. Etapa
  de Revisão ganhou cards de resumo (cliente/réu/valor) que não
  existiam antes.
- **`PeticaoRevisaoPage.tsx`** (tela pós-geração, com histórico de
  versões) não tinha frame próprio no Figma — só aplicada a mesma
  paleta/padrão de card das outras duas telas, mantendo toda a lógica
  (marcar protocolado, arquivar, baixar versões antigas).
- Achado só depois do deploy: o botão flutuante "Nova Petição" tampava
  a bolha do chat interno (usuário mandou print). Ajustado a posição
  (`bottom-24`).
- **Responsividade mobile das 3 telas**, a partir dos nodes mobile do
  Figma (`37:1361` dashboard, `37:1455` modal, `37:1514` cliente):
  stats em grid 2×2, lista de petições em cards em vez de tabela,
  painel de modelos empilhado, indicador de etapa condensado
  ("Etapa N de M" + barra) no wizard em vez do stepper horizontal
  completo.
  - **Bug de raiz nº 1** (achado testando com Playwright em viewport
    390×844, não visualmente óbvio a 1440px): o botão flutuante fixo
    ficava **invisível até rolar até o fim da página**. Causa:
    `PageTransition.tsx` (usado por toda a AppLayout) aplica um CSS
    `transform` no wrapper de qualquer página — e qualquer `transform`
    (mesmo `translateY(0) scale(1)`, o estado "parado") vira o
    *containing block* de todo `position:fixed` dentro dele, fazendo o
    botão se comportar como se estivesse "grudado" na altura do
    CONTEÚDO, não da viewport. Corrigido com `createPortal` renderizando
    o botão direto em `document.body` (mesma técnica que o chat interno
    já usa, só que ele fica fora do `PageTransition` por estrutura).
  - **Bug de raiz nº 2**: ao empilhar os campos do formulário em 1
    coluna no mobile, os rótulos de campos adjacentes ("Nacionalidade"/
    "Estado Civil", "Profissão"/"RG") apareciam sobrepostos um no
    outro. Causa: `FieldInput` aplicava `col-span-2` fixo pros campos
    "largura total", e pedir `span 2` numa grid com só 1 coluna
    explícita força o CSS a criar uma coluna implícita — colapsando a
    coluna real pra `0px` de largura. Corrigido pra `sm:col-span-2`
    (só pede a 2ª coluna quando ela realmente existe).
  - **Bug de raiz nº 3**: o rodapé de ações do wizard ("Voltar" /
    "Salvar" / "Pré-visualizar" / "Gerar Petição") ficava atrás da
    barra de navegação inferior do mobile — confirmado com o próprio
    Playwright reportando "elemento intercepta o clique". A página não
    tem scroll interno de verdade (mesma raiz do bug nº 1: sem
    `overflow-auto` funcionando, o documento inteiro rola). Corrigido
    com `position: sticky` no rodapé (funciona mesmo dentro do
    `transform` do `PageTransition`, ao contrário de `fixed`).
  - Tudo verificado ao vivo com Playwright logado (390×844), inclusive
    rolando até o fim de cada tela pra garantir que nada fica atrás da
    barra de tabs/bolha do chat.
- **Fechamento (mesma sessão, continuação)**: as 7 etapas do wizard
  foram verificadas campo a campo no mobile (não só "Cliente") —
  nenhum problema novo, confirma que o fix do `col-span-2` generaliza.
  O modal "Nova Petição" foi refeito pra ser um sheet full-screen de
  verdade no mobile (igual ao node `37:1455`), não mais um Dialog
  "quase full-width": o `DialogContent` do shadcn fixa
  `left-1/2`/`top-1/2`/`translate`/`max-height`/`rounded` via
  className direto (não responsivo); em vez de mexer nesse componente
  compartilhado por todo o app, um `style` inline (maior
  especificidade) sobrepõe isso só nesta instância via
  `useIsMobile()`. Conteúdo reestruturado em flex-col (header/stepper
  fixos, lista com scroll próprio, rodapé fixo).

### 2026-09-10 (mesmo dia, sessão seguinte) — Redesenho da Pipeline de Leads (Figma real)
- Usuário pediu pra remodelar a página de Leads a partir do Figma real.
  Frames achados: `pipeline-leads-desktop` (57:9), `exportar-leads-
  modal-desktop` (57:277, modal em 57:546), `relatorio-leads-modal-
  desktop` (57:600, modal em 57:869) + 3 versões mobile equivalentes
  (mobile ainda não implementado).
- **Cabeçalho** (`LeadsTableHeader.tsx`) reescrito em duas linhas
  (título/contadores/usuário + toggle de visualização/busca/filtros/
  ações), igual ao padrão já usado em Petições/Documentos.
- **Pílulas de etapa** (`PipelineStagePills.tsx`) recoloridas com a
  paleta exata do Figma (`STAGE_CFG`, agora exportado e reusado por
  `KanbanColumn`/`LeadCard` — cor da etapa consistente em toda a
  página); mesmos tokens de cor de status já usados em Petições
  (`#fef3c7`/`#92400e` âmbar, `#dcfce7`/`#15803d` verde etc.).
- **Kanban board** (`KanbanColumn.tsx`, `LeadCard.tsx`) redesenhado:
  colunas com cabeçalho minimalista (rótulo + badge de contagem +
  valor total), cards com dot+status/tempo, nome+telefone, tipo de
  ação + origem — mantendo TODA a lógica original (drag-and-drop,
  insights da Isa/sentimento/urgência, próximo agendamento, badges
  B&R/Ads/contrato, Meta CAPI no "Ganho"). "Visual Board" virou o modo
  padrão da página (era "Cards").
  - Removidas as regras CSS `.kanban-grid-container`/
    `.kanban-column-wrapper` (colunas fixas em 240px, sem uso fora do
    `KanbanBoard`) — trocadas por Tailwind com a largura do Figma
    (340px).
- **Modais de Exportar Tráfego e Gerar Relatório** redesenhados a
  partir dos frames do Figma, preservando toda a lógica (fetch
  paginado, export CSV/PDF, Edge Function `leads-relatorio-sheets`).
  Duas adições reais: seleção rápida de mês (preenche datas
  automaticamente) no Exportar Tráfego, e busca por nome/telefone
  (client-side) no modal de Relatório. Omitido de propósito: dropdown
  "Origem de Tráfego" (Google/Meta Ads) do Figma não tem filtro real
  equivalente hoje — não fabricado.
- **Ainda não feito**: vistas "Cards" (grid antigo) e "Lista" continuam
  com o visual antigo (sem frame correspondente no Figma); modal de
  detalhe do lead (`LeadDetailModal.tsx`, 907 linhas) não tocado;
  versão mobile da pipeline pendente.

### 2026-09-10 (mesmo dia, sessão seguinte) — 2 bugs achados testando a Pipeline de Leads ao vivo
- Usuário reportou fonte errada no título ("mudou a fonte") e o mesmo
  erro que eu já tinha visto em teste automatizado, agora confirmado ao
  vivo: `Erro ao carregar leads: TypeError: Failed to fetch`.
- **Fonte**: os títulos do cabeçalho e dos 2 modais tinham
  `style={{ fontFamily: 'Lora, serif' }}` inline (copiado do Figma) —
  o projeto não carrega a fonte Lora, então caía num serif genérico do
  navegador, destoando do resto do app (Inter/Poppins). Removido,
  volta a usar a fonte padrão do projeto.
- **Erro de fetch — raiz real, diferente do que eu tinha suposto
  inicialmente**: não é específico do Board. `fetchAllPaginated`
  (usado por `useLeads`/`useProcessos`/`useDocumentos`/`useTarefas`)
  dispara até 4 requisições em paralelo pra paginar tabelas grandes —
  com leads já passando de 3500 linhas, uma falha de rede transitória
  numa dessas páginas (`TypeError: Failed to fetch`, sem resposta do
  servidor — não é erro do Postgres) derrubava a busca inteira sem
  tentar de novo. Adicionado retry com backoff (até 3 tentativas) só
  pra esse tipo de erro de rede.
- **Achado no caminho, mais sério**: "Visual Board" como padrão
  (decisão da sessão anterior, pra bater com o Figma) carrega TODOS os
  leads filtrados de uma vez, sem paginar — `useIsaInsights`/
  `useLeadExtras` fazem `.in(lead_id, [...])` com milhares de IDs (URL
  grande demais) e `useLeadExtras` ainda roda um loop que pode inserir
  um alerta pra Isa por lead sem agendamento. Isso já existia (o Board
  sempre ignorou a paginação), mas só era alcançado manualmente; virar
  padrão expôs isso pra todo mundo na primeira visita. **Revertido**
  o padrão pra "Cards" (sempre paginado, seguro) e adicionado aviso
  quando o usuário abre o Board com mais de 200 leads filtrados, em
  vez de travar. Corrigir `useIsaInsights`/`useLeadExtras` pra escalar
  direito (paginar o `.in()`, revisar a lógica de criação de alerta em
  massa) fica pendente — item novo na lista de pendências.

### 2026-09-10 (mesmo dia, sessão seguinte) — Corrigida a escala do Board de vez, "Visual Board" volta a ser o padrão
- Usuário pediu explicitamente: layout tem que ser o do Figma (Board
  como padrão) E os problemas têm que ser resolvidos de verdade, sem
  desviar. Contenção anterior (limite de 200 leads) era um curativo,
  não a correção — resolvida a causa raiz.
- `useIsaInsights`, `useLeadExtras` e `useLeadsProcessoCounts` agora
  paginam o filtro `.in(coluna, leadIds)` em lotes de 150 IDs
  (`Promise.all` + merge dos resultados) em vez de mandar todos os IDs
  filtrados numa única consulta — a URL não estoura mais de tamanho
  com a pipeline inteira (3500+ leads).
- **Achado revisando `useLeadExtras`**: o loop que inseria um alerta
  "agendar_atendimento" por lead sem agendamento era uma **duplicata**
  do que a Edge Function `isa-check-appointments` já faz corretamente
  — rodando via `cron.schedule` a cada 2h, escopada só a leads Em
  Atendimento/Em Negociação (migration `20260105014245`). Removida a
  versão client-side (e as 2 queries que só existiam pra sustentar
  ela) — não era funcionalidade real perdida, era risco sem propósito.
- "Visual Board" voltou a ser o padrão da página; removido o
  aviso/limite de 200 leads. Testado ao vivo com os 3567 leads reais
  em produção, todas as 8 colunas do Board, sem erro de fetch.

## 4. Pendências abertas (consolidado em 2026-09-07)

Ordem aproximada de prioridade. Ao fechar uma, mova pra linha do tempo com a data.

**Risco de perda / operação**
1. `peticoes-cloudflare` e `peticoes-modelos-admin`: WIP de blocos dinâmicos (08-30) e
   contratos ZapSign (08-28) **sem commit há 10 dias**; os 3 Workers **sem remoto no
   GitHub**. Commitar, criar repos, pushar.
2. DJEN geoblock: intimações por OAB e por CNJ dependem de IP brasileiro. **Usuário
   combinou provisionar a VPS BR em 2026-09-08** (ver VPS + proxy no Brasil já
   recomendado em [project_intimacoes_djen_geoblock](project_intimacoes_djen_geoblock.md)
   — DigitalOcean/Vultr/Hostinger/Contabo, ~R$20–35/mês). Depois de provisionada:
   - Escrever/configurar o proxy (Caddy ou relay Node/nginx simples) pra rotear saída
     pro `comunicaapi.pje.jus.br`.
   - **Smoke-test da VPS antes de wirar no CRM**: confirmar da própria VPS (SSH) que
     `curl https://comunicaapi.pje.jus.br/api/v1/comunicacao?...` retorna 200 (não
     403) — só then o IP brasileiro está de fato resolvendo o geoblock.
   - Adicionar `DJEN_PROXY_URL` como secret das Edge Functions e apontar
     `intimacoes-oab` e `processo-djen-sync` pra usá-lo (`fetchDjen`/`fetchDjenPorProcesso`).
   - Verificar ao vivo pós-deploy: `processo-djen-sync` voltando a atualizar
     `ultima_consulta_djen_at` nas últimas 24h (estava zerado desde 08-22, ver
     sessão 09-07) e novas intimações com `fonte='djen_processo'`.
   - Remover bloco Escavador V1/V2 de `intimacoes-oab` (decisão já tomada em 08-22,
     código só não foi limpo ainda).
3. `zapi-webhook` ainda consulta `metadata->>message_id` em vez de `message_id_key`
   (linhas ~681 e ~712) — Seq Scan provavelmente continua.
4. Lembretes de compromisso pausados (jobid 6, confirmado `active: false` em 09-08) —
   decidir se/quando reativar; botão "Testar Lembretes" ainda envia de verdade.

**Segurança (da auditoria de 08-25)**
5. ~50 Edge Functions invocáveis sem auth (`zapi-send`, `zapi-bulk-campaign`,
   `zapsign`, `api-hub`, `isa-actions`, `facebook-leadads`…).
6. `admin-delete-user`/`admin-approve-invite` checam `perfis.cargo` em vez de `has_role()`.
7. Sem validação HMAC em `meta-leads-aereo-webhook`/`instagram-webhook`.
8. ~40 tabelas com `authenticated = tudo` (provavelmente intencional; decisão de design).

**Bugs conhecidos não corrigidos**
9. Botão "Sincronizar contatos" chama `sync-subscriber-names` (função apagada).
10. Cron `retomada-leads-frios-hourly` chama função inexistente 24×/dia.
11. `zapi-webhook` cria lead por telefone sem constraint única (lead duplicado + Isa
    abrindo 2×); `clicksign-webhook` sem idempotência; locks da Isa só em aplicação.
12. Dashboard (🟠 da auditoria 08-22): `RealtimeLeadsMonitor` atribui tudo a tráfego;
    `DashboardFilters` sem "Tráfego Pago"/"Escritório"; "Processos Ativos" conta
    arquivados; "Valor Convertido" varia por cargo sem aviso; taxa de conversão pode
    passar de 100%.
13. `HistoricoAcessosPage` calcula KPIs do dia só sobre 50 linhas.
14. `AgendaPrazosWidget` não tem prazo real (DJEN não calcula prazo) — decisão de produto.
15. Mobile: `MetaLeadsPage`, `FollowupPage` quebrados; `IntimacoesPage` overflow;
    `TarefasPage` DnD sem touch. Telas mobile de Processos/Leads/Intimações/Agenda/
    Tarefas/Contratos/Perfil ainda não feitas.
16. 11 pontos ainda com paginação sequencial (lista em memória de 08-25).

**Verificações pendentes (feito, mas nunca observado ao vivo)**
17. AppLayoutRoute (08-26), fetchAllPaginated (08-25), Tarefas↔Agenda (09-04),
    notificação processual com IA (09-02), push notifications (08-29), casco mobile
    logado (08-29), isa_documentos com lead real, PDF via OpenAI no isa-auto-process.
18. Alerta de prazo crítico + chat interno no `/chat`, e relatório de tarefas com
    processo/partes (09-07) — pedir smoke-test real (ver na tela de WhatsApp e gerar
    um relatório com tarefa vinculada a processo). Confirmar amanhã que os crons
    `intimacoes-manha/meio-dia/tarde` (10h/16h/21h UTC) voltaram a criar jobs sozinhos
    (a fila foi destravada e testada manualmente em 09-07, mas o primeiro ciclo 100%
    automático pós-fix ainda não rodou).
26. ~~Relatório de Leads (Sheets) — reconectar Drive + testar~~ — **RESOLVIDO
    em 09-10**: usuário reconectou e habilitou a API do Sheets; gerado e
    verificado ao vivo, formatação corrigida na sequência (ver linha do
    tempo 09-10). Fuso da audiência (Acre) continua em aberto — sem cliente
    real de UF=AC pra validar ao vivo com segurança; só vai se provar na
    próxima audiência real de lá (09-08).
27. ~~Chat interno: botão de gravar áudio em cima do enviar em `/chat`~~ —
    **RESOLVIDO em 09-09** (`5b9cd1c2`, ver linha do tempo). Usuário mandou
    print novo confirmando que persistia; causa real era o widget usar uma
    altura fixa pro compositor em vez de medir a altura real (que cresce com
    a prévia de áudio). Verificado ao vivo em produção.
28. Tarefas recorrentes (09-08) — testado manualmente ponta a ponta (function
    invocada à mão), mas nenhuma recorrência real foi criada pela UI ainda nem
    o cron das 04h Manaus rodou sozinho em produção. Pedir pro usuário criar
    uma de teste pela aba "Recorrentes" e confirmar no dia seguinte que gerou
    sozinha.
29. **Relatório de Leads (Sheets) não aparecia pra outros usuários** (09-08,
    usuário testou): pro dono da conta o botão já era o novo, pra colegas
    ainda parecia antigo. Investigado o mecanismo de auto-update do service
    worker (PWA) — código parece correto (versiona por timestamp de build,
    força reload com aviso às abas abertas, checa a cada 60s + em
    visibilitychange). Hipótese mais provável: colega só não tinha
    revisitado/dado refresh na tela desde os deploys de hoje — pedido pra
    tentar Ctrl+Shift+R. **Se persistir mesmo após refresh manual**, investigar
    mais a fundo o service worker (`public/sw.js`,
    `src/hooks/useServiceWorkerUpdate.ts`) — pode ser instância de PWA
    instalada que não estava rodando durante os deploys, ou outro caso de
    borda não coberto pelo mecanismo atual.

**Novo em 2026-09-09**
30. Separar os 27 leads misturados pelo bug do `api-hub` (ver linha do tempo
    09-09) — 6 confirmados por conteúdo real de mensagem, script de split
    pronto e ensaiado (`begin/rollback`), só falta decisão do usuário pra
    aplicar. Resto (falso-positivo ou dado de teste) não precisa de ação.
31. ~~Risco arquitetural: `useAuth()` chamado independente em ~40 arquivos~~
    — **RESOLVIDO em 09-09** (`996b827c`, ver linha do tempo). Virou Context
    único; nenhum dos ~40 arquivos precisou mudar.

**Novo em 2026-09-10**
32. **RESUMIR AQUI — Reestruturação do Gerador de Petições**: auditoria +
    Fase 2 (segurança/limpeza) + Fase 3 (versionamento) + Fase 4 (Layout
    Mestre) concluídas (ver linha do tempo 09-10). Falta a parte mais
    pesada: IA de análise estrutural + schema dinâmico rico (Fases 5-6),
    formulário dinâmico estendido + geração textual por IA + validador
    dados×gerado (Fases 7-9). Piloto: modelo único hoje em produção
    ("Peticao_documento"/"Venda Casada"). Contratos/Procuração confirmado
    fora de escopo (fica separado, decisão do usuário).
33. Versão mobile da página de Documentos (`documentos-mobile` no Figma) —
    specs/cores já puxadas do Figma real, só falta implementar (a versão
    desktop já foi redesenhada em 09-10).
34. ~~Redesenho das telas de Petições (dashboard, wizard, revisão) a partir
    do Figma real~~ — **concluído em 09-10** (desktop + mobile, incluindo
    modal full-screen e as 7 etapas do wizard verificadas campo a campo),
    ver linha do tempo.
35. Redesenho da Pipeline de Leads (Figma real) — cabeçalho, pílulas de
    etapa, Kanban board/cards e modais de Exportar/Relatório
    concluídos em 09-10 (ver linha do tempo). Falta: vistas "Cards" e
    "Lista" (visual antigo, sem frame no Figma), `LeadDetailModal.tsx`
    e versão mobile.
36. ~~`useIsaInsights`/`useLeadExtras` não escalam pra pipeline inteira~~
    — **corrigido em 09-10** (mesmo dia, sessão seguinte): `.in()`
    paginado em lotes de 150 IDs em `useIsaInsights`,
    `useLeadExtras` e `useLeadsProcessoCounts`; loop de criação de
    alerta duplicado removido de `useLeadExtras` (já feito certo pela
    Edge Function `isa-check-appointments`, cron a cada 2h). "Visual
    Board" voltou a ser o padrão da página, sem limite artificial. Ver
    linha do tempo.

**Em andamento (planos aprovados)**
19. Contratos/Procuração via templates + ZapSign nativo — Fases 4–9
    (`flickering-wibbling-spring.md`). Bloqueado no `ZAPSIGN_API_TOKEN` do
    Worker. Confirmado em 09-10: decisão do usuário é manter esse fluxo
    **separado** da reestruturação do gerador de petições (item 32).
20. ~~Petições com blocos dinâmicos — teste visual + Fase 3 no CRM~~ — WIP
    finalmente commitado em 09-10 (estava sem commit desde 08-27/08-30),
    mas Fase 3 (integrar no CRM) ainda não feita; ver item 32, que
    supersede este item dentro do plano maior de reestruturação.
21. Templatização: 6 dos 12 modelos antigos nunca convertidos (fluxo superado pelo
    motor novo; decidir se ainda vale converter).

**Área do Cliente**
22. `ESCRITORIO_WHATSAPP` com placeholder; tela "Falar com o escritório" não existe;
    domínio próprio; tradução leiga das movimentações; apagar o processo `[TESTE]`.

**Dados / decisões do usuário**
23. Backfill de `contract_signed_at` (626 contratos históricos sem data).
24. 82% dos contratos de tráfego assinados não têm processo aberto (gap operacional).

**Higiene**
25. `supabase/.temp/` sair do git; regenerar lockfile sem `lovable-tagger`; código
    morto (V1 de petições, `GerarContratoModal`, `meta-leads/`, `useChatSubscribers`).

---

## 5. Decisões de produto/arquitetura (não re-litigar sem o usuário)

| Decisão | Quando | Detalhe |
|---|---|---|
| Deploy é push pra `main` | sempre | Netlify + 2 workflows. Sem CLI local. |
| Escavador abandonado | 2026-08-22 | DJEN + DataJud são as fontes. Código do Escavador é candidato a limpeza, não a conserto. |
| Intimações "grátis e gradual" | 2026-07-13 | Não martelar o DJEN manualmente; foi isso que causou o primeiro bloqueio de IP. |
| `notificacao_ativa` manual por processo | 2026-07-13 | Não auto-ativar. |
| `linha_whatsapp` decide tráfego × escritório | 2026-07-16 | `origem`/`tipo_origem` só desempatam. |
| Dados pessoais do cliente ficam em `processos` | 2026-07 | Capturados em `ProcessoModalExpanded` (nome/CPF/nascimento). **Exceção**: qualificação/endereço pra contratos já vive em `leads_juridicos` — seguir o precedente que tem código funcionando. |
| Cal.com removido; online = sala Jitsi fixa | 2026-07-19 | Meet automático exige Workspace + DWD (não é código). |
| Isa roda só em OpenAI | 2026-08-17 | "ele deve usar o chat gpt". |
| Lembretes de compromisso pausados | 2026-08-25 | jobid 6. |
| Cliente do portal não é usuário Supabase Auth | 2026-08-29 | CPF + OTP WhatsApp, JWT próprio; service_role nunca sai do Supabase. |
| Mobile = mesmo web app, não React Native | 2026-08-29 | `useIsMobile()`. |
| Compromisso só vira tarefa se `origem='agenda'` | 2026-09-04 | Senão Tarefas viraria espelho da agenda de atendimentos. |
| Notificação processual sempre manda algo | 2026-09-02 | Novidade relevante ou "sem novidades". |
| Migration: mostrar SQL antes de pushar | 2026-08 | Pedido do usuário após incidente. |
