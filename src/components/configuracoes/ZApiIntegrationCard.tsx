import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { MessageSquare, Save, TestTube, Loader2, Eye, EyeOff, CheckCircle, XCircle, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationConfig } from '@/types/stateMachine';

export function ZApiIntegrationCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);

  // URL para receber webhooks via FiqOn
  const webhookUrlFiqon = `${import.meta.env.VITE_SUPABASE_URL || 'https://qgenaltkjtlvwfgykpxq.supabase.co'}/functions/v1/api-hub/webhook/fiqon`;
  // URL direta (alternativa)
  const webhookUrlDirect = `${import.meta.env.VITE_SUPABASE_URL || 'https://qgenaltkjtlvwfgykpxq.supabase.co'}/functions/v1/zapi-webhook`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integrations_config')
        .select('*')
        .eq('provider', 'zapi')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const typedData = data as unknown as IntegrationConfig;
        setConfig(typedData);
        setInstanceId(typedData.config_json?.instance_id || '');
        setToken(typedData.config_json?.token || '');
        setClientToken(typedData.config_json?.client_token || '');
        setWebhookSecret(typedData.config_json?.webhook_secret || '');
        setIsActive(typedData.is_active);
      }
    } catch (error) {
      console.error('Error loading Z-API config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('integrations_config')
        .upsert({
          provider: 'zapi',
          config_json: {
            instance_id: instanceId,
            token: token,
            client_token: clientToken,
            webhook_secret: webhookSecret
          },
          is_active: isActive,
          updated_at: new Date().toISOString()
        }, { onConflict: 'provider' });

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As credenciais do Z-API foram atualizadas.'
      });

      loadConfig();
    } catch (error) {
      console.error('Error saving Z-API config:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!instanceId || !token) {
      toast({
        title: 'Credenciais incompletas',
        description: 'Preencha o Instance ID e Token antes de testar.',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      // Testar conexão com Z-API
      const headers: Record<string, string> = {};
      if (clientToken) {
        headers['Client-Token'] = clientToken;
      }
      
      const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
        method: 'GET',
        headers
      });

      const data = await response.json();

      // Atualizar status do teste
      await supabase
        .from('integrations_config')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: response.ok ? 'connected' : 'error'
        })
        .eq('provider', 'zapi');

      if (response.ok && data.connected) {
        toast({
          title: 'Conexão bem-sucedida!',
          description: 'O Z-API está conectado e funcionando.'
        });
      } else {
        toast({
          title: 'Erro na conexão',
          description: data.error || 'Não foi possível conectar ao Z-API.',
          variant: 'destructive'
        });
      }

      loadConfig();
    } catch (error) {
      console.error('Error testing Z-API:', error);
      toast({
        title: 'Erro no teste',
        description: 'Falha ao testar conexão com Z-API.',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <Card className="rounded-xl">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/15">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Z-API + FiqOn</CardTitle>
              <CardDescription className="text-xs">
                WhatsApp via Z-API com automação FiqOn
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config?.last_test_status === 'connected' && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            )}
            {config?.last_test_status === 'error' && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <XCircle className="h-3 w-3 mr-1" />
                Erro
              </Badge>
            )}
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Instance ID</Label>
            <Input
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="Seu Instance ID"
            />
          </div>
          <div className="space-y-2">
            <Label>Token da Instância</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Seu Token"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Client-Token (Obrigatório)</Label>
          <div className="relative">
            <Input
              type={showClientToken ? 'text' : 'password'}
              value={clientToken}
              onChange={(e) => setClientToken(e.target.value)}
              placeholder="Seu Client-Token"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowClientToken(!showClientToken)}
            >
              {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Encontre em Segurança {'>'} Token de Segurança no painel Z-API.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Webhook Secret (Opcional)</Label>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Senha para validar webhooks"
          />
          <p className="text-xs text-muted-foreground">
            Se configurado, valide o header x-webhook-secret nos webhooks recebidos.
          </p>
        </div>

        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Configuração FiqOn</Badge>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs font-medium">1. Configure no Z-API (campo "Ao receber")</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Use o webhook do FiqOn que você já configurou:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value="https://webhook.fiqon.app/webhook/019acc14-90a0-71b..."
                className="font-mono text-xs bg-background"
                placeholder="Seu webhook FiqOn"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">2. Configure no FiqOn (destino do fluxo)</Label>
            <p className="text-xs text-muted-foreground mb-1">
              O FiqOn deve encaminhar para esta URL:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrlFiqon}
                className="font-mono text-xs bg-background"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrlFiqon, 'fiqon')}
              >
                {copied === 'fiqon' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground pt-2 border-t">
            <strong>Fluxo:</strong> WhatsApp → Z-API → FiqOn → CRM (Isa responde automaticamente)
          </p>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !instanceId || !token}
            className="gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4" />
                Testar Conexão
              </>
            )}
          </Button>
          
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
