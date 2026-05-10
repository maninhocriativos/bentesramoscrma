import { useMemo } from 'react';
import { Tarefa } from '@/types/tarefas';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { Clock, TrendingUp, CheckCircle2, AlertTriangle, Trophy } from 'lucide-react';
import { startOfWeek, format, subWeeks, isWithinInterval, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

interface Member { id: string; fullName: string; nome?: string; }

interface AnalyticsTabProps {
  tarefas: Tarefa[];
  team: Member[];
}

const PRIO_COLORS: Record<string, string> = {
  Urgente: '#dc2626',
  Alta:    GOLD,
  Media:   BROWN,
  Baixa:   '#94a3b8',
};

function StatCard({ label, value, icon: Icon, accent, suffix = '' }: {
  label: string; value: string | number; icon: any; accent: string; suffix?: string;
}) {
  return (
    <div className="rounded-2xl p-4 bg-white"
      style={{ border: `0.5px solid ${GOLD}30`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: `${accent}15` }}>
          <Icon style={{ width: 14, height: 14, color: accent }} />
        </div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: '#1c1917', lineHeight: 1 }}>
        {value}<span style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginLeft: 3 }}>{suffix}</span>
      </p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-2.5 shadow-lg"
      style={{ background: 'white', border: `0.5px solid ${GOLD}40`, fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: BROWN, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || BROWN }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export function AnalyticsTab({ tarefas, team }: AnalyticsTabProps) {
  const memberMap = useMemo(() => {
    const m: Record<string, string> = {};
    team.forEach(t => { m[t.id] = t.nome || t.fullName.split(' ')[0]; });
    return m;
  }, [team]);

  // ── Tempo médio de execução por usuário (horas) ──────────────────────────────
  const tempoMedioData = useMemo(() => {
    const map: Record<string, number[]> = {};
    tarefas.forEach(t => {
      if (!t.started_at || !t.data_conclusao || !t.responsavel_id) return;
      const hs = (new Date(t.data_conclusao + 'T23:59:59').getTime() - new Date(t.started_at).getTime()) / 3_600_000;
      if (hs <= 0 || hs > 720) return; // ignora anomalias > 30 dias
      if (!map[t.responsavel_id]) map[t.responsavel_id] = [];
      map[t.responsavel_id].push(hs);
    });
    return Object.entries(map)
      .map(([uid, vals]) => ({
        nome: memberMap[uid] || 'Usuário',
        media: vals.reduce((a, b) => a + b, 0) / vals.length,
        total: vals.length,
      }))
      .sort((a, b) => a.media - b.media);
  }, [tarefas, memberMap]);

  // ── Distribuição por prioridade ──────────────────────────────────────────────
  const prioData = useMemo(() => {
    const m: Record<string, number> = { Urgente: 0, Alta: 0, Media: 0, Baixa: 0 };
    tarefas.filter(t => t.status !== 'Cancelada').forEach(t => { m[t.prioridade] = (m[t.prioridade] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [tarefas]);

  // ── Tarefas por usuário (stacked status) ────────────────────────────────────
  const cargaData = useMemo(() => {
    return team.map(m => {
      const ts = tarefas.filter(t => t.responsavel_id === m.id && t.status !== 'Cancelada');
      return {
        nome: m.nome || m.fullName.split(' ')[0],
        Pendente:     ts.filter(t => t.status === 'Pendente').length,
        'Em Andamento': ts.filter(t => t.status === 'Em Andamento').length,
        Concluída:    ts.filter(t => t.status === 'Concluída').length,
      };
    }).filter(d => d.Pendente + d['Em Andamento'] + d.Concluída > 0);
  }, [tarefas, team]);

  // ── Tarefas concluídas por semana (últimas 5 semanas) ───────────────────────
  const tendenciaData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 5 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, 4 - i), { locale: ptBR });
      const weekEnd   = endOfWeek(weekStart, { locale: ptBR });
      const label = format(weekStart, "dd/MM", { locale: ptBR });
      const concluidas = tarefas.filter(t =>
        t.status === 'Concluída' && t.data_conclusao &&
        isWithinInterval(new Date(t.data_conclusao + 'T12:00:00'), { start: weekStart, end: weekEnd })
      ).length;
      const criadas = tarefas.filter(t =>
        isWithinInterval(new Date(t.created_at), { start: weekStart, end: weekEnd })
      ).length;
      return { semana: label, Concluídas: concluidas, Criadas: criadas };
    });
  }, [tarefas]);

  // ── Stats globais ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const concluidas = tarefas.filter(t => t.status === 'Concluída');
    const comTempo = concluidas.filter(t => t.started_at && t.data_conclusao);
    const avgHoras = comTempo.length
      ? comTempo.reduce((acc, t) => {
          const hs = (new Date(t.data_conclusao! + 'T23:59:59').getTime() - new Date(t.started_at!).getTime()) / 3_600_000;
          return acc + Math.max(0, hs);
        }, 0) / comTempo.length
      : null;
    const noPrazo = concluidas.filter(t => t.data_limite && t.data_conclusao && t.data_conclusao <= t.data_limite).length;
    const taxaPrazo = concluidas.length ? Math.round((noPrazo / concluidas.length) * 100) : null;
    const topUser = (() => {
      const m: Record<string, number> = {};
      concluidas.forEach(t => { if (t.responsavel_id) m[t.responsavel_id] = (m[t.responsavel_id] || 0) + 1; });
      const best = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
      return best ? (memberMap[best[0]] || 'N/A') : 'N/A';
    })();
    return { totalConcluidas: concluidas.length, avgHoras, taxaPrazo, topUser };
  }, [tarefas, memberMap]);

  return (
    <div className="space-y-6 pb-8">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Concluídas"       value={stats.totalConcluidas}          icon={CheckCircle2} accent="#16a34a" />
        <StatCard label="Tempo Médio"             value={stats.avgHoras != null ? stats.avgHoras.toFixed(1) : '—'} suffix={stats.avgHoras != null ? 'h' : ''} icon={Clock} accent={GOLD_D} />
        <StatCard label="Entregues no Prazo"      value={stats.taxaPrazo != null ? `${stats.taxaPrazo}%` : '—'}  icon={TrendingUp} accent="#3b82f6" />
        <StatCard label="Melhor Desempenho"       value={stats.topUser}                   icon={Trophy}       accent={BROWN} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Tempo médio por usuário */}
        <div className="rounded-2xl bg-white p-5"
          style={{ border: `0.5px solid ${GOLD}30`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15` }}>
              <Clock style={{ width: 15, height: 15, color: GOLD_D }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1c1917' }}>Tempo Médio de Execução</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }}>em horas — apenas tarefas com rastreio</p>
            </div>
          </div>
          {tempoMedioData.length === 0 ? (
            <div className="flex items-center justify-center h-40 rounded-xl"
              style={{ background: `${GOLD}08`, border: `1px dashed ${GOLD}30` }}>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>Sem dados ainda — inicie e conclua tarefas</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tempoMedioData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v.toFixed(0)}h`} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: BROWN, fontWeight: 700 }} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="media" fill={GOLD} radius={[0, 6, 6, 0]} name="Média (h)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Distribuição por prioridade */}
        <div className="rounded-2xl bg-white p-5"
          style={{ border: `0.5px solid ${GOLD}30`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <AlertTriangle style={{ width: 15, height: 15, color: '#dc2626' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1c1917' }}>Distribuição por Prioridade</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }}>todas as tarefas ativas</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ width: '60%', height: 200, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={prioData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {prioData.map((entry: { name: string; value: number }) => (
                      <Cell key={entry.name} fill={PRIO_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {prioData.map((d: { name: string; value: number }) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PRIO_COLORS[d.name] || '#94a3b8' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1c1917' }}>{d.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Carga por usuário (stacked) */}
        <div className="rounded-2xl bg-white p-5"
          style={{ border: `0.5px solid ${GOLD}30`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${BROWN}10` }}>
              <TrendingUp style={{ width: 15, height: 15, color: BROWN }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1c1917' }}>Carga por Usuário</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }}>por status das tarefas</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cargaData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${GOLD}20`} />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: BROWN, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Pendente"     stackId="a" fill="#f59e0b" radius={[0,0,0,0]} name="Pendente" />
                <Bar dataKey="Em Andamento" stackId="a" fill="#3b82f6" radius={[0,0,0,0]} name="Em Andamento" />
                <Bar dataKey="Concluída"    stackId="a" fill="#16a34a" radius={[6,6,0,0]} name="Concluída" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tendência semanal */}
        <div className="rounded-2xl bg-white p-5"
          style={{ border: `0.5px solid ${GOLD}30`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
              <TrendingUp style={{ width: 15, height: 15, color: '#3b82f6' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1c1917' }}>Tendência Semanal</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }}>criadas vs concluídas (últimas 5 semanas)</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tendenciaData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${GOLD}20`} />
                <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Criadas"    stroke={GOLD}    strokeWidth={2} dot={{ r: 4, fill: GOLD }}    name="Criadas" />
                <Line type="monotone" dataKey="Concluídas" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: '#16a34a' }} name="Concluídas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
