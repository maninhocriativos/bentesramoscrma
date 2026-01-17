import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Save, TestTube, Loader2, Eye, EyeOff, CheckCircle, XCircle, Copy, Check } from 'lucide-react';
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
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://qgenaltkjtlvwfgykpxq.supabase.co'}/functions/v1/api-hub/webhook/fiqon`;

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
        setBaseUrl(typedData.config_json?.base_url || '');
        setApiKey(typedData.config_json?.api_key || '');
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
            base_url: baseUrl,
            api_key: apiKey,
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
    if (!baseUrl || !apiKey) {
      toast({
        title: 'Credenciais incompletas',
        description: 'Preencha a Base URL e API Key antes de testar.',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      // Testar conexão com FiqOn
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
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
          title: 'Conexão bem-sucedida!',
          description: 'O FiqOn está conectado e funcionando.'
        });
      } else {
        toast({
          title: 'Erro na conexão',
          description: 'Não foi possível conectar ao FiqOn.',
          variant: 'destructive'
        });
      }

      loadConfig();
    } catch (error) {
      console.error('Error testing FiqOn:', error);
      
      // Atualizar status como erro
      await supabase
        .from('integrations_config')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: 'error'
        })
        .eq('provider', 'fiqon');

      toast({
        title: 'Erro no teste',
        description: 'Falha ao testar conexão com FiqOn. Verifique a URL e credenciais.',
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
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.fiqon.com/v1"
          />
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Sua API Key"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Webhook Secret (Opcional)</Label>
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Senha para validar webhooks"
          />
        </div>

        <div className="space-y-2">
          <Label>URL do Webhook</Label>
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
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !baseUrl || !apiKey}
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
