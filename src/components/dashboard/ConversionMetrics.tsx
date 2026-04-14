import { useMemo, useState } from 'react';
import { Lead } from '@/types/leads';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, DollarSign, Megaphone, FileSignature } from 'lucide-react';
import {
  startOfWeek, startOfMonth, startOfQuarter,
  subWeeks, subMonths, subQuarters,
  isAfter, isBefore, format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Line,
} from 'recharts';

interface ConversionMetricsProps { leads: Lead[]; }

const CONVERTED_STATES = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'];
const isTrafficLead = (l: Lead) => l.tipo_origem === 'trafego';
const isConverted   = (l: Lead) => CONVERTED_STATES.includes(l.lead_state || '') || l.status === 'Contrato Assinado' || l.status === 'Ganho';
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);

export function ConversionMetrics({ leads }: ConversionMetricsProps) {
  const [now] = useState(() => new Date());
  const trafficLeads = useMemo(() => leads.filter(isTrafficLead), [leads]);

  const metrics = useMemo(() => {
    const getPeriod = (start: Date, end: Date) => {
      const pl = trafficLeads.filter(l => { const d = new Date(l.created_at); return isAfter(d, start) && isBefore(d, end); });
      const total = pl.length;
      const contracts = pl.reduce((s, l) => s + (isConverted(l) ? 1 : 0) + (l.contratos_adicionais || 0), 0);
      const lost = pl.filter(l => l.is_lost || l.status === 'Perdido').length;
      const conversionRate = total > 0 ? (contracts / total) * 100 : 0;
      const totalValue = pl.filter(isConverted).reduce((s, l) => s + (l.valor_causa || 0), 0);
      return { total, converted: contracts, lost, conversionRate, totalValue };
    };
    const cW = startOfWeek(now, { weekStartsOn: 1 }), cM = startOfMonth(now), cQ = startOfQuarter(now);
    return {
      week:    { current: getPeriod(cW, now), previous: getPeriod(subWeeks(cW, 1), cW) },
      month:   { current: getPeriod(cM, now), previous: getPeriod(subMonths(cM, 1), cM) },
      quarter: { current: getPeriod(cQ, now), previous: getPeriod(subQuarters(cQ, 1), cQ) },
    };
  }, [trafficLeads, now]);

  const monthlyData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const mStart = subMonths(startOfMonth(now), 5 - i);
    const mEnd   = i === 5 ? now : subMonths(startOfMonth(now), 4 - i);
    const ml = trafficLeads.filter(l => { const d = new Date(l.created_at); return isAfter(d, mStart) && isBefore(d, mEnd); });
    const mc = trafficLeads.filter(l => {
      if (!isConverted(l)) return false;
      const d = new Date(l.contract_signed_at || l.created_at);
      return isAfter(d, mStart) && isBefore(d, mEnd);
    });
    const total = ml.length;
    const converted = mc.reduce((s, l) => s + 1 + (l.contratos_adicionais || 0), 0);
    return {
      month: format(mStart, 'MMM/yy', { locale: ptBR }),
      leads_trafego: total,
      contratos: converted,
      taxa: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  }), [trafficLeads, now]);

  const global = useMemo(() => {
    const total = trafficLeads.length;
    const converted = trafficLeads.reduce((s, l) => s + (isConverted(l) ? 1 : 0) + (l.contratos_adicionais || 0), 0);
    return { total, converted, taxa: total > 0 ? Math.round((converted / total) * 100) : 0 };
  }, [trafficLeads]);

  const getTrend = (cur: number, prev: number) => {
    if (cur > prev) return { icon: <TrendingUp style={{ width: 14, height: 14, color: '#16a34a' }} />, color: '#16a34a', label: `+${((cur - prev) / (prev || 1) * 100).toFixed(0)}%` };
    if (cur < prev) return { icon: <TrendingDown style={{ width: 14, height: 14, color: '#dc2626' }} />, color: '#dc2626', label: `${((cur - prev) / (prev || 1) * 100).toFixed(0)}%` };
    return { icon: <Minus style={{ width: 14, height: 14, color: '#9ca3af' }} />, color: '#9ca3af', label: '0%' };
  };

  const periods = [
    { label: 'Esta Semana', icon: Calendar, data: metrics.week, accent: '#3d2b1f', showValue: false },
    { label: 'Este Mês',    icon: Target,   data: metrics.month, accent: '#c9a96e', showValue: false },
    { label: 'Este Trimestre', icon: DollarSign, data: metrics.quarter, accent: '#16a34a', showValue: true },
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
          const cur = p.showValue ? p.data.current.totalValue : p.data.current.conversionRate;
          const prev = p.showValue ? p.data.previous.totalValue : p.data.previous.conversionRate;
          const trend = getTrend(cur, prev);
          const Icon = p.icon;
          return (
            <div
              key={p.label}
              className="rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="h-[3px] w-full" style={{ background: p.accent }} />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${p.accent}15` }}>
                    <Icon style={{ width: 16, height: 16, color: p.accent }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{p.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      {p.showValue ? fmt(p.data.current.totalValue) : `${p.data.current.conversionRate.toFixed(0)}%`}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {p.showValue ? 'Valor Convertido (Tráfego)' : 'Taxa Conversão (Tráfego)'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center">{trend.icon}</div>
                    <span className="text-[10px] font-bold" style={{ color: trend.color }}>{trend.label}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#c9a96e]/10">
                  <div className="text-center p-2 rounded-xl bg-muted/30">
                    <p className="text-sm font-bold text-foreground">{p.data.current.total}</p>
                    <p className="text-[10px] text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-emerald-50">
                    <p className="text-sm font-bold text-emerald-700">{p.data.current.converted}</p>
                    <p className="text-[10px] text-muted-foreground">Assinados</p>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-red-50">
                    <p className="text-sm font-bold text-red-600">{p.data.current.lost}</p>
                    <p className="text-[10px] text-muted-foreground">Perdidos</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico de barras */}
      <div className="rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="h-[3px] w-full" style={{ background: '#c9a96e' }} />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-[#c9a96e]/12 flex items-center justify-center">
              <FileSignature style={{ width: 16, height: 16, color: '#c9a96e' }} />
            </div>
            <p className="text-sm font-semibold text-foreground">Contratos Assinados por Mês (Tráfego Pago)</p>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 0, right: 20, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,169,110,0.15)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="leads_trafego" fill="#c9a96e" opacity={0.35} radius={[4,4,0,0]} name="Leads Tráfego" isAnimationActive={false} />
                <Bar dataKey="contratos"     fill="#3d2b1f" radius={[4,4,0,0]} name="Contratos Assinados" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
