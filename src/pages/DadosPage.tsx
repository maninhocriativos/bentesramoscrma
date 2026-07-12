import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { useLeadsAnalytics, LeadAnalytics } from '@/hooks/useLeadsAnalytics';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Trophy, XCircle, Target, PieChart as PieIcon, MapPin,
  Scale, Briefcase, Loader2,
} from 'lucide-react';
import { startOfMonth, startOfQuarter, startOfYear, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Paleta ───────────────────────────────────────────────────────────────────
// Categórica validada (dataviz validator, modo claro): banda de luminosidade + chroma
// + separação CVD (pior par adjacente ΔE 14.5). Identidade por cor só no donut de origem.
const CAT_COLORS = ['#2563eb', '#d97706', '#16a34a', '#db2777', '#0d9488', '#7c3aed', '#dc2626', '#ca8a04'];
const NEUTRAL = '#9ca3af';

// Cor estável por origem (segue a entidade, nunca o rank — não repinta ao filtrar por período).
const ORIGEM_FIXED: Record<string, string> = {
  'Instagram': '#db2777', 'Google': '#dc2626', 'Site': '#16a34a', 'Indicação': '#d97706',
  'Bentes Ramos': '#7c3aed', 'Escritório': '#0d9488', 'Tráfego Pago': '#ca8a04',
  'WhatsApp Z-API': '#2563eb', 'WhatsApp': '#2563eb', 'Facebook': '#2563eb',
};
function corOrigem(name: string): string {
  if (name === 'Não informado' || name === 'Outro') return NEUTRAL;
  if (ORIGEM_FIXED[name]) return ORIGEM_FIXED[name];
  // Fallback determinístico: mesmo nome → mesma cor sempre.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
}
const GOLD = '#c9a96e';
const BROWN = '#3d2b1f';
const GREEN = '#16a34a';
const RED = '#dc2626';
const BORDER = '0.5px solid rgba(201,169,110,0.25)';
const SHADOW = '0 1px 4px rgba(0,0,0,0.04)';

const num = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// ─── Classificações derivadas ──────────────────────────────────────────────────
// Categoria do beneficiário: não há campo estruturado — derivada da profissão (texto livre).
function categoriaBeneficiario(profissao: string | null): string {
  const p = (profissao || '').toLowerCase();
  if (!p.trim()) return 'Não informado';
  if (/pension/.test(p)) return 'Pensionista';
  if (/aposentad/.test(p)) return 'Aposentado';
  if (/servidor|servidora|p[uú]blic|func.*p[uú]bl/.test(p)) return 'Servidor Público';
  return 'Outro';
}

const CATEGORIA_ORDER = ['Servidor Público', 'Aposentado', 'Pensionista', 'Outro', 'Não informado'];

function isGanho(l: LeadAnalytics) {
  return l.status === 'Ganho' || l.status === 'Contrato Assinado';
}
function isPerdido(l: LeadAnalytics) {
  return l.status === 'Perdido' || l.is_lost === true;
}

// Nome legível de UF (fallback para o próprio valor)
const UF_LABEL: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

// ─── Período ────────────────────────────────────────────────────────────────────
type Periodo = 'tudo' | 'mes' | 'trimestre' | 'ano';
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'tudo', label: 'Tudo' },
  { key: 'ano', label: 'Este ano' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'mes', label: 'Este mês' },
];
function periodoStart(p: Periodo): Date | null {
  const now = new Date();
  if (p === 'mes') return startOfMonth(now);
  if (p === 'trimestre') return startOfQuarter(now);
  if (p === 'ano') return startOfYear(now);
  return null;
}

// ─── UI building blocks ─────────────────────────────────────────────────────────
function Card({ accent, icon: Icon, title, iconBg, iconColor, children }: {
  accent: string; icon: React.ElementType; title: string; iconBg: string; iconColor: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-card" style={{ border: BORDER, boxShadow: SHADOW }}>
      <div style={{ height: 3, background: accent }} />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
            <Icon style={{ width: 16, height: 16, color: iconColor }} />
          </div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ label = 'Nenhum dado no período' }: { label?: string }) {
  return <div className="h-48 flex items-center justify-center text-center" style={{ color: NEUTRAL, fontSize: 13 }}>{label}</div>;
}

