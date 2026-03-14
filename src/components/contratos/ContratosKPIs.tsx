import { Button } from '@/components/ui/button';
import { Clock, XCircle, CheckCircle2, FileSignature, RefreshCw, Loader2, Send, TrendingUp, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContratosKPIsProps {
  data: {
    emProcesso: number;
    recusados: number;
    finalizados: number;
    cancelados: number;
    total: number;
    trafegoFinalizados?: number;
  };
  onRefresh: () => void;
  onSendContract: () => void;
  refreshing?: boolean;
}

const kpis = [
  { key: 'total', label: 'Total', icon: FileSignature, colorClass: 'text-foreground' },
  { key: 'emProcesso', label: 'Em Processo', icon: Clock, colorClass: 'text-amber-600' },
  { key: 'finalizados', label: 'Finalizados', icon: CheckCircle2, colorClass: 'text-emerald-600' },
  { key: 'cancelados', label: 'Cancelados', icon: XCircle, colorClass: 'text-destructive' },
] as const;

export function ContratosKPIs({ data, onRefresh, onSendContract, refreshing = false }: ContratosKPIsProps) {
  const taxaSucesso = data.total > 0 ? Math.round((data.finalizados / data.total) * 100) : 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* KPI Pills */}
      <div className="flex items-center gap-3 flex-wrap">
        {kpis.map(({ key, label, icon: Icon, colorClass }) => (
          <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Icon className={cn('h-4 w-4', colorClass)} />
            <span className="text-sm font-medium text-foreground">
              {data[key]}
            </span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{taxaSucesso}%</span>
          <span className="text-xs text-muted-foreground">Sucesso</span>
        </div>
        {(data.trafegoFinalizados ?? 0) > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <Megaphone className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              {data.trafegoFinalizados}
            </span>
            <span className="text-xs text-blue-600/70 dark:text-blue-400/70">Tráfego</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        <Button size="sm" onClick={onSendContract} className="gap-1.5">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Enviar Contrato</span>
          <span className="sm:hidden">Enviar</span>
        </Button>
      </div>
    </div>
  );
}
