import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Save, TestTube, Loader2, CheckCircle, XCircle, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { IntegrationConfig } from '@/types/stateMachine';

export function FiqOnIntegrationCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-hub/webhook/fiqon`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integrations_config')
        .select('*')
        .eq('provider', 'fiqon')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const typedData = data as unknown as IntegrationConfig;
        setConfig(typedData);
        setWebhookSecret(typedData.config_json?.webhook_secret || '');
        setIsActive(typedData.is_active);
      }
    } catch (error) {
      console.error('Error loading FiqOn config:', error);
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
          provider: 'fiqon',
          config_json: {
            webhook_secret: webhookSecret
          },
          is_active: isActive,
          updated_at: new Date().toISOString()
        }, { onConflict: 'provider' });

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As credenciais do FiqOn foram atualizadas.'
      });

      loadConfig();
    } catch (error) {
      console.error('Error saving FiqOn config:', error);
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
    // Para FiqOn, testamos enviando um evento de teste para nosso próprio webhook
    setTesting(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookSecret ? { 'x-webhook-secret': webhookSecret } : {})
        },
        body: JSON.stringify({
          type: 'test',
          source: 'fiqon_test',
          timestamp: new Date().toISOString()
        })
      });

      // Atualizar status do teste
      await supabase
        .from('integrations_config')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: response.ok ? 'connected' : 'error'
        })
        .eq('provider', 'fiqon');

      if (response.ok) {
        toast({
          title: 'Webhook funcionando!',
          description: 'O endpoint está pronto para receber mensagens do FiqOn.'
        });
      } else {
        const errorText = await response.text();
        toast({
          title: 'Erro no webhook',
          description: errorText || 'Não foi possível conectar ao webhook.',
          variant: 'destructive'
        });
      }

      loadConfig();
    } catch (error) {
      console.error('Error testing FiqOn webhook:', error);
      
      await supabase
        .from('integrations_config')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: 'error'
        })
        .eq('provider', 'fiqon');

      toast({
        title: 'Erro no teste',
        description: 'Falha ao testar webhook. Verifique a conexão.',
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
            <div className="p-2.5 rounded-xl bg-purple-500/15">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">FiqOn</CardTitle>
              <CardDescription className="text-xs">
                Integração com automação FiqOn
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
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              Em breve
            </Badge>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <p className="font-medium mb-1">📋 Como configurar:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>No FiqOn, crie um fluxo que receba webhooks da Z-API</li>
            <li>Configure a ação de saída para enviar POST para a URL abaixo</li>
            <li>O CRM receberá as mensagens e a Isa responderá automaticamente</li>
          </ol>
        </div>

        <div className="space-y-2">
          <Label>URL do Webhook (Configure no FiqOn)</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-xs bg-muted/30"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(webhookUrl, 'webhook')}
            >
              {copied === 'webhook' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use esta URL como destino do fluxo no FiqOn
          </p>
        </div>

        <div className="space-y-2">
          <Label>Webhook Secret (Opcional)</Label>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Senha para validar webhooks recebidos"
          />
          <p className="text-xs text-muted-foreground">
            Se configurado, inclua o header <code className="bg-muted px-1 rounded">x-webhook-secret</code> nas requisições do FiqOn
          </p>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
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
                Testar Webhook
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
