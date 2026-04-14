import { useState, useMemo } from 'react';
import { Lead } from '@/types/leads';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ArrowRight, DollarSign, PieChart as PieChartIcon, Layers, TrendingUp, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardChartsProps { leads: Lead[]; }

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);

const ORIGEM_COLORS: Record<string, string> = {
  'Escritório': '#3d2b1f', 'Tráfego Pago': '#c9a96e', 'Bentes Ramos': '#7c5a2a',
  'Site': '#16a34a', 'WhatsApp Z-API': '#22c55e', 'Facebook': '#3b82f6',
  'WhatsApp': '#16a34a', 'Instagram': '#ec4899', 'Indicação': '#f97316',
  'Google': '#ef4444', 'Landing Page DCA': '#8b5cf6', 'Outro': '#9ca3af',
};

const STATUS_CONFIG = [
  { status: 'Lead Frio',           color: '#94a3b8', label: 'Lead Frio' },
  { status: 'Em Atendimento',      color: '#3b82f6', label: 'Em Atendimento' },
  { status: 'Em Negociação',       color: '#8b5cf6', label: 'Em Negociação' },
  { status: 'Aguardando Contrato', color: '#f59e0b', label: 'Aguardando Contrato' },
  { status: 'Contrato Assinado',   color: '#0d9488', label: 'Contrato Assinado' },
  { status: 'Ganho',               color: '#22c55e', label: 'Ganho' },
];

const TIPO_LABELS: Record<string, string> = {
  trafego: 'Tráfego Pago', whatsapp_direto: 'WhatsApp Direto',
  indicacao: 'Indicação', indefinido: 'Outros',
};
const TIPO_COLORS: Record<string, string> = {
  trafego: '#c9a96e', whatsapp_direto: '#16a34a', indicacao: '#f97316', indefinido: '#94a3b8',
};

type ValorView = 'status' | 'origem';

