import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, FileText, Webhook, Bot, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1';

const apiDocumentation = `
# API DE INTEGRAÇÃO - CRM JURÍDICO BENTES RAMOS

## VISÃO GERAL
Sistema de CRM jurídico com automação de follow-ups via ManyChat/WhatsApp.
Base URL: ${API_BASE_URL}

---

## 1. API HUB - RECEBIMENTO DE LEADS
Endpoint principal para receber novos leads de qualquer fonte externa.

**URL:** POST ${API_BASE_URL}/api-hub
**Autenticação:** Não requerida (público)

### Headers:
\`\`\`
Content-Type: application/json
x-integration-source: [nome_da_fonte] (ex: "manychat", "zapier", "whatsapp")
\`\`\`

### Body (JSON):
\`\`\`json
{
  "nome": "Nome do Cliente",
  "telefone": "+5511999999999",
  "email": "cliente@email.com",
  "tipo_acao": "Trabalhista",
  "valor_causa": 50000,
  "origem": "ManyChat",
  "resumo_ia": "Resumo do caso gerado por IA",
  "subscriber_id": "manychat_subscriber_id"
}
\`\`\`

### Campos obrigatórios:
- nome OU telefone (pelo menos um)

### Campos opcionais:
- email, tipo_acao, valor_causa, origem, resumo_ia, subscriber_id

### Resposta de sucesso (200):
\`\`\`json
{
  "success": true,
  "lead": { "id": "uuid", "nome": "...", ... },
  "followup_created": true
}
\`\`\`

---

## 2. MANYCHAT WEBHOOK
Recebe eventos e mensagens do ManyChat.

**URL:** POST ${API_BASE_URL}/manychat-webhook
**Autenticação:** Não requerida

### Body (JSON):
\`\`\`json
{
  "type": "message",
  "subscriber": {
    "id": "123456789",
    "first_name": "João",
    "last_name": "Silva",
    "phone": "+5511999999999",
    "email": "joao@email.com",
    "profile_pic": "https://..."
  },
  "message": {
    "text": "Quero consultar sobre meu caso",
    "type": "text"
  }
}
\`\`\`

### Tipos de evento:
- "message": Nova mensagem recebida
- "subscriber_created": Novo subscriber
- "subscriber_updated": Dados atualizados
- "flow_completed": Fluxo concluído

---

## 3. AUTOMAÇÃO DE FOLLOW-UPS
Sistema automático de reengajamento de leads frios.

### Como funciona:
1. Lead é criado via API Hub → Follow-up é registrado automaticamente
2. Após 10 minutos: Envia 1º follow-up (card com botões)
3. Após 1 hora: Envia 2º follow-up (urgência moderada)
4. Após 24 horas: Envia 3º follow-up (última tentativa)

### Templates das mensagens:
**Follow-up 1 (10min):**
"Olá! Percebi que começamos uma conversa sobre seu caso. Estou aqui para ajudar! Posso esclarecer algo?"
Botões: ["✅ Sim, tenho dúvidas", "📞 Quero uma ligação", "⏰ Falar depois"]

**Follow-up 2 (1h):**
"Seu caso é importante para nós! Temos horários disponíveis hoje para uma consulta gratuita."
Botões: ["📅 Agendar agora", "💬 Falar no WhatsApp", "ℹ️ Mais informações"]

**Follow-up 3 (24h):**
"Última mensagem: estamos guardando seu atendimento prioritário por mais 24h."
Botões: ["🎯 Quero aproveitar", "📱 Me ligue", "❌ Não tenho interesse"]

### Endpoint interno (requer JWT):
**URL:** POST ${API_BASE_URL}/followup-automation
**Uso:** Executado automaticamente via cron job a cada minuto

---

## 4. MANYCHAT - ENVIO DE MENSAGENS
Para enviar mensagens de volta ao ManyChat.

**URL:** POST ${API_BASE_URL}/manychat
**Autenticação:** Requer MANYCHAT_API_KEY configurada no servidor

### Body:
\`\`\`json
{
  "action": "sendMessage",
  "subscriber_id": "123456789",
  "message": "Texto da mensagem",
  "buttons": [
    {"title": "Botão 1", "url": "https://..."},
    {"title": "Botão 2", "payload": "action_2"}
  ]
}
\`\`\`

---

## 5. CLICKSIGN WEBHOOK
Recebe eventos de assinatura de contratos.

**URL:** POST ${API_BASE_URL}/clicksign-webhook
**Autenticação:** Não requerida

### Eventos suportados:
- "document.signed": Documento assinado por uma parte
- "document.finished": Todas as partes assinaram
- "document.canceled": Documento cancelado

---

## 6. TABELA DE STATUS DE LEADS

| Status | Descrição |
|--------|-----------|
| Lead Frio | Primeiro contato, aguardando follow-up |
| Lead Morno | Demonstrou interesse inicial |
| Lead Quente | Alto interesse, pronto para conversão |
| Reunião Agendada | Consulta marcada |
| Negociação | Em discussão de valores |
| Contratado | Cliente fechado |
| Perdido | Não converteu |

---

## 7. EXEMPLO COMPLETO - INTEGRAÇÃO MANYCHAT

### Configuração no ManyChat:
1. Vá em Settings → Integrations → Webhooks
2. Adicione webhook: ${API_BASE_URL}/manychat-webhook
3. Configure triggers: "Message Received", "Flow Completed"

### Fluxo no ManyChat para captura de lead:
\`\`\`
[Trigger: User Input]
    ↓
[Collect: Nome, Telefone, Tipo de Caso]
    ↓
[Action: External Request]
    URL: ${API_BASE_URL}/api-hub
    Method: POST
    Headers: 
      Content-Type: application/json
      x-integration-source: manychat
    Body:
      {
        "nome": "{{first_name}} {{last_name}}",
        "telefone": "{{phone}}",
        "email": "{{email}}",
        "tipo_acao": "{{custom_field_tipo_caso}}",
        "origem": "ManyChat",
        "subscriber_id": "{{user_id}}"
      }
    ↓
[Message: Obrigado! Em breve entraremos em contato.]
\`\`\`

---

## 8. CÓDIGOS DE RESPOSTA

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 400 | Dados inválidos ou faltando |
| 401 | Não autorizado |
| 500 | Erro interno do servidor |

---

## 9. VARIÁVEIS DE AMBIENTE NECESSÁRIAS
(Configuradas no Supabase Edge Functions)

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- MANYCHAT_API_KEY
- OPENAI_API_KEY (para resumos IA)

---

## 10. CONTATO E SUPORTE
Para dúvidas sobre a integração, entre em contato com a equipe técnica.
`;

