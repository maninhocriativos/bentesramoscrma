import { useMemo, useState, useEffect } from 'react';
import { Lead } from '@/types/leads';
import { Processo } from '@/types/processos';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, DollarSign, Megaphone, FileSignature, Building2 } from 'lucide-react';
import {
  startOfWeek, startOfMonth, startOfQuarter,
  subWeeks, subMonths, subQuarters,
  differenceInMonths, isAfter, isBefore, format
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ConversionMetricsProps {
  leads: Lead[];
  processos: Processo[];
}

interface ContratoFechadoRow {
  lead_id: string;
  quantidade_contratos: number;
  created_at: string;
}

const isTrafficLead = (l: Lead) => l.tipo_origem === 'trafego' || l.origem === 'Tráfego Pago';

// Sinal vindo do estado do lead (atualizado tanto por fluxos automáticos —
// Zapsign/Clicksign/kanban — quanto pelo modal de registro manual de contrato)
const isConvertedByState = (l: Lead) =>
  l.lead_state === 'CONTRACT_SIGNED' ||
  l.status === 'Contrato Assinado' ||
  l.status === 'Ganho';

const PROCESSO_STATUS_EXCLUIDOS = ['Arquivado', 'Perdido'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);

interface PeriodResult { total: number; converted: number; lost: number; conversionRate: number; totalValue: number; }
interface MonthlyPoint { month: string; leads: number; contratos: number; taxa: number; }
interface SegmentData {
  metrics: {
    week: { current: PeriodResult; previous: PeriodResult };
    month: { current: PeriodResult; previous: PeriodResult };
    quarter: { current: PeriodResult; previous: PeriodResult };
  };
  monthlyData: MonthlyPoint[];
  global: { total: number; converted: number; taxa: number };
}

function buildSegment(
  segmentLeads: Lead[],
  now: Date,
  valorPorLead: Map<string, number>,
  contratosManuaisPorLead: Map<string, { quantidade: number; primeiraData: string }>,
): SegmentData {
  // Quantidade real de contratos do lead: usa o maior entre o que o lead_state indica
  // (1 + contratos_adicionais) e o que está registrado em contratos_fechados — cobre
  // o caso do lead_state não ter sido atualizado após um registro manual.
  const contratosDoLead = (l: Lead): number => {
    const viaState = isConvertedByState(l) ? 1 + (l.contratos_adicionais || 0) : 0;
    const viaManual = contratosManuaisPorLead.get(l.id)?.quantidade || 0;
    return Math.max(viaState, viaManual);
  };
  const isConverted = (l: Lead) => contratosDoLead(l) > 0;

  // Só usa uma data de assinatura quando há um sinal real e específico de quando o
  // contrato foi fechado — contract_signed_at (campo dedicado) ou a data do registro
  // em contratos_fechados. NÃO adivinha via updated_at/state_updated_at: esses campos
  // são tocados por qualquer edição do lead e já causaram leads antigos aparecendo
  // como "convertidos essa semana" por coincidência de data de edição.
  const getSignedDate = (l: Lead): Date | null => {
    const manual = contratosManuaisPorLead.get(l.id);
    if ((l as any).contract_signed_at) return new Date((l as any).contract_signed_at);
    if (manual?.primeiraData) return new Date(manual.primeiraData);
    return null;
  };

  const getPeriod = (start: Date, end: Date): PeriodResult => {
    const pl = segmentLeads.filter(l => {
      const d = new Date(l.created_at);
      return isAfter(d, start) && isBefore(d, end);
    });
    const total = pl.length;

    const signedInPeriod = segmentLeads.filter(l => {
      if (!isConverted(l)) return false;
      const d = getSignedDate(l);
      if (!d) return false; // sem data de assinatura confiável — não entra em nenhum período
      return isAfter(d, start) && isBefore(d, end);
    });
    const converted = signedInPeriod.reduce((s, l) => s + contratosDoLead(l), 0);
    const lost = pl.filter(l => l.is_lost || l.status === 'Perdido').length;
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;
    const totalValue = signedInPeriod.reduce((s, l) => s + (valorPorLead.get(l.id) || 0), 0);
    return { total, converted, lost, conversionRate, totalValue };
  };

  const cW = startOfWeek(now, { weekStartsOn: 1 });
  const cM = startOfMonth(now);
  const cQ = startOfQuarter(now);

  const metrics = {
    week:    { current: getPeriod(cW, now), previous: getPeriod(subWeeks(cW, 1), cW) },
    month:   { current: getPeriod(cM, now), previous: getPeriod(subMonths(cM, 1), cM) },
    quarter: { current: getPeriod(cQ, now), previous: getPeriod(subQuarters(cQ, 1), cQ) },
  };

  const allTs = segmentLeads
    .filter(l => l.created_at)
    .map(l => new Date(l.created_at).getTime())
    .filter(t => Number.isFinite(t));
  const earliestStart = allTs.length > 0 ? startOfMonth(new Date(Math.min(...allTs))) : subMonths(startOfMonth(now), 5);
  const diffMonths = differenceInMonths(startOfMonth(now), earliestStart) + 1;
  const numMonths = Math.min(Math.max(diffMonths, 6), 36);

  const monthlyData: MonthlyPoint[] = Array.from({ length: numMonths }, (_, i) => {
    const mStart = subMonths(startOfMonth(now), numMonths - 1 - i);
    const mEnd   = i === numMonths - 1 ? now : subMonths(startOfMonth(now), numMonths - 2 - i);

    const ml = segmentLeads.filter(l => {
      const d = new Date(l.created_at);
      return isAfter(d, mStart) && isBefore(d, mEnd);
    });
    const mc = ml.filter(l => isConverted(l));

    const total     = ml.length;
    const converted = mc.reduce((s, l) => s + contratosDoLead(l), 0);

    return {
      month: format(mStart, 'MMM/yy', { locale: ptBR }),
      leads: total,
      contratos: converted,
      taxa: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  });

  const global = {
    total: segmentLeads.length,
    converted: segmentLeads.reduce((s, l) => s + contratosDoLead(l), 0),
    taxa: segmentLeads.length > 0
      ? Math.round((segmentLeads.reduce((s, l) => s + contratosDoLead(l), 0) / segmentLeads.length) * 100)
      : 0,
  };

  return { metrics, monthlyData, global };
}

export function ConversionMetrics({ leads, processos }: ConversionMetricsProps) {
  const [now] = useState(() => new Date());
  const [contratosFechados, setContratosFechados] = useState<ContratoFechadoRow[]>([]);

  // Contratos registrados manualmente (modal "Contrato Fechado" no chat) — usados
  // como sinal extra para não perder conversões cujo lead_state não foi atualizado.
  useEffect(() => {
    let active = true;
    supabase
      .from('contratos_fechados' as any)
      .select('lead_id, quantidade_contratos, created_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('[ConversionMetrics] Erro ao buscar contratos_fechados:', error);
          return;
        }
        setContratosFechados((data || []) as unknown as ContratoFechadoRow[]);
      });
    return () => { active = false; };
  }, []);

  const contratosManuaisPorLead = useMemo(() => {
    const map = new Map<string, { quantidade: number; primeiraData: string }>();
    contratosFechados.forEach(cf => {
      if (!cf.lead_id) return;
      const atual = map.get(cf.lead_id);
      if (!atual) {
        map.set(cf.lead_id, { quantidade: cf.quantidade_contratos, primeiraData: cf.created_at });
      } else {
        atual.quantidade += cf.quantidade_contratos;
        if (cf.created_at < atual.primeiraData) atual.primeiraData = cf.created_at;
      }
    });
    return map;
  }, [contratosFechados]);

  // Valor real da causa — vem dos processos vinculados ao lead (cliente_id), não do
  // campo valor_causa do lead (que costuma ficar vazio até o processo ser aberto).
  const valorPorLead = useMemo(() => {
    const map = new Map<string, number>();
    processos.forEach(p => {
      if (!p.cliente_id) return;
      if (p.status && PROCESSO_STATUS_EXCLUIDOS.includes(p.status)) return;
      if (!p.valor_causa) return;
      map.set(p.cliente_id, (map.get(p.cliente_id) || 0) + p.valor_causa);
    });
    return map;
  }, [processos]);

  const trafego = useMemo(
    () => buildSegment(leads.filter(isTrafficLead), now, valorPorLead, contratosManuaisPorLead),
    [leads, now, valorPorLead, contratosManuaisPorLead]
  );
  const escritorio = useMemo(
    () => buildSegment(leads.filter(l => !isTrafficLead(l)), now, valorPorLead, contratosManuaisPorLead),
    [leads, now, valorPorLead, contratosManuaisPorLead]
  );

  return (
    <div className="space-y-6">
      <ConversionSegment
        title="Métricas de Tráfego Pago"
        icon={Megaphone}
        data={trafego}
        accent="#c9a96e"
        leadsLabel="Leads Tráfego"
        chartLabel="Conversão por Mês de Entrada — Tráfego Pago"
      />
      <ConversionSegment
        title="Métricas do Escritório"
        icon={Building2}
        data={escritorio}
        accent="#3d2b1f"
        leadsLabel="Leads Escritório"
        chartLabel="Conversão por Mês de Entrada — Escritório"
      />
    </div>
  );
}

