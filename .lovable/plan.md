

# Plano: Identificação Automática de Leads de Tráfego Pago

## Contexto
Quando um usuário clica em um anúncio "Click to WhatsApp" do Instagram/Facebook, o WhatsApp envia metadados especiais junto com a primeira mensagem (independente do que o cliente escrever). Esses metadados contêm:
- `context.ad` ou `referral`: dados do anúncio (ad_id, campaign, source)
- `ctwa_clid`: token de atribuição CTWA (Click to WhatsApp Attribution ID)

O Z-API captura esses dados e os envia no payload do webhook. Atualmente o sistema ignora esses campos.

---

## Solução: Detectar e Categorizar Automaticamente

### 1. Campos de Rastreamento (Já existem no banco)
Os campos necessários já existem na tabela `leads_juridicos`:
- `tipo_origem`: 'trafego' | 'whatsapp_direto' | 'indefinido'
- `fonte_trafego`: string livre (ex: 'facebook_ads', 'instagram_ads')
- `canal_origem`: string livre (ex: 'whatsapp', 'instagram')

---

### 2. Atualizar zapi-webhook para Detectar Tráfego

Modificar `supabase/functions/zapi-webhook/index.ts` para:

**A) Extrair metadados de anúncio no normalizeZapiEvent:**

```text
Campos do Z-API a verificar:
- body.context.ad        → dados do anúncio Meta
- body.referral          → formato alternativo
- body.context.ctwa_clid → token de atribuição
- body.ad                → alguns provedores usam esse formato
```

**B) Atualizar lógica de criação de lead:**

```text
SE existe context.ad OU referral OU ctwa_clid:
  → tipo_origem = 'trafego'
  → fonte_trafego = detectar_plataforma(ad.source)  // 'instagram_ads', 'facebook_ads'
  → canal_origem = 'whatsapp'
  → Salvar metadata do anúncio para analytics

SENÃO:
  → tipo_origem = 'whatsapp_direto'
  → fonte_trafego = 'organico'
  → canal_origem = 'whatsapp'
```

---

### 3. Atualizar Lead Existente se Metadados Chegarem Depois

Às vezes o Z-API pode enviar o `context.ad` em uma mensagem subsequente (não na primeira). Por isso, também precisamos:

```text
SE lead já existe E tem tipo_origem='indefinido' E detectamos metadados de anúncio:
  → Atualizar para tipo_origem='trafego'
```

---

### 4. Registrar Log de Atribuição

Criar registro em `system_events` quando detectar tráfego pago:

```text
{
  tipo: 'atribuicao',
  fonte: 'meta_ads',
  acao: 'lead_from_ctwa',
  dados: {
    ad_id: string,
    campaign: string,
    source: 'instagram' | 'facebook',
    ctwa_clid: string
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/zapi-webhook/index.ts` | Detectar `context.ad`, `referral`, `ctwa_clid` no normalizeZapiEvent e usar na categorização |
| `supabase/functions/zapi-webhook/index.ts` | Atualizar `findOrCreateLead` para usar detecção de tráfego |
| `supabase/functions/zapi-webhook/index.ts` | Atualizar lead existente se metadados chegarem depois |

---

## Detalhes Técnicos

### Estrutura esperada do payload Z-API com anúncio:

```json
{
  "phone": "5592991234567",
  "text": { "message": "Olá, quero saber mais" },
  "context": {
    "ad": {
      "title": "Advogado Previdenciário",
      "body": "Aposentadoria negada? Fale conosco",
      "source": {
        "id": "123456789",
        "type": "ad",
        "url": "https://fb.me/..."
      },
      "ctwa": "ARA...token"
    }
  }
}
```

### Lógica de detecção:

```typescript
function detectTrafficSource(body: any): {
  isTraffic: boolean;
  source: string | null;
  adData: any | null;
} {
  // Verificar múltiplos formatos possíveis
  const adContext = body.context?.ad || body.referral || body.ad;
  const ctwaClid = body.context?.ctwa_clid || body.ctwa_clid || adContext?.ctwa;
  
  if (adContext || ctwaClid) {
    // Detectar plataforma
    let source = 'meta_ads';
    const adSource = adContext?.source?.type?.toLowerCase() || '';
    const bodyStr = JSON.stringify(body).toLowerCase();
    
    if (bodyStr.includes('instagram')) source = 'instagram_ads';
    else if (bodyStr.includes('facebook')) source = 'facebook_ads';
    
    return {
      isTraffic: true,
      source,
      adData: { adContext, ctwaClid }
    };
  }
  
  return { isTraffic: false, source: null, adData: null };
}
```

---

## Benefícios

1. **Detecção automática** - Zero configuração manual para cada lead
2. **Segmentação correta** - Leads de tráfego vão para aba "Tráfego" automaticamente
3. **Isa focada** - Só processa leads vindos de campanhas
4. **Analytics** - Dados de atribuição salvos para medir ROI das campanhas
5. **Retroativo** - Leads indefinidos são atualizados se metadados chegarem depois

---

## Próximos Passos (Após Implementação)

1. **Testar com anúncio real** - Criar um anúncio de teste no Instagram
2. **Verificar logs** - Checar se `context.ad` está sendo recebido
3. **Validar categorização** - Confirmar que leads estão sendo marcados como 'trafego'

