import { useMemo } from 'react';
import { TrendingUp, Megaphone, Building2 } from 'lucide-react';
import { ContratoComStatus } from '@/pages/ContratosPage';

const SUCESSO = ['Assinado', 'Finalizado'];
const PERDIDO  = ['Cancelado', 'Recusado', 'Prazo Expirado'];

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function monthKey(d: Date) {
  return d.getFullYear() * 100 + d.getMonth();
}

export function ContratosAnalytics({ contratos }: { contratos: ContratoComStatus[] }) {
  const s = useMemo(() => {
    const traf = contratos.filter(c => c.tipoOrigem === 'trafego');
    const esct = contratos.filter(c => c.tipoOrigem !== 'trafego');

    const now    = new Date();
    const nowKey = monthKey(now);
    const prevD  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = monthKey(prevD);

    const byMes = (arr: ContratoComStatus[], key: number) =>
      arr.filter(c => c.lastUpdate && monthKey(new Date(c.lastUpdate)) === key);

    const tmT = byMes(traf, nowKey);
    const tmE = byMes(esct, nowKey);
    const pmT = byMes(traf, prevKey);
    const pmE = byMes(esct, prevKey);

    const succ = (arr: ContratoComStatus[]) => arr.filter(c => SUCESSO.includes(c.status)).length;

    return {
      total:     contratos.length,
      trafTotal: traf.length,
      esctTotal: esct.length,
      trafSucc:  succ(traf),
      esctSucc:  succ(esct),
      totalSucc: succ(contratos),
      perdidos:  contratos.filter(c => PERDIDO.includes(c.status)).length,
      trafTaxa:  pct(succ(traf), traf.length),
      esctTaxa:  pct(succ(esct), esct.length),
      geral:     pct(succ(contratos), contratos.length),
      mes:   now.toLocaleDateString('pt-BR',  { month: 'short', year: '2-digit' }),
      prev:  prevD.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      tmTTotal: tmT.length, tmETotal: tmE.length,
      tmTSucc: succ(tmT),   tmESucc: succ(tmE),
      pmTTotal: pmT.length, pmETotal: pmE.length,
      pmTSucc: succ(pmT),   pmESucc: succ(pmE),
    };
  }, [contratos]);

  if (contratos.length === 0) return null;

  const trafTaxaMes = pct(s.tmTSucc, s.tmTTotal);
  const esctTaxaMes = pct(s.tmESucc, s.tmETotal);
  const diff   = trafTaxaMes - esctTaxaMes;
  const leader = diff > 0 ? 'trafego' : diff < 0 ? 'escritorio' : 'empate';

  const circum = 2 * Math.PI * 22;

  return (
    <div className="rounded-2xl border border-[#c9a96e]/20 bg-gradient-to-br from-[#faf8f5] to-[#f5f0e8] dark:from-[#2a1f14] dark:to-[#1e1510] shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-2 border-b border-[#c9a96e]/10">
        <TrendingUp className="h-4 w-4 text-[#c9a96e]" />
        <span className="text-sm font-semibold text-[#3d2b1f] dark:text-[#c9a96e]">Analytics de Contratos</span>
        <span className="ml-auto text-[10px] text-[#3d2b1f]/40 dark:text-[#c9a96e]/40">Atualização automática</span>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-6">

        {/* ─── Origem ─── */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#3d2b1f]/40 dark:text-[#c9a96e]/40 uppercase tracking-wider">Origem dos Contratos</p>

          <div className="space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-foreground/70">Tráfego Pago</span>
                </div>
                <span className="text-xs font-bold text-foreground">
                  {s.trafTotal} <span className="font-normal text-muted-foreground text-[11px]">{pct(s.trafTotal, s.total)}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#3d2b1f]/8 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${pct(s.trafTotal, s.total)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#c9a96e]" />
                  <span className="text-xs text-foreground/70">Escritório</span>
                </div>
                <span className="text-xs font-bold text-foreground">
                  {s.esctTotal} <span className="font-normal text-muted-foreground text-[11px]">{pct(s.esctTotal, s.total)}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#3d2b1f]/8 overflow-hidden">
                <div className="h-full rounded-full bg-[#c9a96e] transition-all duration-700" style={{ width: `${pct(s.esctTotal, s.total)}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
              <p className="text-lg font-bold text-emerald-600">{s.totalSucc}</p>
              <p className="text-[9px] text-emerald-600/60 uppercase tracking-wide">Assinados</p>
            </div>
            <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200/60 dark:border-zinc-700/40 text-center">
              <p className="text-lg font-bold text-zinc-400">{s.perdidos}</p>
              <p className="text-[9px] text-zinc-400/60 uppercase tracking-wide">Perdidos</p>
            </div>
          </div>
        </div>

        {/* ─── Taxa de Conversão ─── */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#3d2b1f]/40 dark:text-[#c9a96e]/40 uppercase tracking-wider">Taxa de Conversão</p>

          <div className="flex items-center gap-4">
            <div>
              <p className="text-4xl font-bold text-[#3d2b1f] dark:text-[#c9a96e] leading-none">
                {s.geral}<span className="text-xl font-normal">%</span>
              </p>
              <p className="text-[10px] text-[#3d2b1f]/40 dark:text-[#c9a96e]/40 mt-1">conversão geral</p>
            </div>
            <div className="relative w-14 h-14 shrink-0">
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#3d2b1f15" strokeWidth="6" />
                <circle
                  cx="28" cy="28" r="22"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeDasharray={`${(s.geral / 100) * circum} ${circum}`}
                  strokeDashoffset={circum / 4}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '28px 28px', transition: 'stroke-dasharray 0.7s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-emerald-600">{s.geral}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-blue-600/70">Tráfego ({s.trafSucc}/{s.trafTotal})</span>
                <span className="font-semibold text-blue-600">{s.trafTaxa}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#3d2b1f]/8 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${s.trafTaxa}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#c9a96e]/80">Escritório ({s.esctSucc}/{s.esctTotal})</span>
                <span className="font-semibold text-[#c9a96e]">{s.esctTaxa}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#3d2b1f]/8 overflow-hidden">
                <div className="h-full rounded-full bg-[#c9a96e] transition-all duration-700" style={{ width: `${s.esctTaxa}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Comparativo Mensal ─── */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-[#3d2b1f]/40 dark:text-[#c9a96e]/40 uppercase tracking-wider">Comparativo Mensal</p>

          {/* Mês atual */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground/70 capitalize">{s.mes}</span>
              <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-md">atual</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-center">
                <p className="text-base font-bold text-blue-600">
                  {s.tmTSucc}<span className="text-[10px] text-blue-400 font-normal">/{s.tmTTotal}</span>
                </p>
                <p className="text-[9px] text-blue-500/60 mt-0.5">Tráfego</p>
                <p className="text-[10px] font-semibold text-blue-600">{pct(s.tmTSucc, s.tmTTotal)}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/20 text-center">
                <p className="text-base font-bold text-[#3d2b1f] dark:text-[#c9a96e]">
                  {s.tmESucc}<span className="text-[10px] text-[#c9a96e]/50 font-normal">/{s.tmETotal}</span>
                </p>
                <p className="text-[9px] text-[#c9a96e]/60 mt-0.5">Escritório</p>
                <p className="text-[10px] font-semibold text-[#3d2b1f] dark:text-[#c9a96e]">{pct(s.tmESucc, s.tmETotal)}%</p>
              </div>
            </div>
          </div>

          {/* Mês anterior */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground/40 capitalize">{s.prev}</span>
              <span className="text-[10px] text-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 rounded-md">anterior</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 text-center">
                <p className="text-sm font-bold text-blue-600/50">
                  {s.pmTSucc}<span className="text-[10px] text-blue-400/40 font-normal">/{s.pmTTotal}</span>
                </p>
                <p className="text-[9px] text-blue-500/40">Tráfego</p>
              </div>
              <div className="p-2 rounded-xl bg-[#c9a96e]/5 border border-[#c9a96e]/10 text-center">
                <p className="text-sm font-bold text-[#3d2b1f]/40 dark:text-[#c9a96e]/40">
                  {s.pmESucc}<span className="text-[10px] text-[#c9a96e]/30 font-normal">/{s.pmETotal}</span>
                </p>
                <p className="text-[9px] text-[#c9a96e]/40">Escritório</p>
              </div>
            </div>
          </div>

          {/* Indicador de liderança */}
          {(s.tmTTotal > 0 || s.tmETotal > 0) && (
            <div className={`text-center py-1.5 rounded-xl border text-[11px] font-semibold ${
              leader === 'trafego'
                ? 'bg-blue-50 border-blue-200/50 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800/30 dark:text-blue-400'
                : leader === 'escritorio'
                ? 'bg-[#c9a96e]/10 border-[#c9a96e]/25 text-[#3d2b1f] dark:text-[#c9a96e]'
                : 'bg-muted border-border text-muted-foreground'
            }`}>
              {leader === 'trafego'   && `Tráfego na frente (+${diff}p.p.)`}
              {leader === 'escritorio' && `Escritório na frente (+${Math.abs(diff)}p.p.)`}
              {leader === 'empate'    && 'Empatados este mês'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