// Bar-list: ranking de categorias com rótulo direto (identidade pelo eixo, cor única).
function BarList({ data, total, color = GOLD, max }: {
  data: { name: string; value: number }[];
  total: number;
  color?: string;
  max?: number;
}) {
  const rows = typeof max === 'number' ? data.slice(0, max) : data;
  const peak = Math.max(...rows.map(r => r.value), 1);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.name} className="group">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-[12.5px] font-medium text-foreground truncate" title={r.name}>{r.name}</span>
            <span className="text-[12px] shrink-0 tabular-nums" style={{ color: NEUTRAL }}>
              <span className="font-semibold text-foreground">{num(r.value)}</span> · {pct(r.value, total)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.12)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max((r.value / peak) * 100, 3)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// KPI tile
function Kpi({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 lg:p-5" style={{ border: BORDER, boxShadow: SHADOW }}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider leading-tight" style={{ color: NEUTRAL }}>{label}</p>
        <div className="h-8 w-8 shrink-0 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-[11.5px] mt-0.5" style={{ color: NEUTRAL }}>{sub}</p>}
    </div>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────────
export default function DadosPage() {
  const { leads, loading } = useLeadsAnalytics();
  const [periodo, setPeriodo] = useState<Periodo>('tudo');

  const d = useMemo(() => {
    const start = periodoStart(periodo);
    const base = start ? leads.filter(l => { const dt = new Date(l.created_at); return !isNaN(dt.getTime()) && isAfter(dt, start); }) : leads;
    const total = base.length;

    const rank = (getKey: (l: LeadAnalytics) => string, emptyKey: string) => {
      const map: Record<string, number> = {};
      base.forEach(l => { const k = getKey(l); map[k] = (map[k] || 0) + 1; });
      return { map, arr: Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) };
    };

    // Origem
    const origem = rank(l => (l.origem && l.origem.trim()) || 'Não informado', 'Não informado');
    const origemData = origem.arr.map(e => ({ ...e, color: corOrigem(e.name) }));

    // Categoria beneficiário (ordem fixa)
    const catMap: Record<string, number> = {};
    base.forEach(l => { const k = categoriaBeneficiario(l.profissao); catMap[k] = (catMap[k] || 0) + 1; });
    const categoriaData = CATEGORIA_ORDER.filter(k => catMap[k]).map(name => ({ name, value: catMap[name] }));

    // Estado (UF)
    const estado = rank(l => { const uf = (l.uf || '').trim().toUpperCase(); return uf ? (UF_LABEL[uf] || uf) : 'Não informado'; }, 'Não informado');

    // Tipo de ação
    const acao = rank(l => (l.tipo_acao && l.tipo_acao.trim()) || 'Não informado', 'Não informado');

    // Ganhos / Perdidos
    const ganhos = base.filter(isGanho).length;
    const perdidos = base.filter(isPerdido).length;
    const decididos = ganhos + perdidos;
    const winRate = pct(ganhos, decididos);

    return { total, origemData, categoriaData, estado: estado.arr, acao: acao.arr, ganhos, perdidos, decididos, winRate };
  }, [leads, periodo]);

  const winDonut = [
    { name: 'Ganhos', value: d.ganhos, color: GREEN },
    { name: 'Perdidos', value: d.perdidos, color: RED },
  ];

  return (
    <AppLayout>
      <AppHeader title="Dados" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-background">

        {/* Filtro de período */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Painel de Dados</h2>
            <p className="text-[12.5px]" style={{ color: NEUTRAL }}>
              Origem, perfil, localização e desfecho dos leads {loading ? '' : `· ${num(d.total)} leads`}
            </p>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: BORDER }}>
            {PERIODOS.map((p, i) => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className="transition-all"
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: periodo === p.key ? BROWN : 'transparent',
                  color: periodo === p.key ? GOLD : NEUTRAL,
                  borderRight: i < PERIODOS.length - 1 ? '0.5px solid rgba(201,169,110,0.2)' : 'none',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-[60vh] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Total de Leads" value={num(d.total)} icon={Users} color={BROWN} bg="rgba(61,43,31,0.08)" />
              <Kpi label="Casos Ganhos" value={num(d.ganhos)} sub={`${pct(d.ganhos, d.total)}% do total`} icon={Trophy} color={GREEN} bg="rgba(22,163,74,0.09)" />
              <Kpi label="Casos Perdidos" value={num(d.perdidos)} sub={`${pct(d.perdidos, d.total)}% do total`} icon={XCircle} color={RED} bg="rgba(220,38,38,0.08)" />
              <Kpi label="Taxa de Conversão" value={`${d.winRate}%`} sub={`${num(d.decididos)} casos decididos`} icon={Target} color={GOLD} bg="rgba(201,169,110,0.12)" />
            </div>

            {/* Ganhos vs Perdidos + Origem */}
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              {/* Ganhos vs Perdidos */}
              <Card accent={GREEN} icon={Trophy} title="Casos Ganhos vs Perdidos" iconBg="rgba(22,163,74,0.09)" iconColor={GREEN}>
                {d.decididos > 0 ? (
                  <div className="flex items-center gap-5">
                    <div style={{ width: 150, height: 150 }} className="relative shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={winDonut} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none" isAnimationActive={false}>
                            {winDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(201,169,110,0.3)' }} formatter={(v: number, n: string) => [`${num(v)} casos`, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-extrabold" style={{ color: GREEN }}>{d.winRate}%</span>
                        <span className="text-[10px]" style={{ color: NEUTRAL }}>conversão</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(22,163,74,0.06)' }}>
                        <div className="flex items-center gap-2">
                          <Trophy style={{ width: 16, height: 16, color: GREEN }} />
                          <span className="text-[13px] font-medium text-foreground">Ganhos</span>
                        </div>
                        <span className="text-lg font-extrabold tabular-nums" style={{ color: GREEN }}>{num(d.ganhos)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)' }}>
                        <div className="flex items-center gap-2">
                          <XCircle style={{ width: 16, height: 16, color: RED }} />
                          <span className="text-[13px] font-medium text-foreground">Perdidos</span>
                        </div>
                        <span className="text-lg font-extrabold tabular-nums" style={{ color: RED }}>{num(d.perdidos)}</span>
                      </div>
                    </div>
                  </div>
                ) : <EmptyState label="Nenhum caso ganho ou perdido no período" />}
              </Card>

              {/* Origem */}
              <Card accent={BROWN} icon={PieIcon} title="Origem dos Leads" iconBg="rgba(61,43,31,0.08)" iconColor={BROWN}>
                {d.origemData.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div style={{ width: 170, height: 170 }} className="shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={d.origemData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none" isAnimationActive={false}>
                            {d.origemData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(201,169,110,0.3)' }} formatter={(v: number, n: string) => [`${num(v)} leads (${pct(v, d.total)}%)`, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full space-y-1.5 min-w-0">
                      {d.origemData.map(e => (
                        <div key={e.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                          <span className="text-[12.5px] font-medium text-foreground truncate flex-1" title={e.name}>{e.name}</span>
                          <span className="text-[11.5px] tabular-nums shrink-0" style={{ color: NEUTRAL }}>
                            <span className="font-semibold text-foreground">{num(e.value)}</span> · {pct(e.value, d.total)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <EmptyState />}
              </Card>
            </div>

            {/* Categoria + Estado */}
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
              <Card accent="#2563eb" icon={Briefcase} title="Perfil do Beneficiário" iconBg="rgba(37,99,235,0.09)" iconColor="#2563eb">
                <BarList data={d.categoriaData} total={d.total} color="#2563eb" />
                <p className="text-[11px] mt-3 pt-3" style={{ color: NEUTRAL, borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
                  Derivado da profissão informada no lead. "Não informado" = sem profissão registrada.
                </p>
              </Card>

              <Card accent={GOLD} icon={MapPin} title="Estado do Lead" iconBg="rgba(201,169,110,0.12)" iconColor="#a97e3f">
                <BarList data={d.estado} total={d.total} color={GOLD} max={10} />
              </Card>
            </div>

            {/* Tipo de ação */}
            <Card accent="#7c3aed" icon={Scale} title="Tipo de Ação" iconBg="rgba(124,58,237,0.09)" iconColor="#7c3aed">
              <BarList data={d.acao} total={d.total} color="#7c3aed" max={12} />
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