// ── Segmento (badges + cards de período + gráfico mensal) — reaproveitado para
// tráfego pago e escritório ────────────────────────────────────────────────────
function ConversionSegment({ title, icon: Icon, data, accent, leadsLabel, chartLabel }: {
  title: string;
  icon: React.ElementType;
  data: SegmentData;
  accent: string;
  leadsLabel: string;
  chartLabel: string;
}) {
  const getTrend = (cur: number, prev: number) => {
    if (cur > prev) return { icon: <TrendingUp style={{ width: 14, height: 14, color: '#16a34a' }} />, color: '#16a34a', label: `+${((cur - prev) / (prev || 1) * 100).toFixed(0)}%` };
    if (cur < prev) return { icon: <TrendingDown style={{ width: 14, height: 14, color: '#dc2626' }} />, color: '#dc2626', label: `${((cur - prev) / (prev || 1) * 100).toFixed(0)}%` };
    return { icon: <Minus style={{ width: 14, height: 14, color: '#9ca3af' }} />, color: '#9ca3af', label: '0%' };
  };

  const periods = [
    { label: 'Esta Semana',    icon: Calendar,   data: data.metrics.week,    accent: '#3d2b1f', showValue: false },
    { label: 'Este Mês',      icon: Target,      data: data.metrics.month,   accent: '#c9a96e', showValue: false },
    { label: 'Este Trimestre', icon: DollarSign, data: data.metrics.quarter,  accent: '#16a34a', showValue: true  },
  ];

  return (
    <div className="space-y-5">
      {/* Badges de resumo */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c9a96e]/25 bg-card text-xs font-medium text-[#3d2b1f]">
          <Icon style={{ width: 13, height: 13, color: accent }} />
          {title}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c9a96e]/10 text-xs font-semibold text-[#7c5a2a]">
          <FileSignature style={{ width: 13, height: 13 }} />
          {data.global.converted} contratos de {data.global.total} leads
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-[#3d2b1f]/8 text-xs font-semibold text-[#3d2b1f]">
          Taxa: {data.global.taxa}%
        </div>
      </div>

      {/* Cards de período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {periods.map(p => {
          const cur  = p.showValue ? p.data.current.totalValue    : p.data.current.conversionRate;
          const prev = p.showValue ? p.data.previous.totalValue   : p.data.previous.conversionRate;
          const trend = getTrend(cur, prev);
          const PIcon = p.icon;
          return (
            <div key={p.label} className="rounded-2xl overflow-hidden bg-card border border-[#c9a96e]/15 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5">
              <div className="h-[3px] w-full" style={{ background: p.accent }} />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${p.accent}18` }}>
                    <PIcon style={{ width: 16, height: 16, color: p.accent }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{p.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p style={{ fontSize: 28, fontWeight: 800, color: 'inherit', lineHeight: 1, letterSpacing: '-0.025em' }}>
                      {p.showValue ? fmt(p.data.current.totalValue) : `${p.data.current.conversionRate.toFixed(0)}%`}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      {p.showValue ? 'Valor Convertido' : 'Taxa de Conversão'}
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
        <div className="h-[3px] w-full" style={{ background: accent }} />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
              <FileSignature style={{ width: 16, height: 16, color: accent }} />
            </div>
            <p className="text-sm font-semibold text-foreground">{chartLabel}</p>
            <span className="ml-auto text-[11px] text-muted-foreground px-2 py-0.5 rounded-lg bg-muted/40">
              coorte: leads que entraram em cada mês
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ height: 280, minWidth: Math.max(data.monthlyData.length * 52, 480) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyData} margin={{ left: 0, right: 20, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,169,110,0.15)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads"     fill={accent} opacity={0.35} radius={[4,4,0,0]} name={leadsLabel} isAnimationActive={false} />
                  <Bar dataKey="contratos" fill="#3d2b1f" radius={[4,4,0,0]} name="Contratos Assinados" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
