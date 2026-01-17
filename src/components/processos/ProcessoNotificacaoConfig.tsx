import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Clock, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessoNotificacaoConfigProps {
  processoId: string;
  frequenciaDias: number;
  notificacaoAtiva: boolean;
  ultimaNotificacao?: string | null;
  onUpdate?: () => void;
}

export function ProcessoNotificacaoConfig({
  processoId,
  frequenciaDias: initialFrequencia,
  notificacaoAtiva: initialAtiva,
  ultimaNotificacao,
  onUpdate
}: ProcessoNotificacaoConfigProps) {
  const [frequencia, setFrequencia] = useState(initialFrequencia.toString());
  const [ativa, setAtiva] = useState(initialAtiva);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('processos')
        .update({
          frequencia_notificacao_dias: parseInt(frequencia),
          notificacao_ativa: ativa
        })
        .eq('id', processoId);

      if (error) throw error;
      
      toast.success('Configuração de notificação salva!');
      onUpdate?.();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Nunca';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Notificações de Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notificacao-ativa">Notificações automáticas</Label>
            <p className="text-xs text-muted-foreground">
              Enviar atualizações de status para o cliente
            </p>
          </div>
          <Switch
            id="notificacao-ativa"
            checked={ativa}
            onCheckedChange={setAtiva}
          />
        </div>

        {ativa && (
          <div className="space-y-2">
            <Label htmlFor="frequencia">Frequência de notificação</Label>
            <Select value={frequencia} onValueChange={setFrequencia}>
              <SelectTrigger id="frequencia">
                <SelectValue placeholder="Selecione a frequência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">A cada 7 dias</SelectItem>
                <SelectItem value="14">A cada 14 dias</SelectItem>
                <SelectItem value="30">A cada 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Última notificação: {formatDate(ultimaNotificacao)}</span>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          size="sm"
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