export default function ApiDocsPage() {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const copyFullDoc = () => {
    navigator.clipboard.writeText(apiDocumentation);
    toast.success('Documentação completa copiada!');
  };

  return (
    <AppLayout>
      <AppHeader title="Documentação da API" />
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 overflow-hidden">
        <Tabs defaultValue="texto" className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="texto" className="gap-2">
                <FileText className="h-4 w-4" />
                Texto para IA
              </TabsTrigger>
              <TabsTrigger value="endpoints" className="gap-2">
                <Webhook className="h-4 w-4" />
                Endpoints
              </TabsTrigger>
            </TabsList>
            
            <Button onClick={copyFullDoc} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar Tudo
            </Button>
          </div>

          <TabsContent value="texto" className="flex-1 m-0">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Documentação em Texto (para IAs)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Copie este texto e cole na memória/contexto da sua IA para ela entender como integrar com o sistema.
                </p>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                <ScrollArea className="h-full border rounded-md p-4 bg-muted/30">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                    {apiDocumentation}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="flex-1 m-0">
            <div className="grid gap-4 md:grid-cols-2">
              <EndpointCard
                title="API Hub - Receber Leads"
                method="POST"
                url={`${API_BASE_URL}/api-hub`}
                description="Endpoint principal para receber leads de qualquer fonte externa."
                onCopy={copyToClipboard}
              />
              <EndpointCard
                title="ManyChat Webhook"
                method="POST"
                url={`${API_BASE_URL}/manychat-webhook`}
                description="Recebe eventos e mensagens do ManyChat."
                onCopy={copyToClipboard}
              />
              <EndpointCard
                title="Follow-up Automation"
                method="POST"
                url={`${API_BASE_URL}/followup-automation`}
                description="Processa e envia follow-ups automáticos (executado via cron)."
                onCopy={copyToClipboard}
              />
              <EndpointCard
                title="Clicksign Webhook"
                method="POST"
                url={`${API_BASE_URL}/clicksign-webhook`}
                description="Recebe eventos de assinatura de contratos."
                onCopy={copyToClipboard}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EndpointCard({ 
  title, 
  method, 
  url, 
  description,
  onCopy 
}: { 
  title: string; 
  method: string; 
  url: string; 
  description: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-0.5 rounded">
            {method}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted p-2 rounded truncate font-mono">
            {url}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onCopy(url, 'URL')}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
