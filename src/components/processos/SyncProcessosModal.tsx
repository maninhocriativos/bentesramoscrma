import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw, CheckCircle2, XCircle, SkipForward,
  Loader2, Zap, AlertTriangle, Scale,
} from 'lucide-react';
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
  const [stage,         setStage]         = useState<SyncStage>('idle');
  const [results,       setResults]       = useState<SyncResultItem[]>([]);
  const [summary,       setSummary]       = useState({ synced: 0, skipped: 0, failed: 0, totalMovimentacoes: 0 });
  const [forceAll,      setForceAll]      = useState(false);
  const [maxProcessos,  setMaxProcessos]  = useState(20);

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
        synced:             data?.synced             || 0,
        skipped:            data?.skipped            || 0,
        failed:             data?.failed             || 0,
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
    setSummary({ synced: 0, skipped: 0, failed: 0, totalMovimentacoes: 0 });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 rounded-2xl overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Sincronizar Processos</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary to-primary/30" />
          <div className="flex items-center gap-3 px-6 py-5 bg-card border-b border-border/60">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
              <RefreshCw className={`h-5 w-5 text-primary-foreground ${stage === 'syncing' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground leading-none">Sincronizar Processos</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalProcessos} processos no sistema · Escavador / DataJud
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── IDLE ── */}
          {stage === 'idle' && (
            <>
              {/* Max selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Processos por execução
                </p>
                <div className="flex gap-2">
                  {[10, 20, 50, 100].map(n => (
                    <button
                      key={n}
                      onClick={() => setMaxProcessos(n)}
                      className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all duration-200 border
                        ${maxProcessos === n
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                          : 'bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Force checkbox */}
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/50 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={forceAll}
                  onChange={e => setForceAll(e.target.checked)}
                  className="rounded border-border mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Forçar atualização</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Ignora o intervalo de sincronização — todos serão consultados
                  </p>
                </div>
              </label>

              {/* Credits warning */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-800/40">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Créditos Escavador</p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Cada processo consome 1 crédito. O status é verificado primeiro para economizar créditos quando não há atualizações.
                  </p>
                </div>
              </div>

              <Button onClick={handleSync} className="w-full h-11 rounded-xl gap-2 font-bold shadow-sm shadow-primary/20">
                <Zap className="h-4 w-4" />
                Iniciar Sincronização ({maxProcessos} processos)
              </Button>
            </>
          )}

          {/* ── SYNCING ── */}
          {stage === 'syncing' && (
            <div className="py-10 flex flex-col items-center gap-5">
              <div className="relative h-16 w-16">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Scale className="h-8 w-8 text-primary/20" />
                </div>
                <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">Sincronizando processos...</p>
                <p className="text-xs text-muted-foreground mt-1">Consultando Escavador e atualizando dados</p>
              </div>
              {/* Animated progress bar */}
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    icon: CheckCircle2,
                    label: 'Atualizados',
                    value: summary.synced,
                    cls: 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-800/40',
                    numCls: 'text-emerald-700 dark:text-emerald-400',
                    iconCls: 'text-emerald-600',
                  },
                  {
                    icon: SkipForward,
                    label: 'Pulados',
                    value: summary.skipped,
                    cls: 'bg-muted border-border/50',
                    numCls: 'text-foreground',
                    iconCls: 'text-muted-foreground',
                  },
                  {
                    icon: XCircle,
                    label: 'Erros',
                    value: summary.failed,
                    cls: 'bg-red-50 border-red-200/60 dark:bg-red-950/20 dark:border-red-800/40',
                    numCls: 'text-red-700 dark:text-red-400',
                    iconCls: 'text-red-600',
                  },
                  {
                    icon: RefreshCw,
                    label: 'Novas Mov.',
                    value: summary.totalMovimentacoes,
                    cls: 'bg-blue-50 border-blue-200/60 dark:bg-blue-950/20 dark:border-blue-800/40',
                    numCls: 'text-blue-700 dark:text-blue-400',
                    iconCls: 'text-blue-600',
                  },
                ].map((item, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-center space-y-1 ${item.cls}`}>
                    <item.icon className={`h-4 w-4 mx-auto ${item.iconCls}`} />
                    <p className={`text-xl font-black tabular-nums ${item.numCls}`}>{item.value}</p>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Results log */}
              {results.length > 0 && (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Log de Resultados
                    </p>
                  </div>
                  <ScrollArea className="h-44">
                    <div className="divide-y divide-border/25">
                      {results.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                          <p className="font-mono text-[10px] text-muted-foreground truncate flex-1">{r.cnj}</p>
                          {r.success ? (
                            r.skipped ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">
                                Sem alteração
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 shrink-0">
                                +{r.movimentacoesNovas} mov
                              </span>
                            )
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 shrink-0 max-w-[120px] truncate">
                              {r.error?.slice(0, 20) || 'Erro'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button className="w-full h-10 rounded-xl font-bold" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
