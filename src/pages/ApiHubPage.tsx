import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSystemEvents, SystemEvent } from '@/hooks/useSystemEvents';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Activity, 
  Webhook, 
  MessageSquare, 
  FileSignature, 
  Zap, 
  RefreshCw,
  Copy,
  ExternalLink,
  Trash2,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const FONTE_ICONS: Record<string, any> = {
  manychat: MessageSquare,
  clicksign: FileSignature,
  zapier: Zap,
  make: Zap,
  n8n: Zap,
  whatsapp: MessageSquare,
  sistema: Activity,
  'api-hub': Webhook
};

const FONTE_COLORS: Record<string, string> = {
  manychat: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  clicksign: 'bg-green-500/10 text-green-500 border-green-500/30',
  zapier: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  make: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  n8n: 'bg-red-500/10 text-red-500 border-red-500/30',
  whatsapp: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  sistema: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  'api-hub': 'bg-primary/10 text-primary border-primary/30'
};

const TIPO_COLORS: Record<string, string> = {
  webhook: 'bg-blue-500',
  contrato: 'bg-green-500',
  lead_status: 'bg-yellow-500',
  interacao: 'bg-purple-500',
  mensagem: 'bg-cyan-500',
  sistema: 'bg-gray-500'
};

export default function ApiHubPage() {
  const { toast } = useToast();
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [fonteFilter, setFonteFilter] = useState<string>('');
  
  const { events, stats, loading, fetchEvents, clearEvents } = useSystemEvents({
    tipo: tipoFilter || undefined,
    fonte: fonteFilter || undefined,
    limit: 200
  });

  const baseUrl = 'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/api-hub';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'URL copiada para a área de transferência' });
  };

  const webhookEndpoints = [
    { 
      name: 'ManyChat', 
      path: '/webhook/manychat', 
      description: 'Recebe mensagens e eventos do ManyChat',
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    { 
      name: 'Clicksign', 
      path: '/webhook/clicksign', 
      description: 'Recebe eventos de assinatura de contratos',
      icon: FileSignature,
      color: 'text-green-500'
    },
    { 
      name: 'Automações', 
      path: '/webhook/automation', 
      description: 'Zapier, Make, n8n e outras automações',
      icon: Zap,
      color: 'text-orange-500'
    },
    { 
      name: 'WhatsApp', 
      path: '/webhook/whatsapp', 
      description: 'Recebe mensagens do WhatsApp Business',
      icon: MessageSquare,
      color: 'text-emerald-500'
    }
  ];

  return (
    <AppLayout>
      <AppHeader title="API Hub - Central de Integrações" />
      
      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto animate-fade-in">
        <Tabs defaultValue="monitor" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="monitor" className="gap-2">
              <Activity className="w-4 h-4" />
              Monitor
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <FileSignature className="w-4 h-4" />
              Docs
            </TabsTrigger>
          </TabsList>

          {/* Monitor Tab */}
          <TabsContent value="monitor" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Eventos (24h)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {Object.entries(stats?.by_fonte || {}).slice(0, 3).map(([fonte, count]) => (
                <Card key={fonte}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", FONTE_COLORS[fonte]?.split(' ')[0])}>
                        {(() => {
                          const Icon = FONTE_ICONS[fonte] || Activity;
                          return <Icon className="w-5 h-5" />;
                        })()}
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground capitalize">{fonte}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtros:</span>
                  </div>
                  
                  <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os tipos</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="lead_status">Status Lead</SelectItem>
                      <SelectItem value="interacao">Interação</SelectItem>
                      <SelectItem value="mensagem">Mensagem</SelectItem>
                      <SelectItem value="sistema">Sistema</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={fonteFilter} onValueChange={setFonteFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Fonte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as fontes</SelectItem>
                      <SelectItem value="manychat">ManyChat</SelectItem>
                      <SelectItem value="clicksign">Clicksign</SelectItem>
                      <SelectItem value="zapier">Zapier</SelectItem>
                      <SelectItem value="make">Make</SelectItem>
                      <SelectItem value="n8n">n8n</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sistema">Sistema</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex-1" />

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchEvents()}
                    disabled={loading}
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                    Atualizar
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => clearEvents()}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar antigos
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Events List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Eventos em Tempo Real
                </CardTitle>
                <CardDescription>
                  Monitoramento ao vivo de todas as integrações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {events.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum evento encontrado</p>
                        <p className="text-sm">Os eventos aparecerão aqui em tempo real</p>
                      </div>
                    ) : (
                      events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Endpoints de Webhook</CardTitle>
                <CardDescription>
                  Configure estes URLs nas suas ferramentas de automação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {webhookEndpoints.map((endpoint) => (
                  <div 
                    key={endpoint.path}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className={cn("p-3 rounded-lg bg-muted", endpoint.color)}>
                      <endpoint.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{endpoint.name}</h4>
                      <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                        {baseUrl}{endpoint.path}
                      </code>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(`${baseUrl}${endpoint.path}`)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* API Base URL */}
            <Card>
              <CardHeader>
                <CardTitle>URL Base da API</CardTitle>
                <CardDescription>
                  Use esta URL para todas as integrações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input 
                    value={baseUrl} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button onClick={() => copyToClipboard(baseUrl)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Docs Tab */}
          <TabsContent value="docs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documentação da API</CardTitle>
                <CardDescription>
                  Como integrar suas automações
                </CardDescription>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <h3>Autenticação</h3>
                <p>Os webhooks não requerem autenticação. Para endpoints protegidos, use o header <code>Authorization: Bearer YOUR_TOKEN</code></p>

                <h3>ManyChat</h3>
                <p>Configure a URL do webhook nas ações do seu fluxo:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST ${baseUrl}/webhook/manychat
Content-Type: application/json

{
  "subscriber_id": "123456",
  "name": "João Silva",
  "phone": "+5511999999999",
  "last_input_text": "Mensagem do usuário"
}`}
                </pre>

                <h3>Clicksign</h3>
                <p>Configure o webhook no painel da Clicksign para receber eventos de assinatura:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST ${baseUrl}/webhook/clicksign
Content-Type: application/json

{
  "event": {
    "name": "sign"
  },
  "document": {
    "key": "document-key-123"
  }
}`}
                </pre>

                <h3>Zapier / Make / n8n</h3>
                <p>Use o endpoint de automação para ações personalizadas:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST ${baseUrl}/webhook/automation
Content-Type: application/json

{
  "action": "create_lead",
  "nome": "Novo Lead",
  "email": "lead@email.com",
  "telefone": "+5511999999999",
  "origem": "zapier"
}

// Ações disponíveis:
// - create_lead: Cria um novo lead
// - update_lead: Atualiza um lead existente
// - create_interaction: Cria uma interação`}
                </pre>

                <h3>WhatsApp</h3>
                <p>Configure o webhook para receber mensagens:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`POST ${baseUrl}/webhook/whatsapp
Content-Type: application/json

{
  "from": "+5511999999999",
  "text": "Mensagem recebida",
  "profile": {
    "name": "Nome do Contato"
  }
}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EventCard({ event }: { event: SystemEvent }) {
  const Icon = FONTE_ICONS[event.fonte] || Activity;
  const fonteColor = FONTE_COLORS[event.fonte] || FONTE_COLORS.sistema;
  const tipoColor = TIPO_COLORS[event.tipo] || TIPO_COLORS.sistema;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
      <div className={cn("p-2 rounded-lg shrink-0", fonteColor)}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium capitalize">{event.fonte}</span>
          <Badge variant="outline" className="text-xs">
            {event.acao}
          </Badge>
          <div className={cn("w-2 h-2 rounded-full", tipoColor)} />
          <span className="text-xs text-muted-foreground">{event.tipo}</span>
          
          {event.erro && (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="w-3 h-3 mr-1" />
              Erro
            </Badge>
          )}
        </div>
        
        {event.leads_juridicos?.nome && (
          <p className="text-sm text-muted-foreground">
            Lead: {event.leads_juridicos.nome}
          </p>
        )}
        
        {event.entidade_tipo && (
          <p className="text-xs text-muted-foreground">
            {event.entidade_tipo} {event.entidade_id ? `(${event.entidade_id.slice(0, 8)}...)` : ''}
          </p>
        )}

        {event.erro && (
          <p className="text-xs text-destructive mt-1">{event.erro}</p>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground shrink-0">
        {format(new Date(event.created_at), "HH:mm:ss", { locale: ptBR })}
        <br />
        <span className="text-[10px]">
          {format(new Date(event.created_at), "dd/MM", { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
