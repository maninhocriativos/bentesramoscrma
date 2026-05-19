import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, Send, TrendingUp, Megaphone } from 'lucide-react';

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

// ─── Mini gráfico de rosca SVG ────────────────────────────────────────────────
function DonutChart({ finalizados, emProcesso, cancelados, total }: {
  finalizados: number; emProcesso: number; cancelados: number; total: number;
}) {
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circ = 2 * Math.PI * r;

  const pct = (n: number) => total > 0 ? n / total : 0;

  const segments = [
    { value: pct(finalizados), color: '#10b981' },
    { value: pct(emProcesso),  color: '#f59e0b' },
    { value: pct(cancelados),  color: '#6b7280' },
  ];

  let offset = 0;
  const arcs = segments.map(s => {
    const dash = s.value * circ;
    const gap  = circ - dash;
    const arc  = { dash, gap, offset: circ - offset, color: s.color };
    offset += dash;
    return arc;
  });

  const taxaSucesso = total > 0 ? Math.round((finalizados / total) * 100) : 0;

  return (
    <div className="relative w-[88px] h-[88px] shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3d2b1f15" strokeWidth="8" />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="8"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={arc.offset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px', transition: 'stroke-dasharray 0.6s ease' }}
          />
        ))}
      </svg>
      {/* Label central */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-bold text-[#3d2b1f] leading-none">{taxaSucesso}%</span>
        <span className="text-[9px] text-[#3d2b1f]/50 mt-0.5 leading-none">sucesso</span>
      </div>
    </div>
  );
}

// ─── Barra de progresso animada ───────────────────────────────────────────────
function StatBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-[#3d2b1f]/8 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ContratosKPIs({ data, onRefresh, onSendContract, refreshing = false }: ContratosKPIsProps) {
  const { total, finalizados, emProcesso, cancelados, trafegoFinalizados = 0 } = data;

  return (
    <div className="rounded-2xl border border-[#c9a96e]/20 bg-gradient-to-br from-[#faf8f5] to-[#f5f0e8] dark:from-[#2a1f14] dark:to-[#1e1510] shadow-sm overflow-hidden">
      <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">

        {/* ── Gráfico de rosca ── */}
        <DonutChart
          finalizados={finalizados}
          emProcesso={emProcesso}
          cancelados={cancelados}
          total={total}
        />

        {/* ── Stats ── */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">

          {/* Total */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#3d2b1f]/50 uppercase tracking-wider">Total</span>
              <span className="text-lg font-bold text-[#3d2b1f] dark:text-[#c9a96e]">{total}</span>
            </div>
            <StatBar value={total} total={total} color="#c9a96e" />
          </div>

          {/* Finalizados */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600/70 uppercase tracking-wider">Finalizados</span>
              <span className="text-lg font-bold text-emerald-600">{finalizados}</span>
            </div>
            <StatBar value={finalizados} total={total} color="#10b981" />
          </div>

          {/* Em Processo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-600/70 uppercase tracking-wider">Processo</span>
              <span className="text-lg font-bold text-amber-600">{emProcesso}</span>
            </div>
            <StatBar value={emProcesso} total={total} color="#f59e0b" />
          </div>

          {/* Cancelados */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#3d2b1f]/40 uppercase tracking-wider">Cancelados</span>
              <span className="text-lg font-bold text-[#3d2b1f]/60 dark:text-[#c9a96e]/60">{cancelados}</span>
            </div>
            <StatBar value={cancelados} total={total} color="#9ca3af" />
          </div>

        </div>

        {/* ── Ações ── */}
        <div className="flex sm:flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
          {trafegoFinalizados > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 mr-auto sm:mr-0" title="Total de contratos originados por tráfego pago">
              <Megaphone className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{trafegoFinalizados}</span>
              <span className="text-[10px] text-blue-600/70">Tráfego</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0 text-[#3d2b1f]/50 hover:text-[#3d2b1f] hover:bg-[#c9a96e]/10 dark:text-[#c9a96e]/50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            onClick={onSendContract}
            className="h-8 gap-1.5 bg-[#3d2b1f] hover:bg-[#5c3d2e] text-[#c9a96e] border border-[#c9a96e]/20 shadow-sm text-xs px-3"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Enviar Kit</span>
            <span className="sm:hidden">Kit</span>
          </Button>
        </div>

      </div>

      {/* ── Rodapé: legenda colorida ── */}
      <div className="border-t border-[#c9a96e]/10 px-5 py-2.5 flex items-center gap-6 bg-[#3d2b1f]/[0.02]">
        {[
          { color: '#10b981', label: 'Finalizados' },
          { color: '#f59e0b', label: 'Em Processo' },
          { color: '#9ca3af', label: 'Cancelados'  },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="text-[11px] text-[#3d2b1f]/50 dark:text-[#c9a96e]/50">{item.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-[#c9a96e]/60" />
          <span className="text-[11px] text-[#3d2b1f]/40 dark:text-[#c9a96e]/40">
            Atualiza automaticamente a cada 5 min
          </span>
        </div>
      </div>
    </div>
  );
}
