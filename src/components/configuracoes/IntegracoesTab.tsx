import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Copy, Check, Key, Webhook, ExternalLink, Eye, EyeOff, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    // In a real app, save to Supabase secrets or edge function
    toast({ 
      title: 'Tokens salvos!', 
      description: 'Os tokens foram salvos com sucesso.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Webhook Recebimento */}
      <Card className="rounded-xl shadow-soft-lg border-0 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Webhook className="h-5 w-5 text-gold" />
            </div>
            <div>
              <CardTitle className="text-lg">Recebimento de Leads (Webhook)</CardTitle>
              <CardDescription className="text-primary-foreground/70">
                Configure o ManyChat ou outras automações para enviar leads automaticamente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* URL do Endpoint */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">URL do Endpoint (POST)</Label>
            <div className="flex gap-2">
              <Input 
                readOnly 
                value={SUPABASE_URL}
                className="font-mono text-sm bg-muted/50"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(SUPABASE_URL, 'url')}
                className="shrink-0"
              >
                {copiedField === 'url' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">Headers Obrigatórios</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Content-Type</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2"
                    onClick={() => copyToClipboard('application/json', 'content-type')}
                  >
                    {copiedField === 'content-type' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <code className="text-sm font-mono text-foreground">application/json</code>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">apikey</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2"
                    onClick={() => copyToClipboard(API_KEY, 'apikey')}
                  >
                    {copiedField === 'apikey' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <code className="text-xs font-mono text-foreground break-all">{API_KEY.substring(0, 50)}...</code>
              </div>
            </div>
          </div>

          {/* JSON Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">Corpo da Requisição (JSON)</Label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => copyToClipboard(jsonExample, 'json')}
                className="h-7"
              >
                {copiedField === 'json' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copiar JSON
              </Button>
            </div>
            <pre className="p-4 bg-primary text-primary-foreground rounded-lg text-sm font-mono overflow-x-auto">
              {jsonExample}
            </pre>
          </div>

          {/* Campos disponíveis */}
          <div className="p-4 bg-gold/10 border border-gold/30 rounded-lg">
            <h4 className="text-sm font-semibold text-foreground mb-2">Campos Disponíveis</h4>
            <div className="flex flex-wrap gap-2">
              {['nome', 'telefone', 'email', 'origem', 'status', 'resumo_ia', 'link_contrato'].map((campo) => (
                <span key={campo} className="px-2 py-1 bg-card text-xs font-mono rounded border">
                  {campo}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tokens de Saída */}
      <Card className="rounded-xl shadow-soft-lg border-0 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/20 rounded-lg">
              <Key className="h-5 w-5 text-gold" />
            </div>
            <div>
              <CardTitle className="text-lg">Chaves de API (Saída)</CardTitle>
              <CardDescription className="text-primary-foreground/70">
                Configure tokens para integrações com Z-API e Asaas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Z-API */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="zapi" className="text-sm font-semibold">Token Z-API (WhatsApp)</Label>
                <a 
                  href="https://z-api.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gold hover:text-gold/80"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    id="zapi"
                    type={showZapi ? 'text' : 'password'}
                    value={zapiToken}
                    onChange={(e) => setZapiToken(e.target.value)}
                    placeholder="Cole seu token aqui..."
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowZapi(!showZapi)}
                  >
                    {showZapi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Usado para enviar mensagens automáticas via WhatsApp
              </p>
            </div>

            {/* Asaas */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="asaas" className="text-sm font-semibold">Token Asaas (Cobranças)</Label>
                <a 
                  href="https://asaas.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gold hover:text-gold/80"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    id="asaas"
                    type={showAsaas ? 'text' : 'password'}
                    value={asaasToken}
                    onChange={(e) => setAsaasToken(e.target.value)}
                    placeholder="Cole seu token aqui..."
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowAsaas(!showAsaas)}
                  >
                    {showAsaas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Usado para gerar boletos e cobranças automáticas
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t flex justify-end">
            <Button onClick={handleSaveTokens} className="gap-2">
              <Save className="h-4 w-4" />
              Salvar Tokens
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
