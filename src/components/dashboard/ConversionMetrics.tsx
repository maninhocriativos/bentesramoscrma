import { useMemo, useState } from 'react';
import { Lead } from '@/types/leads';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, DollarSign, Megaphone, FileSignature } from 'lucide-react';
import {
  startOfWeek, startOfMonth, startOfQuarter,
  subWeeks, subMonths, subQuarters,
  differenceInMonths, isAfter, isBefore, format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ConversionMetricsProps {
  leads: Lead[];
  stats?: { contratos_trafego_total?: number; leads_trafego?: number; };
}

// ── Critério correto: tipo_origem='trafego' OU origem='Tráfego Pago'
const isTrafficLead = (l: Lead) =>
  (l as any).tipo_origem === 'trafego' || l.origem === 'Tráfego Pago';

// Apenas contratos efetivamente fechados (não inclui "aguardando docs" ou intermediários)
const isConverted = (l: Lead) =>
  l.lead_state === 'CONTRACT_SIGNED' ||
  l.status === 'Contrato Assinado' ||
  l.status === 'Ganho';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);

export function ConversionMetrics({ leads, stats }: ConversionMetricsProps) {
  const [now] = useState(() => new Date());
  const trafficLeads = useMemo(() => leads.filter(isTrafficLead), [leads]);

  const metrics = useMemo(() => {
    // Retorna data de assinatura do contrato usando a mesma cadeia de fallback do gráfico
    const getSignedDate = (l: any): Date => {
      const dateStr = l.contract_signed_at || l.state_updated_at || l.updated_at || l.created_at;
      return new Date(dateStr);
    };

    const getPeriod = (start: Date, end: Date) => {
      // Leads que ENTRARAM neste período (para mostrar o volume de captação)
      const pl = trafficLeads.filter(l => {
        const d = new Date(l.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
      const total = pl.length;

      // Contratos ASSINADOS neste período (independente de quando o lead entrou)
      const signedInPeriod = trafficLeads.filter(l => {
        if (!isConverted(l)) return false;
        const d = getSignedDate(l);
        return isAfter(d, start) && isBefore(d, end);
      });
      const contracts = signedInPeriod.reduce((s, l) => s + 1 + ((l as any).contratos_adicionais || 0), 0);

      // Leads perdidos que ENTRARAM neste período
      const lost = pl.filter(l => l.is_lost || l.status === 'Perdido').length;

      const conversionRate = total > 0 ? (contracts / total) * 100 : 0;
      const totalValue = signedInPeriod.reduce((s, l) => s + (l.valor_causa || 0), 0);
      return { total, converted: contracts, lost, conversionRate, totalValue };
    };

    const cW = startOfWeek(now, { weekStartsOn: 1 });
    const cM = startOfMonth(now);
    const cQ = startOfQuarter(now);

    return {
      week:    { current: getPeriod(cW, now), previous: getPeriod(subWeeks(cW, 1), cW) },
      month:   { current: getPeriod(cM, now), previous: getPeriod(subMonths(cM, 1), cM) },
      quarter: { current: getPeriod(cQ, now), previous: getPeriod(subQuarters(cQ, 1), cQ) },
    };
  }, [trafficLeads, now]);

  // Gráfico mensal — análise de coorte: para cada mês de ENTRADA, quantos converteram (qualquer data)
  const monthlyData = useMemo(() => {
    const allTs = leads
      .filter(l => l.created_at)
      .map(l => new Date(l.created_at).getTime())
      .filter(t => Number.isFinite(t));
    const earliestStart = allTs.length > 0 ? startOfMonth(new Date(Math.min(...allTs))) : subMonths(startOfMonth(now), 5);
    const diffMonths = differenceInMonths(startOfMonth(now), earliestStart) + 1;
    const numMonths = Math.min(Math.max(diffMonths, 6), 36);
    return Array.from({ length: numMonths }, (_, i) => {
      const mStart = subMonths(startOfMonth(now), numMonths - 1 - i);
      const mEnd   = i === numMonths - 1 ? now : subMonths(startOfMonth(now), numMonths - 2 - i);

      // Leads que ENTRARAM neste mês (coorte)
      const ml = trafficLeads.filter(l => {
        const d = new Date(l.created_at);
        return isAfter(d, mStart) && isBefore(d, mEnd);
      });

      // Dos leads que ENTRARAM neste mês, quantos já converteram (qualquer momento)
      const mc = ml.filter(l => isConverted(l));

      const total     = ml.length;
      const converted = mc.reduce((s, l) => s + 1 + ((l as any).contratos_adicionais || 0), 0);

      return {
        month: format(mStart, 'MMM/yy', { locale: ptBR }),
        leads_trafego: total,
        contratos: converted,
        taxa: total > 0 ? Math.round((converted / total) * 100) : 0,
      };
    });
  }, [trafficLeads, leads, now]);

  const global = useMemo(() => {
    // Usar RPC quando disponível (fonte autoritativa), fallback para cálculo local
    const total     = stats?.leads_trafego ?? trafficLeads.length;
    const converted = stats?.contratos_trafego_total
      ?? trafficLeads.reduce((s, l) => s + (isConverted(l) ? 1 : 0) + ((l as any).contratos_adicionais || 0), 0);
    return { total, converted, taxa: total > 0 ? Math.round((converted / total) * 100) : 0 };
  }, [trafficLeads, stats]);

  const getTrend = (cur: number, prev: number) => {
    if (cur > prev) return { icon: <TrendingUp style={{ width: 14, height: 14, color: '#16a34a' }} />, color: '#16a34a', label: `+${((cur - prev) / (prev || 1) * 100).toFixed(0)}%` };
    if (cur < prev) return { icon: <TrendingDown style={{ width: 14, height: 14, color: '#dc2626' }} />, color: '#dc2626', label: `${((cur - prev) / (prev || 1) * 100).toFixed(0)}%` };
    return { icon: <Minus style={{ width: 14, height: 14, color: '#9ca3af' }} />, color: '#9ca3af', label: '0%' };
  };

  const periods = [
    { label: 'Esta Semana',    icon: Calendar,   data: metrics.week,    accent: '#3d2b1f', showValue: false },
    { label: 'Este Mês',      icon: Target,      data: metrics.month,   accent: '#c9a96e', showValue: false },
    { label: 'Este Trimestre', icon: DollarSign, data: metrics.quarter,  accent: '#16a34a', showValue: true  },
  ];

  return (
    <div className="space-y-5">
      {/* Badges de resumo */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c9a96e]/25 bg-card text-xs font-medium text-[#3d2b1f]">
          <Megaphone style={{ width: 13, height: 13, color: '#c9a96e' }} />
          Métricas de Tráfego Pago
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c9a96e]/10 text-xs font-semibold text-[#7c5a2a]">
          <FileSignature style={{ width: 13, height: 13 }} />
          {global.converted} contratos de {global.total} leads
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-[#3d2b1f]/8 text-xs font-semibold text-[#3d2b1f]">
          Taxa: {global.taxa}%
        </div>
      </div>

      {/* Cards de período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periods.map(p => {
          const cur  = p.showValue ? p.data.current.totalValue    : p.data.current.conversionRate;
          const prev = p.showValue ? p.data.previous.totalValue   : p.data.previous.conversionRate;
          const trend = getTrend(cur, prev);
          const Icon = p.icon;
          return (
            <div key={p.label} className="rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5">
              <div className="h-[3px] w-full" style={{ background: p.accent }} />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${p.accent}18` }}>
                    <Icon style={{ width: 16, height: 16, color: p.accent }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{p.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p style={{ fontSize: 28, fontWeight: 800, color: 'inherit', lineHeight: 1, letterSpacing: '-0.025em' }}>
                      {p.showValue ? fmt(p.data.current.totalValue) : `${p.data.current.conversionRate.toFixed(0)}%`}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      {p.showValue ? 'Valor Convertido (Tráfego)' : 'Taxa Conversão (Tráfego)'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center">{trend.icon}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: trend.color }}>{trend.label}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#c9a96e]/10">
                  <div className="text-center p-2 rounded-xl bg-muted/30">
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{p.data.current.total}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af' }}>Leads</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-emerald-50">
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{p.data.current.converted}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af' }}>Assinados</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-red-50">
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>{p.data.current.lost}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af' }}>Perdidos</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico mensal */}
      <div className="rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="h-[3px] w-full" style={{ background: '#c9a96e' }} />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-[#c9a96e]/12 flex items-center justify-center">
              <FileSignature style={{ width: 16, height: 16, color: '#c9a96e' }} />
            </div>
            <p className="text-sm font-semibold text-foreground">Conversão por Mês de Entrada — Tráfego Pago</p>
            <span className="ml-auto text-[11px] text-muted-foreground px-2 py-0.5 rounded-lg bg-muted/40">
              coorte: leads que entraram em cada mês
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ height: 280, minWidth: Math.max(monthlyData.length * 52, 480) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ left: 0, right: 20, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,169,110,0.15)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads_trafego" fill="#c9a96e" opacity={0.35} radius={[4,4,0,0]} name="Leads Tráfego" isAnimationActive={false} />
                  <Bar dataKey="contratos"     fill="#3d2b1f" radius={[4,4,0,0]} name="Contratos Assinados" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
