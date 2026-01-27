
# Plano: Separação de Contatos por Origem (Tráfego vs WhatsApp Direto)

## Contexto do Problema
Atualmente os leads do escritório que mandam mensagem direto pelo WhatsApp (clientes legados) se misturam com leads que vêm de campanhas de tráfego pago. Isso dificulta a gestão e faz a Isa processar contatos que não deveria.

### Análise dos Dados Atuais:
- **118 contatos** sem fonte de tráfego definida (legados/WhatsApp direto)
- **17 contatos** com fonte de tráfego orgânico/WhatsApp
- Campo `fonte_trafego` pode ser: `organico`, `trafego_pago`, `instagram`, `google_ads`, etc.
- Campo `canal_origem` pode ser: `whatsapp`, `instagram`, `facebook`, etc.

---

## Solução Proposta

### 1. Novo Campo de Categorização Explícita

Adicionar um campo `tipo_origem` na tabela `leads_juridicos` que classifica cada lead em uma das categorias:

| Valor | Descrição |
|-------|-----------|
| `trafego` | Lead oriundo de campanhas de marketing (Instagram Ads, Google Ads, etc.) |
| `whatsapp_direto` | Contato direto pelo WhatsApp do escritório (cliente antigo ou indicação) |
| `indefinido` | Leads ainda não categorizados |

---

### 2. Interface de Separação no Chat (Principal)

Na página `/chat`, adicionar abas ou filtros para separar as conversas:

```text
┌─────────────────────────────────────────────────────────────┐
│  [🎯 Tráfego]  [💬 WhatsApp Direto]  [📋 Todos]            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Lista de conversas filtradas por tipo                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Aba "Tráfego" mostra apenas leads de campanhas (Isa atende automaticamente)
- Aba "WhatsApp Direto" mostra clientes legados (atendimento manual)
- Aba "Todos" mostra tudo junto (visão completa)

---

### 3. Kanban com Filtro por Origem

Na página `/leads`, adicionar um novo filtro no `LeadFilters.tsx`:

```text
┌──────────────────────────────────────────────────────────────┐
│  🔍 Buscar...  │ Tipo de Ação ▼ │ Faixa de Valor ▼ │ Origem ▼│
│                                                   ┌──────────┤
│                                                   │ Todos    │
│                                                   │ Tráfego  │
│                                                   │ WhatsApp │
│                                                   │ Direto   │
│                                                   └──────────┘
└──────────────────────────────────────────────────────────────┘
```

---

### 4. Badge Visual no Card do Lead

Nos cards do Kanban (`LeadCard.tsx`), exibir um badge indicando a origem:

- 🎯 Badge azul: "Tráfego" - lead de campanha
- 💬 Badge cinza: "Direto" - WhatsApp direto do escritório

---

### 5. Dashboard com Métricas Separadas

No Dashboard, adicionar KPIs separados:

| Métrica | Descrição |
|---------|-----------|
| Leads de Tráfego | Total de leads de campanhas |
| Leads Diretos | Total de contatos WhatsApp direto |
| Conversão por Origem | Taxa de conversão segmentada |

---

### 6. Atualização Automática da Categorização

A Edge Function `zapi-webhook` vai categorizar automaticamente:

- Se `fonte_trafego` contém `trafego_pago`, `instagram`, `google_ads`, `facebook_ads` → `trafego`
- Se `canal_origem` é `whatsapp` e `fonte_trafego` é `organico` ou vazio → `whatsapp_direto`
- Leads antigos (30+ dias sem fonte) → `whatsapp_direto`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Adicionar coluna `tipo_origem` |
| `src/types/leads.ts` | Adicionar tipo `TipoOrigem` |
| `src/components/leads/LeadFilters.tsx` | Novo filtro por origem |
| `src/components/kanban/LeadCard.tsx` | Badge visual de origem |
| `src/components/manychat/ChatInbox.tsx` | Abas de filtragem no chat |
| `src/components/dashboard/DashboardKPIs.tsx` | Métricas segmentadas |
| `supabase/functions/zapi-webhook/index.ts` | Categorização automática |
| `supabase/functions/isa-auto-process/index.ts` | Usar novo campo |

---

## Benefícios

1. **Gestão clara**: Atendentes veem imediatamente se é cliente de campanha ou do escritório
2. **Isa focada**: Processa apenas leads de tráfego automaticamente
3. **Métricas precisas**: ROI de campanhas separado de atendimentos orgânicos
4. **Workflow otimizado**: Priorização correta de cada tipo de contato
5. **Histórico preservado**: Leads existentes serão categorizados automaticamente

---

## Detalhes Técnicos

### Migration SQL
```sql
-- Adicionar coluna tipo_origem
ALTER TABLE leads_juridicos 
ADD COLUMN tipo_origem TEXT DEFAULT 'indefinido';

-- Atualizar leads existentes baseado na lógica atual
UPDATE leads_juridicos
SET tipo_origem = CASE
  WHEN fonte_trafego IN ('trafego_pago', 'instagram', 'google_ads', 'facebook_ads') THEN 'trafego'
  WHEN canal_origem IN ('instagram', 'facebook', 'google') THEN 'trafego'
  WHEN created_at < NOW() - INTERVAL '30 days' AND (fonte_trafego IS NULL OR fonte_trafego = '') THEN 'whatsapp_direto'
  WHEN fonte_trafego = 'organico' AND canal_origem = 'whatsapp' THEN 'whatsapp_direto'
  ELSE 'indefinido'
END;
```

### Tipo TypeScript
```typescript
export type TipoOrigem = 'trafego' | 'whatsapp_direto' | 'indefinido';
```
