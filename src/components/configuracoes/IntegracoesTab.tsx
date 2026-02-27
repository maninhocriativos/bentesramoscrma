import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Key, Webhook, ExternalLink, Eye, EyeOff, Save, MessageSquare, CreditCard, FileSignature, Clock, Zap, Info, Calendar, RefreshCw, Briefcase, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { usePerfil } from '@/contexts/PerfilContext';

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
  const { isAdmin } = usePerfil();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [zapiToken, setZapiToken] = useState('');
  const [asaasToken, setAsaasToken] = useState('');
  const [showZapi, setShowZapi] = useState(false);
  const [showAsaas, setShowAsaas] = useState(false);
  
  // Google OAuth settings state
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [googleSettingsLoading, setGoogleSettingsLoading] = useState(true);
  const [googleSettingsSaving, setGoogleSettingsSaving] = useState(false);
  const [originalGoogleSecret, setOriginalGoogleSecret] = useState('');
  const [secretTouched, setSecretTouched] = useState(false);
  
  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleTokens, setGoogleTokens] = useState<{ access_token?: string; refresh_token?: string } | null>(null);
  
  // Advbox state
  const [advboxSyncing, setAdvboxSyncing] = useState(false);
  const [advboxConnected, setAdvboxConnected] = useState(true); // Token já configurado

  const SUPABASE_URL = 'https://qgenaltkjtlvwfgykpxq.supabase.co/rest/v1/leads_juridicos';
  const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZW5hbHRranRsdndmZ3lrcHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjI1NzAsImV4cCI6MjA2NDczODU3MH0.DgXi_2D3fVNDWMvz9M3aSIbY58FEJc3dTz05kfH_Mew';

  // Load Google OAuth settings from app_settings
  useEffect(() => {
    const loadGoogleSettings = async () => {
      if (!isAdmin) {
        setGoogleSettingsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
        
        if (error) {
          console.error('Error loading Google settings:', error);
        } else if (data) {
          data.forEach((setting: { key: string; value: string }) => {
            if (setting.key === 'GOOGLE_OAUTH_CLIENT_ID') {
              setGoogleClientId(setting.value);
            } else if (setting.key === 'GOOGLE_OAUTH_CLIENT_SECRET') {
              setOriginalGoogleSecret(setting.value);
              setGoogleClientSecret('••••••••••••••••••••');
            }
          });
        }
      } catch (err) {
        console.error('Error loading Google settings:', err);
      } finally {
        setGoogleSettingsLoading(false);
      }
    };
    
    loadGoogleSettings();
  }, [isAdmin]);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'google-oauth-success') {
        setGoogleTokens(event.data.tokens);
        setGoogleConnected(true);
        toast({
          title: 'Google Calendar conectado!',
          description: 'Sua conta foi conectada com sucesso.',
        });
      } else if (event.data.type === 'google-oauth-error') {
        toast({
          title: 'Erro na conexão',
          description: event.data.error,
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  // Save Google OAuth settings
  const handleSaveGoogleSettings = async () => {
    if (!isAdmin) {
      toast({
        title: 'Acesso negado',
        description: 'Apenas administradores podem alterar essas configurações.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!googleClientId.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'O Client ID não pode estar vazio.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if secret is empty and wasn't just masked
    const secretToSave = secretTouched ? googleClientSecret : originalGoogleSecret;
    if (!secretToSave || secretToSave === '••••••••••••••••••••') {
      toast({
        title: 'Campo obrigatório',
        description: 'O Client Secret não pode estar vazio.',
        variant: 'destructive',
      });
      return;
    }
    
    setGoogleSettingsSaving(true);
    
    try {
      // Upsert both keys
      const { error: error1 } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'GOOGLE_OAUTH_CLIENT_ID', value: googleClientId.trim() },
          { onConflict: 'key' }
        );
      
      if (error1) throw error1;
      
      const { error: error2 } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'GOOGLE_OAUTH_CLIENT_SECRET', value: secretToSave },
          { onConflict: 'key' }
        );
      
      if (error2) throw error2;
      
      // Update local state
      setOriginalGoogleSecret(secretToSave);
      setGoogleClientSecret('••••••••••••••••••••');
      setSecretTouched(false);
      
      toast({
        title: 'Configurações salvas!',
        description: 'As chaves do Google OAuth foram atualizadas com sucesso.',
      });
    } catch (error) {
      console.error('Error saving Google settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setGoogleSettingsSaving(false);
    }
  };

  const handleSecretChange = (value: string) => {
    setSecretTouched(true);
    setGoogleClientSecret(value);
  };

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
  "origem": "Webhook",
  "status": "Lead Frio"
}`;

  const handleSaveTokens = () => {
    toast({ 
      title: 'Tokens salvos!', 
      description: 'Os tokens foram salvos com sucesso.',
    });
  };

  const handleConnectGoogle = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {},
        headers: { 'Content-Type': 'application/json' },
      });

      // Try with query params approach
      const response = await fetch(
        'https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/google-calendar-auth?action=get_auth_url',
        { method: 'GET' }
      );
      
      const result = await response.json();
      
      if (result.error) {
        toast({
          title: 'Configuração necessária',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      if (result.authUrl) {
        window.open(result.authUrl, 'google-oauth', 'width=600,height=700');
      }
    } catch (error) {
      console.error('Error connecting to Google:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a conexão com o Google.',
        variant: 'destructive',
      });
    }
  };

  const handleSyncGoogle = async () => {
    if (!googleTokens?.access_token) {
      toast({
        title: 'Erro',
        description: 'Conecte sua conta do Google primeiro.',
        variant: 'destructive',
      });
      return;
    }

    setGoogleSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'sync_google',
          google_access_token: googleTokens.access_token,
        },
      });

      if (error) throw error;

      toast({
        title: 'Sincronização concluída!',
        description: data.message,
      });
    } catch (error) {
      console.error('Error syncing Google Calendar:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar o Google Calendar.',
        variant: 'destructive',
      });
    } finally {
      setGoogleSyncing(false);
    }
  };

  const handleSyncAdvbox = async () => {
    setAdvboxSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'sync_advbox',
        },
      });

      if (error) throw error;

      toast({
        title: 'Sincronização concluída!',
        description: data.message,
      });
    } catch (error) {
      console.error('Error syncing Advbox:', error);
      toast({
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar o Advbox.',
        variant: 'destructive',
      });
    } finally {
      setAdvboxSyncing(false);
    }
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
                  Configure automações para enviar leads automaticamente
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

        {/* Google OAuth Configuration - Admin Only */}
        {isAdmin && (
          <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Configuração Google OAuth</CardTitle>
                  <CardDescription className="text-white/80 text-sm">
                    Configure as credenciais do Google para autenticação (Drive, Calendar)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {googleSettingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Client ID */}
                  <div className="space-y-2">
                    <Label htmlFor="google-client-id" className="text-sm font-medium flex items-center gap-2">
                      Client ID
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">Obtido no Google Cloud Console em APIs & Services &gt; Credentials</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input 
                      id="google-client-id"
                      type="text"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="Ex: 123456789-abc123.apps.googleusercontent.com"
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* Client Secret */}
                  <div className="space-y-2">
                    <Label htmlFor="google-client-secret" className="text-sm font-medium flex items-center gap-2">
                      Client Secret
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">Obtido junto com o Client ID no Google Cloud Console</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="relative">
                      <Input 
                        id="google-client-secret"
                        type={showGoogleSecret ? 'text' : 'password'}
                        value={googleClientSecret}
                        onChange={(e) => handleSecretChange(e.target.value)}
                        placeholder="Cole o Client Secret aqui..."
                        className="font-mono text-xs pr-10"
                        onFocus={() => {
                          if (!secretTouched && googleClientSecret === '••••••••••••••••••••') {
                            setGoogleClientSecret('');
                            setSecretTouched(true);
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                      >
                        {showGoogleSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    {originalGoogleSecret && !secretTouched && (
                      <p className="text-xs text-muted-foreground">
                        Secret configurado. Clique no campo para alterar.
                      </p>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Como obter as credenciais
                    </h4>
                    <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Acesse o <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">Google Cloud Console</a></li>
                      <li>Crie ou selecione um projeto</li>
                      <li>Vá em "APIs & Services" &gt; "Credentials"</li>
                      <li>Crie um "OAuth 2.0 Client ID" (tipo Web Application)</li>
                      <li>Copie o Client ID e Client Secret gerados</li>
                    </ol>
                  </div>

                  {/* Save Button */}
                  <Button 
                    onClick={handleSaveGoogleSettings}
                    disabled={googleSettingsSaving}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {googleSettingsSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {googleSettingsSaving ? 'Salvando...' : 'Salvar Configurações'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* API Integrations Grid */}
        <h3 className="text-sm font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Sincronização de Agenda
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 mb-6">
          {/* Google Calendar */}
          <IntegrationCard
            icon={<Calendar className="h-5 w-5 text-red-600" />}
            title="Google Calendar"
            description="Sincronização bidirecional"
            status={googleConnected ? 'active' : 'inactive'}
            color="bg-red-50"
          >
            <div className="space-y-3 pt-2">
              {!googleConnected ? (
                <Button 
                  onClick={handleConnectGoogle}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Conectar Google Calendar
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs text-green-700 flex items-center gap-1.5">
                      <Check className="h-3 w-3" />
                      Conta Google conectada
                    </p>
                  </div>
                  <Button 
                    onClick={handleSyncGoogle}
                    disabled={googleSyncing}
                    variant="outline"
                    className="w-full"
                  >
                    {googleSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {googleSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Eventos serão sincronizados automaticamente nos dois sentidos.
              </p>
            </div>
          </IntegrationCard>

          {/* Advbox */}
          <IntegrationCard
            icon={<Briefcase className="h-5 w-5 text-indigo-600" />}
            title="Advbox"
            description="Sistema jurídico"
            status={advboxConnected ? 'active' : 'inactive'}
            color="bg-indigo-50"
          >
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-xs text-indigo-700 flex items-center gap-1.5">
                  <Check className="h-3 w-3" />
                  Token Advbox configurado
                </p>
              </div>
              <Button 
                onClick={handleSyncAdvbox}
                disabled={advboxSyncing}
                variant="outline"
                className="w-full"
              >
                {advboxSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {advboxSyncing ? 'Sincronizando...' : 'Sincronizar Agenda'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Compromissos do Advbox serão importados para sua agenda.
              </p>
            </div>
          </IntegrationCard>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-gold-foreground" />
          Outras Integrações
        </h3>
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
            status="active"
            color="bg-purple-50"
          >
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-2">
                  URL do Webhook
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">Configure esta URL no painel do Clicksign para receber notificações de assinatura</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value="https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/clicksign-webhook"
                    className="font-mono text-xs bg-muted/30 truncate h-9"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="shrink-0 h-9 w-9 hover:bg-purple-50 hover:border-purple-300"
                    onClick={() => copyToClipboard('https://qgenaltkjtlvwfgykpxq.supabase.co/functions/v1/clicksign-webhook', 'clicksign-webhook')}
                  >
                    {copiedField === 'clicksign-webhook' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-purple-700 flex items-center gap-1.5">
                  <Check className="h-3 w-3" />
                  Integração configurada e pronta para uso
                </p>
              </div>
              <a 
                href="https://app.clicksign.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1.5"
              >
                <ExternalLink className="h-3 w-3" />
                Acessar painel do Clicksign
              </a>
            </div>
          </IntegrationCard>
        </div>
      </div>
    </TooltipProvider>
  );
}