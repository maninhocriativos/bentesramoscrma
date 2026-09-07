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

---

## 4. Pendências abertas (consolidado em 2026-09-07)

Ordem aproximada de prioridade. Ao fechar uma, mova pra linha do tempo com a data.

**Risco de perda / operação**
1. `peticoes-cloudflare` e `peticoes-modelos-admin`: WIP de blocos dinâmicos (08-30) e
   contratos ZapSign (08-28) **sem commit há 10 dias**; os 3 Workers **sem remoto no
   GitHub**. Commitar, criar repos, pushar.
2. DJEN geoblock: intimações por OAB e por CNJ dependem de IP brasileiro. **Usuário
   precisa provisionar VPS BR**; depois: proxy + `DJEN_PROXY_URL` em `intimacoes-oab`
   e `processo-djen-sync`; remover bloco Escavador V1/V2 de `intimacoes-oab`.
3. Fatura do Supabase em aberto (aviso visto em 08-25) — confirmar se foi paga.
4. `zapi-webhook` ainda consulta `metadata->>message_id` em vez de `message_id_key`
   (linhas ~681 e ~712) — Seq Scan provavelmente continua.
5. Lembretes de compromisso pausados (jobid 6) — decidir se/quando reativar; botão
   "Testar Lembretes" ainda envia de verdade.

**Segurança (da auditoria de 08-25)**
6. ~50 Edge Functions invocáveis sem auth (`zapi-send`, `zapi-bulk-campaign`,
   `zapsign`, `api-hub`, `isa-actions`, `facebook-leadads`…).
7. `admin-delete-user`/`admin-approve-invite` checam `perfis.cargo` em vez de `has_role()`.
8. Sem validação HMAC em `meta-leads-aereo-webhook`/`instagram-webhook`.
9. ~40 tabelas com `authenticated = tudo` (provavelmente intencional; decisão de design).

**Bugs conhecidos não corrigidos**
10. Botão "Sincronizar contatos" chama `sync-subscriber-names` (função apagada).
11. Cron `retomada-leads-frios-hourly` chama função inexistente 24×/dia.
12. `zapi-webhook` cria lead por telefone sem constraint única (lead duplicado + Isa
    abrindo 2×); `clicksign-webhook` sem idempotência; locks da Isa só em aplicação.
13. Dashboard (🟠 da auditoria 08-22): `RealtimeLeadsMonitor` atribui tudo a tráfego;
    `DashboardFilters` sem "Tráfego Pago"/"Escritório"; "Processos Ativos" conta
    arquivados; "Valor Convertido" varia por cargo sem aviso; taxa de conversão pode
    passar de 100%.
14. `HistoricoAcessosPage` calcula KPIs do dia só sobre 50 linhas.
15. `AgendaPrazosWidget` não tem prazo real (DJEN não calcula prazo) — decisão de produto.
16. Mobile: `MetaLeadsPage`, `FollowupPage` quebrados; `IntimacoesPage` overflow;
    `TarefasPage` DnD sem touch. Telas mobile de Processos/Leads/Intimações/Agenda/
    Tarefas/Contratos/Perfil ainda não feitas.
17. 11 pontos ainda com paginação sequencial (lista em memória de 08-25).

**Verificações pendentes (feito, mas nunca observado ao vivo)**
18. AppLayoutRoute (08-26), fetchAllPaginated (08-25), Tarefas↔Agenda (09-04),
    notificação processual com IA (09-02), push notifications (08-29), casco mobile
    logado (08-29), isa_documentos com lead real, PDF via OpenAI no isa-auto-process.
26. Alerta de prazo crítico + chat interno no `/chat`, e relatório de tarefas com
    processo/partes (09-07) — pedir smoke-test real (ver na tela de WhatsApp e gerar
    um relatório com tarefa vinculada a processo). Confirmar amanhã que os crons
    `intimacoes-manha/meio-dia/tarde` (10h/16h/21h UTC) voltaram a criar jobs sozinhos
    (a fila foi destravada e testada manualmente em 09-07, mas o primeiro ciclo 100%
    automático pós-fix ainda não rodou).

**Em andamento (planos aprovados)**
19. Contratos/Procuração via templates + ZapSign nativo — Fases 4–9
    (`flickering-wibbling-spring.md`). Bloqueado no `ZAPSIGN_API_TOKEN` do Worker.
20. Petições com blocos dinâmicos — teste visual + Fase 3 no CRM
    (`imperative-conjuring-frog.md`).
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
