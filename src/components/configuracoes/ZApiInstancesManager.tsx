import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  MessageSquare, Save, TestTube, Loader2, Eye, EyeOff, CheckCircle, XCircle, 
  Copy, Check, Plus, Trash2, Star, Phone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL;

interface ZApiInstance {
  id: string;
  name: string;
  instance_id: string;
  token: string;
  client_token: string | null;
  webhook_secret: string | null;
  phone_number: string | null;
  is_active: boolean;
  is_default: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
}

export function ZApiInstancesManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<ZApiInstance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ZApiInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    instance_id: '',
    token: '',
    client_token: '',
    webhook_secret: '',
    phone_number: '',
    is_active: true,
    is_default: false,
  });
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);

  const webhookUrl = `${SUPABASE_PROJECT_URL}/functions/v1/zapi-webhook`;

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('zapi_instances')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error loading Z-API instances:', error);
      toast({
        title: 'Erro ao carregar instâncias',
        description: 'Não foi possível carregar as instâncias Z-API.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      instance_id: '',
      token: '',
      client_token: '',
      webhook_secret: '',
      phone_number: '',
      is_active: true,
      is_default: instances.length === 0,
    });
    setEditingInstance(null);
    setShowToken(false);
    setShowClientToken(false);
  };

  const openEditDialog = (instance: ZApiInstance) => {
    setEditingInstance(instance);
    setFormData({
      name: instance.name,
      instance_id: instance.instance_id,
      token: instance.token,
      client_token: instance.client_token || '',
      webhook_secret: instance.webhook_secret || '',
      phone_number: instance.phone_number || '',
      is_active: instance.is_active,
      is_default: instance.is_default,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.instance_id || !formData.token) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha Nome, Instance ID e Token.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      // Se marcando como default, remover default das outras
      if (formData.is_default) {
        await supabase
          .from('zapi_instances')
          .update({ is_default: false })
          .neq('id', editingInstance?.id || '');
      }

      const payload = {
        name: formData.name,
        instance_id: formData.instance_id,
        token: formData.token,
        client_token: formData.client_token || null,
        webhook_secret: formData.webhook_secret || null,
        phone_number: formData.phone_number || null,
        is_active: formData.is_active,
        is_default: formData.is_default,
      };

      if (editingInstance) {
        const { error } = await supabase
          .from('zapi_instances')
          .update(payload)
          .eq('id', editingInstance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('zapi_instances')
          .insert(payload);
        if (error) throw error;
      }

      toast({
        title: editingInstance ? 'Instância atualizada!' : 'Instância adicionada!',
        description: `${formData.name} foi ${editingInstance ? 'atualizada' : 'adicionada'} com sucesso.`
      });

      setDialogOpen(false);
      resetForm();
      loadInstances();
    } catch (error: any) {
      console.error('Error saving instance:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar a instância.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (instance: ZApiInstance) => {
    try {
      const { error } = await supabase
        .from('zapi_instances')
        .delete()
        .eq('id', instance.id);

      if (error) throw error;

      toast({
        title: 'Instância removida',
        description: `${instance.name} foi removida.`
      });
      loadInstances();
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover a instância.',
        variant: 'destructive'
      });
    }
  };

  const handleSetDefault = async (instance: ZApiInstance) => {
    try {
      await supabase
        .from('zapi_instances')
        .update({ is_default: false })
        .neq('id', instance.id);

      await supabase
        .from('zapi_instances')
        .update({ is_default: true })
        .eq('id', instance.id);

      toast({
        title: 'Instância padrão definida',
        description: `${instance.name} é agora a instância padrão.`
      });
      loadInstances();
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const handleTest = async (instance: ZApiInstance) => {
    setTesting(instance.id);
    try {
      const headers: Record<string, string> = {};
      if (instance.client_token) {
        headers['Client-Token'] = instance.client_token;
      }
      
      const response = await fetch(
        `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.token}/status`,
        { method: 'GET', headers }
      );

      const data = await response.json();

      await supabase
        .from('zapi_instances')
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: response.ok && data.connected ? 'connected' : 'error'
        })
        .eq('id', instance.id);

      if (response.ok && data.connected) {
        toast({
          title: '✅ Conexão OK!',
          description: `${instance.name} está conectada.`
        });
      } else {
        toast({
          title: '❌ Erro na conexão',
          description: data.error || 'Não foi possível conectar.',
          variant: 'destructive'
        });
      }

      loadInstances();
    } catch (error: any) {
      toast({
        title: 'Erro no teste',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTesting(null);
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
    <Card className="rounded-xl shadow-soft border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/15">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Instâncias Z-API (WhatsApp)</CardTitle>
              <CardDescription className="text-xs">
                Gerencie múltiplos números de WhatsApp via Z-API
              </CardDescription>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingInstance ? 'Editar Instância' : 'Nova Instância Z-API'}
                </DialogTitle>
                <DialogDescription>
                  Configure as credenciais da instância WhatsApp.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Bentes Ramos-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="5592999999999"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Instance ID *</Label>
                  <Input
                    value={formData.instance_id}
                    onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                    placeholder="3EDDF959BC2B81F86B410203B614D70E"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Token da Instância *</Label>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={formData.token}
                      onChange={(e) => setFormData({ ...formData, token: e.target.value })}
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

                <div className="space-y-2">
                  <Label>Client-Token (Segurança)</Label>
                  <div className="relative">
                    <Input
                      type={showClientToken ? 'text' : 'password'}
                      value={formData.client_token}
                      onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
                      placeholder="Token de segurança"
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
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label className="text-sm">Ativa</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_default}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                    />
                    <Label className="text-sm">Padrão para envios</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Webhook URL */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <Label className="text-xs font-medium mb-2 block">URL do Webhook (configure em cada instância no Z-API)</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="font-mono text-xs bg-background"
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

        {/* Lista de instâncias */}
        {instances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma instância configurada.</p>
            <p className="text-xs">Clique em "Nova Instância" para adicionar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className={`p-4 rounded-lg border ${
                  instance.is_default 
                    ? 'border-green-300 bg-green-50/50 dark:bg-green-900/10' 
                    : 'border-border/50 bg-muted/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${instance.is_active ? 'bg-green-500/15' : 'bg-muted'}`}>
                      <Phone className={`h-4 w-4 ${instance.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{instance.name}</span>
                        {instance.is_default && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Padrão
                          </Badge>
                        )}
                        {!instance.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativa</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {instance.phone_number || 'Telefone não informado'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {instance.last_test_status === 'connected' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {instance.last_test_status === 'error' && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(instance)}
                      disabled={testing === instance.id}
                    >
                      {testing === instance.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>

                    {!instance.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(instance)}
                        title="Definir como padrão"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(instance)}
                    >
                      Editar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover instância?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover "{instance.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(instance)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
