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
  { key: 'total', label: 'Total', icon: FileSignature, colorClass: 'text-[#c9a96e]', borderClass: 'border-[#c9a96e]/30' },
  { key: 'emProcesso', label: 'Em Processo', icon: Clock, colorClass: 'text-amber-500', borderClass: 'border-amber-500/30' },
  { key: 'finalizados', label: 'Finalizados', icon: CheckCircle2, colorClass: 'text-emerald-500', borderClass: 'border-emerald-500/30' },
  { key: 'cancelados', label: 'Cancelados', icon: XCircle, colorClass: 'text-red-400', borderClass: 'border-red-400/30' },
] as const;

export function ContratosKPIs({ data, onRefresh, onSendContract, refreshing = false }: ContratosKPIsProps) {
  const taxaSucesso = data.total > 0 ? Math.round((data.finalizados / data.total) * 100) : 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* KPI Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {kpis.map(({ key, label, icon: Icon, colorClass, borderClass }) => (
          <div
            key={key}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#3d2b1f]/5 border',
              borderClass
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', colorClass)} />
            <span className="text-sm font-semibold text-[#3d2b1f] dark:text-[#c9a96e]">
              {data[key]}
            </span>
            <span className="text-xs text-[#3d2b1f]/60 dark:text-[#c9a96e]/60">{label}</span>
          </div>
        ))}

        {/* Taxa de sucesso */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#c9a96e]/10 border border-[#c9a96e]/40">
          <TrendingUp className="h-3.5 w-3.5 text-[#c9a96e]" />
          <span className="text-sm font-semibold text-[#3d2b1f] dark:text-[#c9a96e]">{taxaSucesso}%</span>
          <span className="text-xs text-[#3d2b1f]/60 dark:text-[#c9a96e]/60">Sucesso</span>
        </div>

        {/* Tráfego */}
        {(data.trafegoFinalizados ?? 0) > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
            <Megaphone className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              {data.trafegoFinalizados}
            </span>
            <span className="text-xs text-blue-600/70">Tráfego</span>
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
          className="border-[#c9a96e]/40 text-[#3d2b1f] hover:bg-[#c9a96e]/10 dark:text-[#c9a96e]"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          onClick={onSendContract}
          className="gap-1.5 bg-gradient-to-r from-[#3d2b1f] to-[#5c3d2e] hover:from-[#5c3d2e] hover:to-[#3d2b1f] text-[#c9a96e] border border-[#c9a96e]/30 shadow-sm"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Enviar Contrato</span>
          <span className="sm:hidden">Enviar</span>
        </Button>
      </div>
    </div>
  );
}
