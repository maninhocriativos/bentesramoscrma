import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, Mail, Clock, Bell, Calendar,
  Send, AlertTriangle, FileText, BarChart3,
  Loader2, CheckCircle2, Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutomacaoConfig {
  whatsapp_confirmacao_imediata: boolean;
  whatsapp_lembrete_24h: boolean;
  whatsapp_lembrete_1h: boolean;
  whatsapp_followup_pos: boolean;
  email_agenda_dia: boolean;
  email_leads_sem_retorno: boolean;
  email_prazos_proximos: boolean;
  email_relatorio_semanal: boolean;
  frequencia: 'hourly' | '2hours' | '3xday';
}

const defaultConfig: AutomacaoConfig = {
  whatsapp_confirmacao_imediata: true,
  whatsapp_lembrete_24h: true,
  whatsapp_lembrete_1h: true,
  whatsapp_followup_pos: true,
  email_agenda_dia: true,
  email_leads_sem_retorno: true,
  email_prazos_proximos: true,
  email_relatorio_semanal: true,
  frequencia: '3xday',
};

export function IsaAutomacoesConfig() {
  const [config, setConfig] = useState<AutomacaoConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ISA_AUTOMACOES_CONFIG')
        .single();

      if (data?.value) {
        setConfig({ ...defaultConfig, ...JSON.parse(data.value) });
      }
    } catch {
      // Use default config
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await supabase
        .from('app_settings')
        .upsert({
          key: 'ISA_AUTOMACOES_CONFIG',
          value: JSON.stringify(config),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      toast({ title: 'Configurações salvas!', description: 'As automações da Isa foram atualizadas.' });
    } catch (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const testAutomation = async (task: string, label: string) => {
    setTesting(task);
    try {
      const { data, error } = await supabase.functions.invoke('isa-scheduler', {
        body: { task }
      });

      if (error) throw error;

      const actionsCount = data?.actions?.length || 0;
      toast({
        title: `Teste: ${label}`,
        description: actionsCount > 0 
          ? `${actionsCount} ação(ões) executada(s) com sucesso!` 
          : 'Nenhuma ação pendente no momento.',
      });
    } catch (error) {
      toast({ 
        title: 'Erro no teste', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive' 
      });
    } finally {
      setTesting(null);
    }
  };

  const updateConfig = (key: keyof AutomacaoConfig, value: boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* WhatsApp Automations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <CardTitle className="text-base">Notificações WhatsApp</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">Via ManyChat</Badge>
          </div>
          <CardDescription>
            Mensagens automáticas enviadas aos leads sobre compromissos agendados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Confirmação Imediata</Label>
                  <p className="text-xs text-muted-foreground">Enviar confirmação ao agendar</p>
                </div>
              </div>
              <Switch
                checked={config.whatsapp_confirmacao_imediata}
                onCheckedChange={(v) => updateConfig('whatsapp_confirmacao_imediata', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Lembrete 24h Antes</Label>
                  <p className="text-xs text-muted-foreground">Lembrar um dia antes do compromisso</p>
                </div>
              </div>
              <Switch
                checked={config.whatsapp_lembrete_24h}
                onCheckedChange={(v) => updateConfig('whatsapp_lembrete_24h', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Lembrete 1h Antes</Label>
                  <p className="text-xs text-muted-foreground">Lembrar uma hora antes</p>
                </div>
              </div>
              <Switch
                checked={config.whatsapp_lembrete_1h}
                onCheckedChange={(v) => updateConfig('whatsapp_lembrete_1h', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Follow-up Pós-Atendimento</Label>
                  <p className="text-xs text-muted-foreground">Mensagem após o compromisso</p>
                </div>
              </div>
              <Switch
                checked={config.whatsapp_followup_pos}
                onCheckedChange={(v) => updateConfig('whatsapp_followup_pos', v)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testAutomation('lembretes_compromissos', 'Lembretes')}
              disabled={testing !== null}
            >
              {testing === 'lembretes_compromissos' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Testar Lembretes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testAutomation('followup_pos_atendimento', 'Follow-ups')}
              disabled={testing !== null}
            >
              {testing === 'followup_pos_atendimento' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Testar Follow-ups
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Automations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Emails Internos</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">Via Resend</Badge>
          </div>
          <CardDescription>
            Emails automáticos para a equipe sobre atividades e alertas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Agenda do Dia</Label>
                  <p className="text-xs text-muted-foreground">Resumo matinal dos compromissos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testAutomation('email_agenda_dia', 'Agenda do Dia')}
                  disabled={testing !== null}
                  className="h-7 px-2"
                >
                  {testing === 'email_agenda_dia' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
                <Switch
                  checked={config.email_agenda_dia}
                  onCheckedChange={(v) => updateConfig('email_agenda_dia', v)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Leads Sem Retorno</Label>
                  <p className="text-xs text-muted-foreground">Alerta sobre leads inativos (7+ dias)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testAutomation('email_leads_sem_retorno', 'Leads Sem Retorno')}
                  disabled={testing !== null}
                  className="h-7 px-2"
                >
                  {testing === 'email_leads_sem_retorno' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
                <Switch
                  checked={config.email_leads_sem_retorno}
                  onCheckedChange={(v) => updateConfig('email_leads_sem_retorno', v)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Prazos Próximos</Label>
                  <p className="text-xs text-muted-foreground">Alertas de prazos processuais (7 dias)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testAutomation('email_prazos_proximos', 'Prazos Próximos')}
                  disabled={testing !== null}
                  className="h-7 px-2"
                >
                  {testing === 'email_prazos_proximos' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
                <Switch
                  checked={config.email_prazos_proximos}
                  onCheckedChange={(v) => updateConfig('email_prazos_proximos', v)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Relatório Semanal</Label>
                  <p className="text-xs text-muted-foreground">Resumo de métricas toda segunda-feira</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testAutomation('email_relatorio_semanal', 'Relatório Semanal')}
                  disabled={testing !== null}
                  className="h-7 px-2"
                >
                  {testing === 'email_relatorio_semanal' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
                <Switch
                  checked={config.email_relatorio_semanal}
                  onCheckedChange={(v) => updateConfig('email_relatorio_semanal', v)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Horário das Verificações</CardTitle>
          </div>
          <CardDescription>
            3x ao dia: manhã (8h), tarde (14h) e noite (18h)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              08:00
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              14:00
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              18:00
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Configure um cron job externo para chamar a função <code>isa-scheduler</code> nestes horários.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
