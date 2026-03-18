import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, CheckCircle2, XCircle, SkipForward, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SyncProcessosModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalProcessos: number;
}

interface SyncResultItem {
  cnj: string;
  success: boolean;
  skipped?: boolean;
  movimentacoesNovas: number;
  error?: string;
}

type SyncStage = 'idle' | 'syncing' | 'done';

export function SyncProcessosModal({ isOpen, onClose, totalProcessos }: SyncProcessosModalProps) {
  const [stage, setStage] = useState<SyncStage>('idle');
  const [results, setResults] = useState<SyncResultItem[]>([]);
  const [summary, setSummary] = useState({ synced: 0, skipped: 0, failed: 0, totalMovimentacoes: 0 });
  const [forceAll, setForceAll] = useState(false);
  const [maxProcessos, setMaxProcessos] = useState(20);

  const handleSync = async () => {
    setStage('syncing');
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('processo-auto-sync', {
        body: { force_all: forceAll, max: maxProcessos },
      });

      if (error) throw error;

      setResults(data?.results || []);
      setSummary({
        synced: data?.synced || 0,
        skipped: data?.skipped || 0,
        failed: data?.failed || 0,
        totalMovimentacoes: data?.totalMovimentacoes || 0,
      });
      setStage('done');
    } catch {
      setStage('done');
      setSummary({ synced: 0, skipped: 0, failed: 1, totalMovimentacoes: 0 });
    }
  };

  const handleClose = () => {
    setStage('idle');
    setResults([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronizar Processos
          </DialogTitle>
          <DialogDescription>
            Atualiza movimentações e status dos processos via Escavador/DataJud.
          </DialogDescription>
        </DialogHeader>

        {stage === 'idle' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processos no sistema</span>
                <Badge variant="outline">{totalProcessos}</Badge>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Máximo de processos por execução</label>
                <div className="flex gap-2">
                  {[10, 20, 50, 100].map(n => (
                    <Button
                      key={n}
                      variant={maxProcessos === n ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setMaxProcessos(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceAll}
                  onChange={e => setForceAll(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs text-muted-foreground">Forçar atualização (ignora intervalo de sincronização)</span>
              </label>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Créditos Escavador:</strong> Cada processo consome 1 crédito. O status é verificado primeiro para economizar créditos quando não há atualizações.
              </p>
            </div>

            <Button onClick={handleSync} className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Iniciar Sincronização ({maxProcessos} processos)
            </Button>
          </div>
        )}

        {stage === 'syncing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="text-sm font-medium">Sincronizando processos...</p>
              <p className="text-xs text-muted-foreground mt-1">Consultando Escavador e atualizando dados</p>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {stage === 'done' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mb-0.5" />
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{summary.synced}</p>
                <p className="text-[10px] text-muted-foreground">Atualizados</p>
              </div>
              <div className="bg-muted rounded-lg p-2.5">
                <SkipForward className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
                <p className="text-lg font-bold">{summary.skipped}</p>
                <p className="text-[10px] text-muted-foreground">Pulados</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5">
                <XCircle className="h-4 w-4 text-red-600 mx-auto mb-0.5" />
                <p className="text-lg font-bold text-red-700 dark:text-red-400">{summary.failed}</p>
                <p className="text-[10px] text-muted-foreground">Erros</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
                <RefreshCw className="h-4 w-4 text-blue-600 mx-auto mb-0.5" />
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{summary.totalMovimentacoes}</p>
                <p className="text-[10px] text-muted-foreground">Novas Mov.</p>
              </div>
            </div>

            {results.length > 0 && (
              <ScrollArea className="h-48 rounded-lg border border-border">
                <div className="divide-y divide-border">
                  {results.map((r, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-mono truncate flex-1">{r.cnj}</span>
                      {r.success ? (
                        r.skipped ? (
                          <Badge variant="secondary" className="text-[10px]">Sem alteração</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-[10px]">+{r.movimentacoesNovas} mov</Badge>
                        )
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">{r.error?.slice(0, 30)}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button className="w-full" onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