export function DashboardCharts({ leads }: DashboardChartsProps) {
  const [valorView, setValorView] = useState<ValorView>('status');

  const data = useMemo(() => {
    const total = leads.length;

    // Origem pie
    const origemMap: Record<string, number> = {};
    leads.forEach(l => { const o = l.origem || 'Outro'; origemMap[o] = (origemMap[o] || 0) + 1; });
    const origemData = Object.entries(origemMap).map(([name, value]) => ({
      name, value, total, color: ORIGEM_COLORS[name] || '#94a3b8',
    }));

    // Status counts
    const statusMap: Record<string, number> = {};
    leads.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });
    const funnelData = STATUS_CONFIG.map(c => ({ ...c, count: statusMap[c.status] || 0 }));

    // Valor por status
    const valorPorStatus = STATUS_CONFIG.map(c => {
      const sl = leads.filter(l => l.status === c.status);
      return { status: c.label, valor: sl.reduce((s, l) => s + (l.valor_causa || 0), 0), color: c.color, count: sl.length };
    }).filter(i => i.valor > 0);

    // Valor por tipo_origem
    const tipoMap: Record<string, { valor: number; count: number }> = {};
    leads.forEach(l => {
      const k = (l as any).tipo_origem || 'indefinido';
      if (!tipoMap[k]) tipoMap[k] = { valor: 0, count: 0 };
      tipoMap[k].valor += l.valor_causa || 0;
      tipoMap[k].count += 1;
    });
    const origemValorData = Object.entries(tipoMap)
      .map(([k, d]) => ({ name: TIPO_LABELS[k] || k, valor: d.valor, count: d.count, color: TIPO_COLORS[k] || '#94a3b8' }))
      .filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor);

    const totalValor = leads.reduce((s, l) => s + (l.valor_causa || 0), 0);
    const ganhos = leads.filter(l => l.status === 'Ganho' || l.status === 'Contrato Assinado');
    const valorGanhos = ganhos.reduce((s, l) => s + (l.valor_causa || 0), 0);
    const top5 = [...leads].filter(l => (l.valor_causa || 0) > 0).sort((a, b) => (b.valor_causa || 0) - (a.valor_causa || 0)).slice(0, 5);

    return { origemData, total, funnelData, statusMap, valorPorStatus, origemValorData, tipoMap, totalValor, ganhos, valorGanhos, top5 };
  }, [leads]);

  const getConversionRate = (idx: number) => {
    if (idx === 0) return 100;
    const cur = data.funnelData[idx].count, prev = data.funnelData[idx - 1].count;
    return prev === 0 ? 0 : Math.round((cur / prev) * 100);
  };

  return (
    <div className="space-y-5">

      {/* ── Valor da Causa ── */}
      <div className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ height: 3, background: '#16a34a' }} />
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.08)' }}>
                <DollarSign style={{ width: 16, height: 16, color: '#16a34a' }} />
              </div>
              <span className="text-sm font-semibold text-foreground">Valor da Causa</span>
              {/* Toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.25)' }}>
                {(['status', 'origem'] as const).map((v, i) => (
                  <button key={v} onClick={() => setValorView(v)}
                    className="transition-all"
                    style={{
                      padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      background: valorView === v ? '#3d2b1f' : 'transparent',
                      color: valorView === v ? '#c9a96e' : '#9ca3af',
                      borderRight: i === 0 ? '0.5px solid rgba(201,169,110,0.2)' : 'none',
                    }}>
                    Por {v === 'status' ? 'Status' : 'Origem'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <TrendingUp style={{ width: 12, height: 12, color: '#16a34a' }} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Ganhos</span>
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{fmt(data.valorGanhos)}</p>
                <p style={{ fontSize: 10, color: '#9ca3af' }}>{data.ganhos.length} casos</p>
              </div>
              <div style={{ width: 1, height: 40, background: 'rgba(201,169,110,0.2)' }} />
              <div className="text-right">
                <p style={{ fontSize: 20, fontWeight: 800, color: 'inherit' }}>{fmt(data.totalValor)}</p>
                <p style={{ fontSize: 11, color: '#9ca3af' }}>Total em pipeline</p>
              </div>
            </div>
          </div>

          {/* Gráfico */}
          {(valorView === 'status' ? data.valorPorStatus : data.origemValorData).length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valorView === 'status' ? data.valorPorStatus : data.origemValorData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="rgba(201,169,110,0.12)" />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey={valorView === 'status' ? 'status' : 'name'} width={130} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Valor']} contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(201,169,110,0.3)' }} cursor={{ fill: 'rgba(201,169,110,0.05)' }} />
                  <Bar dataKey="valor" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {(valorView === 'status' ? data.valorPorStatus : data.origemValorData).map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center" style={{ color: '#9ca3af', fontSize: 13 }}>
              Nenhum lead com valor da causa informado
            </div>
          )}

          {/* Mini cards de status */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mt-4 pt-4" style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
            {STATUS_CONFIG.map(c => {
              const valor = leads.filter(l => l.status === c.status).reduce((s, l) => s + (l.valor_causa || 0), 0);
              const count = data.statusMap[c.status] || 0;
              return (
                <div key={c.status} className="text-center p-2.5 rounded-xl transition-colors hover:bg-stone-50" style={{ background: 'rgba(201,169,110,0.04)' }}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 500 }} className="truncate">{c.label}</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'inherit' }}>{fmt(valor)}</p>
                  <p style={{ fontSize: 10, color: '#9ca3af' }}>{count} leads</p>
                </div>
              );
            })}
          </div>

          {/* Top 5 */}
          {data.top5.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <MapPin style={{ width: 12, height: 12, color: '#9ca3af' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top 5 maiores valores</span>
              </div>
              <div className="space-y-1.5">
                {data.top5.map(l => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-1.5 rounded-xl transition-colors hover:bg-stone-50" style={{ background: 'rgba(201,169,110,0.04)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_CONFIG.find(s => s.status === l.status)?.color || '#94a3b8' }} />
                      <span style={{ fontSize: 12, fontWeight: 500 }} className="truncate">{l.nome || 'Sem nome'}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }} className="shrink-0">{TIPO_LABELS[(l as any).tipo_origem] || ''}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{fmt(l.valor_causa || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Origem + Funil ── */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">

        {/* Origem */}
        <div className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ height: 3, background: '#3d2b1f' }} />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,43,31,0.08)' }}>
                <PieChartIcon style={{ width: 16, height: 16, color: '#3d2b1f' }} />
              </div>
              <span className="text-sm font-semibold text-foreground">Origem dos Leads</span>
            </div>
            {data.origemData.length > 0 ? (
              <>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.origemData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none" isAnimationActive={false}>
                        {data.origemData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(201,169,110,0.3)' }} formatter={(v: number, n: string) => [`${v} leads (${data.total > 0 ? Math.round(v/data.total*100) : 0}%)`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 pt-3" style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
                  {data.origemData.map(e => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                      <span style={{ fontSize: 11, fontWeight: 500 }}>{e.name}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{e.value} ({data.total > 0 ? Math.round(e.value/data.total*100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center" style={{ color: '#9ca3af', fontSize: 13 }}>Nenhum dado</div>
            )}
          </div>
        </div>

        {/* Funil */}
        <div className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ height: 3, background: '#c9a96e' }} />
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.1)' }}>
                <Layers style={{ width: 16, height: 16, color: '#c9a96e' }} />
              </div>
              <span className="text-sm font-semibold text-foreground">Funil de Vendas</span>
            </div>
            {leads.length > 0 ? (
              <div className="space-y-3">
                {data.funnelData.map((stage, idx) => {
                  const maxCount = Math.max(...data.funnelData.map(s => s.count), 1);
                  const width = Math.max((stage.count / maxCount) * 100, 40);
                  const rate = getConversionRate(idx);
                  return (
                    <div key={stage.status} className="relative">
                      {idx > 0 && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-10 px-2 py-0.5 rounded-full bg-card"
                          style={{ fontSize: 10, color: '#9ca3af', border: '0.5px solid rgba(201,169,110,0.2)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <ArrowRight style={{ width: 10, height: 10, transform: 'rotate(90deg)' }} />
                          <span style={{ fontWeight: 600 }}>{rate}%</span>
                        </div>
                      )}
                      <div className="mx-auto rounded-xl overflow-hidden transition-transform hover:scale-[1.01]"
                        style={{ width: `${width}%`, background: stage.color }}>
                        <div className="py-2.5 px-4 flex items-center justify-between">
                          <span style={{ color: '#fff', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', marginRight: 8 }}>{stage.label}</span>
                          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{stage.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Conversão Final</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                    {data.total > 0 ? `${Math.round((data.funnelData[data.funnelData.length-1].count / data.total) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center" style={{ color: '#9ca3af', fontSize: 13 }}>Nenhum dado</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
