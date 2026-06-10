import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { HardDrive, Loader2, CheckCircle2, ExternalLink, CloudUpload, RotateCcw } from 'lucide-react';

export function BackupChatCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastResult, setLastResult] = useState<{
    date: string;
    subscribers_count: number;
    messages_count: number;
    files: { type: string; name: string; webViewLink?: string }[];
  } | null>(null);

  const runBackup = async () => {
    if (!user) {
      toast({ title: 'Erro', description: 'Faça login primeiro', variant: 'destructive' });
      return;
    }

    setIsRunning(true);
    try {
      toast({ title: '📦 Backup iniciado', description: 'Exportando mensagens e contatos para o Google Drive...' });

      const { data, error } = await supabase.functions.invoke('backup-chat-drive', {
        body: { user_id: user.id },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setLastResult(data);
      toast({
        title: '✅ Backup concluído!',
        description: `${data.subscribers_count} contatos e ${data.messages_count} mensagens exportados`,
      });
    } catch (err: any) {
      console.error('[BackupChatCard] Erro:', err);
      toast({
        title: 'Erro no backup',
        description: err.message || 'Falha ao exportar dados',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runRestore = async () => {
    if (!user) {
      toast({ title: 'Erro', description: 'Faça login primeiro', variant: 'destructive' });
      return;
    }
    setIsRestoring(true);
    try {
      // 1) Prévia (dry run): descobre o backup mais recente e o que será restaurado
      const { data: preview, error: prevErr } = await supabase.functions.invoke('restore-chat-drive', {
        body: { user_id: user.id, dry_run: true },
      });
      if (prevErr) throw new Error(prevErr.message);
      if (preview?.error) throw new Error(preview.error);

      // 2) Confirmação explícita
      const ok = window.confirm(
        `Restaurar o backup "${preview.backup}"?\n\n` +
        `• ${preview.contatos} contatos\n` +
        `• ${preview.mensagens} mensagens\n\n` +
        `A restauração REPÕE registros perdidos (não apaga nada nem remove mensagens mais novas que o backup). Deseja continuar?`
      );
      if (!ok) { setIsRestoring(false); return; }

      toast({ title: '♻️ Restaurando...', description: `Repondo dados do backup ${preview.backup}` });

      // 3) Restaura de fato
      const { data, error } = await supabase.functions.invoke('restore-chat-drive', {
        body: { user_id: user.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: '✅ Restauração concluída!',
        description: `${data.contatos_restaurados} contatos e ${data.mensagens_restauradas} mensagens restaurados do backup ${data.backup}`,
      });
    } catch (err: any) {
      console.error('[BackupChatCard] Erro na restauração:', err);
      toast({ title: 'Erro na restauração', description: err.message || 'Falha ao restaurar', variant: 'destructive' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Backup de Chat</CardTitle>
              <CardDescription>
                Exportar mensagens e contatos para o Google Drive (JSON + CSV)
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <CloudUpload className="h-4 w-4" />
          <span>Os arquivos serão salvos em: <strong>Backups - CRM / Chat / [data]</strong></span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={runBackup} disabled={isRunning || isRestoring} className="gap-2">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4" />
                Fazer Backup Agora
              </>
            )}
          </Button>

          <Button onClick={runRestore} disabled={isRunning || isRestoring} variant="outline" className="gap-2">
            {isRestoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Restaurando...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Restaurar do Drive
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A restauração usa o backup mais recente e <strong>repõe</strong> contatos/mensagens perdidos (não apaga nem sobrescreve mensagens mais novas).
        </p>

        {lastResult && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Último backup: {lastResult.date}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{lastResult.subscribers_count} contatos</Badge>
              <Badge variant="secondary">{lastResult.messages_count} mensagens</Badge>
              <Badge variant="secondary">{lastResult.files.length} arquivos</Badge>
            </div>
            <div className="space-y-1">
              {lastResult.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>📄 {f.name}</span>
                  {f.webViewLink && (
                    <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
