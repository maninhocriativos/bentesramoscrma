import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Key, Webhook, ExternalLink, Eye, EyeOff, Save, MessageSquare, CreditCard, FileSignature, Clock, Zap, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'active' | 'coming-soon' | 'inactive';
  children?: React.ReactNode;
  color: string;
}

function IntegrationCard({ icon, title, description, status, children, color }: IntegrationCardProps) {
  return (
    <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden transition-all hover:shadow-enterprise">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${color}`}>
              {icon}
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <Badge 
            variant={status === 'active' ? 'default' : 'secondary'}
            className={status === 'coming-soon' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : ''}
          >
            {status === 'active' ? 'Ativo' : status === 'coming-soon' ? 'Em breve' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      {children && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export function IntegracoesTab() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [zapiToken, setZapiToken] = useState('');
  const [asaasToken, setAsaasToken] = useState('');
  const [showZapi, setShowZapi] = useState(false);
  const [showAsaas, setShowAsaas] = useState(false);

  const SUPABASE_URL = 'https://qgenaltkjtlvwfgykpxq.supabase.co/rest/v1/leads_juridicos';
  const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjI1NzAsImV4cCI6MjA2NDczODU3MH0.DgXi_2D3fVNDWMvz9M3aSIbY58FEJc3dTz05kfH_Mew';

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: 'Copiado!', description: 'Conteúdo copiado para a área de transferência.' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const jsonExample = `{
  "nome": "{{nome_do_lead}}",
  "telefone": "{{telefone}}",
  "email": "{{email}}",
  "origem": "ManyChat",
  "status": "Lead Frio"
}`;

  const handleSaveTokens = () => {
    toast({ 
      title: 'Tokens salvos!', 
      description: 'Os tokens foram salvos com sucesso.',
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Header Section */}
        <div className="flex items-center gap-3 pb-2 border-b border-border/50">
          <div className="p-2 bg-gold/20 rounded-lg">
            <Zap className="h-5 w-5 text-gold-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Integrações</h2>
            <p className="text-sm text-muted-foreground">Configure APIs e automações externas</p>
          </div>
        </div>

        {/* Webhook Section */}
        <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
                <Webhook className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Recebimento de Leads</CardTitle>
                <CardDescription className="text-primary-foreground/80 text-sm">
                  Configure o ManyChat ou outras automações para enviar leads automaticamente
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* URL do Endpoint */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                URL do Endpoint (POST)
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Use esta URL para enviar requisições POST com os dados do lead</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input 
                    readOnly 
                    value={SUPABASE_URL}
                    className="font-mono text-xs bg-muted/30 pr-10 truncate"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(SUPABASE_URL, 'url')}
                  className="shrink-0 hover:bg-gold/10 hover:border-gold"
                >
                  {copiedField === 'url' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Headers */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Headers Obrigatórios</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Content-Type</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 hover:bg-gold/10"
                      onClick={() => copyToClipboard('application/json', 'content-type')}
                    >
                      {copiedField === 'content-type' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <code className="text-sm font-mono text-foreground block">application/json</code>
                </div>
                <div className="p-4 bg-muted/20 rounded-xl border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">apikey</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 hover:bg-gold/10"
                      onClick={() => copyToClipboard(API_KEY, 'apikey')}
                    >
                      {copiedField === 'apikey' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <code className="text-xs font-mono text-foreground break-all line-clamp-2">{API_KEY.substring(0, 40)}...</code>
                </div>
              </div>
            </div>

            {/* JSON Body */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Corpo da Requisição (JSON)</Label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(jsonExample, 'json')}
                  className="h-8 text-xs hover:bg-gold/10 hover:border-gold"
                >
                  {copiedField === 'json' ? <Check className="h-3 w-3 mr-1.5" /> : <Copy className="h-3 w-3 mr-1.5" />}
                  Copiar JSON
                </Button>
              </div>
              <pre className="p-4 bg-primary/95 text-primary-foreground rounded-xl text-sm font-mono overflow-x-auto leading-relaxed">
                {jsonExample}
              </pre>
            </div>

            {/* Campos disponíveis */}
            <div className="p-4 bg-gold/5 border border-gold/20 rounded-xl">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-gold-foreground" />
                Campos Disponíveis
              </h4>
              <div className="flex flex-wrap gap-2">
                {['nome', 'telefone', 'email', 'origem', 'status', 'resumo_ia', 'link_contrato'].map((campo) => (
                  <Badge 
                    key={campo} 
                    variant="outline" 
                    className="font-mono text-xs bg-card hover:bg-muted cursor-default"
                  >
                    {campo}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Integrations Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Z-API */}
          <IntegrationCard
            icon={<MessageSquare className="h-5 w-5 text-green-600" />}
            title="Z-API"
            description="Automação de WhatsApp"
            status="coming-soon"
            color="bg-green-50"
          >
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="zapi" className="text-xs font-medium flex items-center gap-2">
                  Token de Acesso
                  <a 
                    href="https://z-api.io" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Label>
                <div className="relative">
                  <Input 
                    id="zapi"
                    type={showZapi ? 'text' : 'password'}
                    value={zapiToken}
                    onChange={(e) => setZapiToken(e.target.value)}
                    placeholder="Cole seu token aqui..."
                    className="pr-10 font-mono text-xs h-9"
                    disabled
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowZapi(!showZapi)}
                    disabled
                  >
                    {showZapi ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Mensagens automáticas via WhatsApp
              </p>
            </div>
          </IntegrationCard>

          {/* Asaas */}
          <IntegrationCard
            icon={<CreditCard className="h-5 w-5 text-blue-600" />}
            title="Asaas"
            description="Cobranças e pagamentos"
            status="coming-soon"
            color="bg-blue-50"
          >
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="asaas" className="text-xs font-medium flex items-center gap-2">
                  Token de Acesso
                  <a 
                    href="https://asaas.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Label>
                <div className="relative">
                  <Input 
                    id="asaas"
                    type={showAsaas ? 'text' : 'password'}
                    value={asaasToken}
                    onChange={(e) => setAsaasToken(e.target.value)}
                    placeholder="Cole seu token aqui..."
                    className="pr-10 font-mono text-xs h-9"
                    disabled
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowAsaas(!showAsaas)}
                    disabled
                  >
                    {showAsaas ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Boletos e cobranças automáticas
              </p>
            </div>
          </IntegrationCard>

          {/* Clicksign */}
          <IntegrationCard
            icon={<FileSignature className="h-5 w-5 text-purple-600" />}
            title="Clicksign"
            description="Assinatura digital de documentos"
            status="coming-soon"
            color="bg-purple-50"
          >
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground">
                  URL do webhook será gerada após ativação
                </p>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Contratos com assinatura eletrônica
              </p>
            </div>
          </IntegrationCard>
        </div>
      </div>
    </TooltipProvider>
  );
}