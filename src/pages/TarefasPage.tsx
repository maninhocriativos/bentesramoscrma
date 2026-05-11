import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTarefas, useTimesheet } from '@/hooks/useTarefas';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { TarefaDetailModal } from '@/components/tarefas/TarefaDetailModal';
import { TimesheetModal } from '@/components/tarefas/TimesheetModal';
import { TimesheetTable } from '@/components/tarefas/TimesheetTable';
import { AnalyticsTab } from '@/components/tarefas/AnalyticsTab';
import { Tarefa } from '@/types/tarefas';
import {
  Plus, Clock, AlertTriangle, CheckCircle2, CheckSquare,
  TrendingUp, Users, Star, Bell, Flame, Calendar,
  ChevronRight, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInCalendarDays, formatDistanceToNow, isPast, isToday, isTomorrow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Paleta marrom/dourado ────────────────────────────────────────────────────
const BROWN  = '#3d2b1f';
const GOLD   = '#c9a96e';
const GOLD_D = '#b8922a';

const PRIO_CFG: Record<string, { dot: string; bg: string; text: string; label: string; barColor: string }> = {
  Urgente: { dot: '#dc2626', bg: '#fef2f2',            text: '#dc2626', label: 'Urgente', barColor: '#dc2626' },
  Alta:    { dot: GOLD,      bg: 'rgba(201,169,110,0.1)', text: GOLD_D,   label: 'Alta',    barColor: GOLD },
  Media:   { dot: BROWN,     bg: 'rgba(61,43,31,0.07)',   text: BROWN,    label: 'Média',   barColor: BROWN },
  Baixa:   { dot: '#94a3b8', bg: 'rgba(148,163,184,0.08)',text: '#64748b',label: 'Baixa',   barColor: '#94a3b8' },
};

const STATUS_CFG = {
  'Pendente':     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Pendente',     dot: '#f59e0b' },
  'Em Andamento': { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', label: 'Em Andamento', dot: '#3b82f6' },
  'Concluída':    { color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   label: 'Concluída',    dot: '#16a34a' },
};

const APROV_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: GOLD_D,   bg: 'rgba(201,169,110,0.12)' },
  aprovada:             { label: 'Aprovada',             color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  devolvida:            { label: 'Devolvida',            color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function getDeadlineInfo(dl: string | null) {
  if (!dl) return null;
  const d = new Date(dl);
  if (isPast(d) && !isToday(d)) return { label: 'Atrasada', color: '#dc2626', bg: '#fef2f2' };
  if (isToday(d))   return { label: 'Vence hoje',  color: '#f59e0b', bg: '#fffbeb' };
  if (isTomorrow(d))return { label: 'Amanhã',      color: GOLD_D,    bg: 'rgba(201,169,110,0.1)' };
  return { label: format(d, "dd/MM", { locale: ptBR }), color: '#9ca3af', bg: '#f8fafc' };
}

// ── TarefaCard premium ───────────────────────────────────────────────────────
function TarefaCard({ tarefa, onClick }: { tarefa: Tarefa; onClick: () => void }) {
  const prio       = PRIO_CFG[tarefa.prioridade] || PRIO_CFG.Baixa;
  const dl         = getDeadlineInfo(tarefa.data_limite);
  const aprov      = tarefa.aprovacao_status ? APROV_CFG[tarefa.aprovacao_status] : null;
  const atrasada   = tarefa.data_limite && isPast(new Date(tarefa.data_limite)) && !isToday(new Date(tarefa.data_limite));
  const isConcluida = tarefa.status === 'Concluída';

  const cardBg     = isConcluida ? 'rgba(22,163,74,0.06)' : 'white';
  const cardBorder = isConcluida
    ? '1px solid rgba(22,163,74,0.30)'
    : `1px solid ${atrasada ? 'rgba(220,38,38,0.25)' : 'rgba(201,169,110,0.18)'}`;
  const topBar     = isConcluida ? '#16a34a' : prio.barColor;

  return (
    <div
      onClick={onClick}
      className="group rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: cardBg, border: cardBorder, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}
    >
      {/* Barra de cor no topo */}
      <div style={{ height: 3, background: topBar }} />

      <div className="p-4">
        {/* Título + badge prioridade */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p style={{ fontSize: 13, fontWeight: 700, color: isConcluida ? '#374151' : '#1c1917', lineHeight: 1.35, flex: 1 }}>
            {tarefa.titulo}
          </p>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
            background: prio.bg, color: prio.text, whiteSpace: 'nowrap', flexShrink: 0,
            border: `0.5px solid ${prio.dot}30`
          }}>
            {prio.label}
          </span>
        </div>

        {/* Descrição */}
        {tarefa.descricao && (
          <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 12 }} className="line-clamp-2">
            {tarefa.descricao}
          </p>
        )}

        {/* Footer: prazo + finalizada + aprovação + estrelas */}
        <div className="flex items-center gap-2 flex-wrap">
          {isConcluida && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(22,163,74,0.12)', color: '#16a34a',
              border: '0.5px solid rgba(22,163,74,0.30)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <CheckCircle2 style={{ width: 10, height: 10 }} />
              Finalizada
            </span>
          )}
          {!isConcluida && dl && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: dl.bg, color: dl.color,
              border: `0.5px solid ${dl.color}30`
            }}>
              {dl.label}
            </span>
          )}
          {tarefa.horario && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: 'rgba(59,130,246,0.08)', color: '#2563eb',
              border: '0.5px solid rgba(59,130,246,0.2)'
            }}>
              {tarefa.horario.slice(0, 5)}
            </span>
          )}
          {aprov && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: aprov.bg, color: aprov.color,
            }}>
              {aprov.label}
            </span>
          )}
          {tarefa.aprovacao_nota && (
            <div className="flex items-center gap-0.5 ml-auto">
              {[1,2,3,4,5].map(s => (
                <Star key={s} style={{
                  width: 11, height: 11,
                  color: s <= tarefa.aprovacao_nota! ? GOLD : '#e5e7eb',
                  fill: s <= tarefa.aprovacao_nota! ? GOLD : 'transparent'
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AlertaItem ───────────────────────────────────────────────────────────────
function AlertaItem({ tarefa, onClick }: { tarefa: Tarefa; onClick: () => void }) {
  const prio = PRIO_CFG[tarefa.prioridade] || PRIO_CFG.Baixa;
  const dl   = tarefa.data_limite ? new Date(tarefa.data_limite) : null;
  const atrasada = dl && isPast(dl) && !isToday(dl);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{
        border: `0.5px solid ${atrasada ? 'rgba(220,38,38,0.25)' : 'rgba(201,169,110,0.2)'}`,
        background: atrasada ? 'rgba(220,38,38,0.03)' : 'white',
        borderLeft: `3px solid ${atrasada ? '#dc2626' : prio.dot}`,
      }}
    >
      <div className="h-7 w-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: atrasada ? 'rgba(220,38,38,0.1)' : prio.bg }}>
        {atrasada
          ? <AlertTriangle style={{ width: 13, height: 13, color: '#dc2626' }} className="animate-pulse" />
          : <Flame style={{ width: 13, height: 13, color: prio.dot }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12, fontWeight: 700, color: '#1c1917', lineHeight: 1.35 }} className="line-clamp-2">{tarefa.titulo}</p>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
          {atrasada
            ? `Atrasada ${formatDistanceToNow(dl!, { locale: ptBR, addSuffix: true })}`
            : dl ? `Vence ${formatDistanceToNow(dl, { locale: ptBR, addSuffix: true })}` : 'Urgente — sem prazo'
          }
        </p>
      </div>
      <ChevronRight style={{ width: 14, height: 14, color: '#d1d5db', flexShrink: 0, marginTop: 3 }} />
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, accent, bg, suffix = '', highlight = false }: {
  label: string; value: number | string; icon: any; accent: string; bg: string; suffix?: string; highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ border: `0.5px solid ${highlight ? accent + '40' : 'rgba(201,169,110,0.2)'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ height: 3, background: accent }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
          <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: bg }}>
            <Icon style={{ width: 14, height: 14, color: accent }} />
          </div>
        </div>
        <p style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: highlight && Number(value) > 0 ? accent : '#1c1917' }}>
          {value}{suffix}
        </p>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TarefasPage() {
  const { user }   = useAuth();
  const { perfil } = usePerfil();
  const userName = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || user?.email || '';
  const { getTeamWithStatus } = useTeamPresence(user?.id, userName);
  const { canAccessSettings: isAdmin } = usePerfil();
  const { tarefas, loading, updateTarefa, deleteTarefa, fetchTarefas } = useTarefas();
  const { registros, loading: loadingTS } = useTimesheet();
  const team = getTeamWithStatus();

  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [timesheetModalOpen, setTimesheetModal] = useState(false);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [detailTarefa, setDetailTarefa] = useState<Tarefa | null>(null);
  const [activeUser, setActiveUser] = useState<string>('all');
  const [criticalPopupOpen, setCriticalPopupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('kanban');

  const handleNew = () => { setSelectedTarefa(null); setTarefaModalOpen(true); };

  const kpis = useMemo(() => {
    const ativas = tarefas.filter(t => t.status !== 'Concluída' && t.status !== 'Cancelada');
    const atrasadas = ativas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && !isToday(new Date(t.data_limite)));
    const totalHoras = registros.reduce((a, r) => a + r.duracao_minutos, 0) / 60;
    return {
      pendentes:   tarefas.filter(t => t.status === 'Pendente').length,
      emAndamento: tarefas.filter(t => t.status === 'Em Andamento').length,
      concluidas:  tarefas.filter(t => t.status === 'Concluída').length,
      urgentes:    ativas.filter(t => t.prioridade === 'Urgente').length,
      atrasadas:   atrasadas.length,
      hojePrazo:   ativas.filter(t => t.data_limite && isToday(new Date(t.data_limite))).length,
      aguardando:  tarefas.filter(t => t.aprovacao_status === 'aguardando_aprovacao').length,
      totalHoras,
    };
  }, [tarefas, registros]);

  const alertas = useMemo(() => {
    const ativas = tarefas.filter(t => t.status !== 'Concluída' && t.status !== 'Cancelada');
    return [
      ...ativas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && !isToday(new Date(t.data_limite))),
      ...ativas.filter(t => t.data_limite && isToday(new Date(t.data_limite))),
      ...ativas.filter(t => t.prioridade === 'Urgente' && !t.data_limite),
      ...tarefas.filter(t => t.aprovacao_status === 'aguardando_aprovacao'),
    ].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 20);
  }, [tarefas]);

  const criticalTasks = useMemo(() => {
    if (!user) return [];
    return tarefas
      .filter(t => t.responsavel_id === user.id && t.status !== 'Concluída' && t.status !== 'Cancelada')
      .filter(t => {
        const deadline = t.prazo_fatal || t.data_limite;
        if (!deadline) return false;
        return differenceInCalendarDays(new Date(deadline), new Date()) <= 3;
      })
      .sort((a, b) => new Date(a.prazo_fatal || a.data_limite || '').getTime() - new Date(b.prazo_fatal || b.data_limite || '').getTime())
      .slice(0, 5);
  }, [tarefas, user]);

  useEffect(() => {
    if (criticalTasks.length > 0) setCriticalPopupOpen(true);
  }, [criticalTasks.length]);
  const tarefasPorUsuario = useMemo(() => {
    const map: Record<string, Tarefa[]> = {};
    tarefas.forEach(t => {
      const uid = t.responsavel_id || 'sem_responsavel';
      if (!map[uid]) map[uid] = [];
      map[uid].push(t);
    });
    return map;
  }, [tarefas]);

  const filteredTarefas = useMemo(() =>
    activeUser === 'all' ? tarefas : (tarefasPorUsuario[activeUser] || []),
    [activeUser, tarefas, tarefasPorUsuario]
  );

  const columns = ['Pendente', 'Em Andamento', 'Concluída'] as const;

  return (
    <AppLayout>
      <AppHeader title="Tarefas & Timesheet" />

      <div className="flex-1 overflow-auto" style={{ background: '#faf9f7' }}>
        <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: BROWN, letterSpacing: '-0.02em' }}>Gestão de Tarefas</h1>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Controle de demandas, prazos e timesheet da equipe</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setTimesheetModal(true)} variant="outline" size="sm"
                style={{ borderColor: `${GOLD}60`, color: BROWN, fontSize: 12, fontWeight: 600 }}>
                <Clock style={{ width: 14, height: 14, marginRight: 6 }} /> Registrar Horas
              </Button>
              <Button onClick={handleNew} size="sm"
                style={{ background: BROWN, color: GOLD, fontSize: 12, fontWeight: 700 }}>
                <Plus style={{ width: 14, height: 14, marginRight: 6 }} /> Nova Tarefa
              </Button>
            </div>
          </div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            <KpiCard label="Pendentes"   value={kpis.pendentes}   icon={CheckSquare} accent="#f59e0b" bg="rgba(245,158,11,0.08)" />
            <KpiCard label="Em Andamento" value={kpis.emAndamento} icon={TrendingUp}  accent="#3b82f6" bg="rgba(59,130,246,0.08)" />
            <KpiCard label="Concluídas"  value={kpis.concluidas}  icon={CheckCircle2} accent="#16a34a" bg="rgba(22,163,74,0.08)" />
            <KpiCard label="Urgentes"    value={kpis.urgentes}    icon={Flame}       accent="#dc2626" bg="rgba(220,38,38,0.08)" highlight />
            <KpiCard label="Atrasadas"   value={kpis.atrasadas}   icon={AlertTriangle} accent="#dc2626" bg="rgba(220,38,38,0.08)" highlight />
            <KpiCard label="Vence Hoje"  value={kpis.hojePrazo}   icon={Calendar}    accent={GOLD}    bg={`${GOLD}15`} />
            <KpiCard label="Aguard. Apr." value={kpis.aguardando}  icon={Bell}        accent={GOLD_D}  bg={`${GOLD}12`} />
            <KpiCard label="Horas/Mês"   value={kpis.totalHoras.toFixed(1)} icon={Clock} accent={BROWN} bg={`${BROWN}08`} suffix="h" />
          </div>

          {/* ── Layout principal ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">

            {/* Kanban + Tabs */}
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                {/* Tab header + filtro usuário */}
                <div className="flex items-center gap-3 flex-wrap">
                  <TabsList className="h-9" style={{ background: `${GOLD}12`, border: `0.5px solid ${GOLD}30` }}>
                    <TabsTrigger value="kanban"    style={{ fontSize: 12, fontWeight: 600 }}>Quadro</TabsTrigger>
                    <TabsTrigger value="equipe"    style={{ fontSize: 12, fontWeight: 600 }}>Por Usuário</TabsTrigger>
                    <TabsTrigger value="timesheet" style={{ fontSize: 12, fontWeight: 600 }}>Timesheet</TabsTrigger>
                    {isAdmin && <TabsTrigger value="analytics" style={{ fontSize: 12, fontWeight: 600 }}>Analytics</TabsTrigger>}
                  </TabsList>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[{ id: 'all', label: 'Todos', online: false },...team.map(m => ({ id: m.id, label: m.nome || m.fullName.split(' ')[0], online: m.online }))].map(u => {
                      const count = u.id === 'all' ? 0 : (tarefasPorUsuario[u.id] || []).filter(t => t.status !== 'Concluída').length;
                      const isActive = activeUser === u.id;
                      return (
                        <button key={u.id} onClick={() => setActiveUser(u.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold"
                          style={{ background: isActive ? BROWN : `${BROWN}07`, color: isActive ? GOLD : '#9ca3af', border: `0.5px solid ${isActive ? BROWN : 'transparent'}` }}>
                          {u.id !== 'all' && <Circle style={{ width: 6, height: 6, fill: u.online ? '#22c55e' : '#d1d5db', color: u.online ? '#22c55e' : '#d1d5db' }} />}
                          {u.label}
                          {count > 0 && (
                            <span style={{ fontSize: 9, fontWeight: 800, background: '#dc2626', color: 'white', borderRadius: 5, padding: '0 4px', lineHeight: '14px' }}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Kanban */}
                <TabsContent value="kanban" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {columns.map(col => {
                      const cfg = STATUS_CFG[col];
                      const colTarefas = filteredTarefas.filter(t => t.status === col);
                      return (
                        <div key={col} className="rounded-2xl overflow-hidden flex flex-col"
                          style={{ background: 'white', border: `0.5px solid rgba(201,169,110,0.18)`, minHeight: 480, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

                          {/* Col header */}
                          <div className="flex items-center gap-2.5 px-4 py-3.5"
                            style={{ borderBottom: `2px solid ${cfg.bg}`, background: cfg.bg }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: cfg.color }} />
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#1c1917', flex: 1 }}>{cfg.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: 'white', color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                              {colTarefas.length}
                            </span>
                          </div>

                          {/* Cards */}
                          <div className="p-3 space-y-2.5 flex-1">
                            {loading ? (
                              [1,2].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(201,169,110,0.08)' }} />)
                            ) : colTarefas.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full py-16" style={{ color: '#e5e7eb' }}>
                                <CheckCircle2 style={{ width: 32, height: 32, marginBottom: 8, color: '#e5e7eb' }} />
                                <p style={{ fontSize: 12, fontWeight: 500, color: '#d1d5db' }}>Sem tarefas aqui</p>
                              </div>
                            ) : (
                              colTarefas.map(t => <TarefaCard key={t.id} tarefa={t} onClick={() => setDetailTarefa(t)} />)
                            )}
                          </div>

                          {/* Add button */}
                          <div className="p-3 pt-0">
                            <button onClick={handleNew}
                              className="w-full py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px dashed ${cfg.color}40` }}>
                              + Adicionar tarefa
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* Por usuário */}
                <TabsContent value="equipe" className="mt-4">
                  <div className="space-y-4">
                    {team.map(member => {
                      const mTarefas = tarefasPorUsuario[member.id] || [];
                      const ativas   = mTarefas.filter(t => t.status !== 'Concluída');
                      const urgentes = mTarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída');
                      const atrasadas = mTarefas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && !isToday(new Date(t.data_limite)) && t.status !== 'Concluída');
                      const accentColor = urgentes.length > 0 ? '#dc2626' : atrasadas.length > 0 ? GOLD : BROWN;

                      return (
                        <div key={member.id} className="rounded-2xl overflow-hidden bg-white"
                          style={{ border: `0.5px solid rgba(201,169,110,0.2)`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                          <div style={{ height: 3, background: accentColor }} />
                          <div className="flex items-center gap-3 px-5 py-3.5"
                            style={{ borderBottom: '0.5px solid rgba(201,169,110,0.1)' }}>
                            <div className="relative">
                              <Avatar className="h-10 w-10" style={{ border: `1.5px solid ${GOLD}40` }}>
                                <AvatarFallback style={{ background: `${BROWN}10`, color: BROWN, fontSize: 12, fontWeight: 800 }}>
                                  {getInitials(member.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
                                style={{ background: member.online ? '#22c55e' : '#d1d5db', border: '2px solid white' }} />
                            </div>
                            <div className="flex-1">
                              <p style={{ fontSize: 14, fontWeight: 800, color: '#1c1917' }}>{member.fullName}</p>
                              <p style={{ fontSize: 11, color: '#9ca3af' }}>{member.online ? '● Online' : '○ Offline'} · {ativas.length} tarefa{ativas.length !== 1 ? 's' : ''} ativa{ativas.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex gap-2">
                              {urgentes.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: '#fef2f2', color: '#dc2626' }}>{urgentes.length} urgente{urgentes.length > 1 ? 's' : ''}</span>}
                              {atrasadas.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: '#fffbeb', color: '#f59e0b' }}>{atrasadas.length} atrasada{atrasadas.length > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                          {mTarefas.length === 0
                            ? <div className="py-8 text-center" style={{ color: '#d1d5db', fontSize: 12 }}>Sem tarefas atribuídas</div>
                            : <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {mTarefas.slice(0, 6).map(t => <TarefaCard key={t.id} tarefa={t} onClick={() => setDetailTarefa(t)} />)}
                                {mTarefas.length > 6 && (
                                  <div className="flex items-center justify-center rounded-2xl cursor-pointer hover:bg-stone-50 transition-colors"
                                    style={{ border: `1px dashed ${GOLD}40`, minHeight: 60 }}>
                                    <p style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>+{mTarefas.length - 6} mais</p>
                                  </div>
                                )}
                              </div>
                          }
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* Timesheet */}
                <TabsContent value="timesheet" className="mt-4">
                  <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '0.5px solid rgba(201,169,110,0.2)' }}>
                    <div className="px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)', background: `${GOLD}06` }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: BROWN }}>Controle de Horas</p>
                    </div>
                    <div className="p-4"><TimesheetTable registros={registros} loading={loadingTS} /></div>
                  </div>
                </TabsContent>

                {/* Analytics — admin only — monta somente quando a tab está ativa para Recharts medir corretamente */}
                {isAdmin && activeTab === 'analytics' && (
                  <TabsContent value="analytics" className="mt-4">
                    <AnalyticsTab tarefas={tarefas} team={team} />
                  </TabsContent>
                )}
              </Tabs>
            </div>

            {/* ── Sidebar ── */}
            <div className="space-y-4">

              {/* Alertas */}
              <div className="rounded-2xl overflow-hidden bg-white"
                style={{ border: `0.5px solid ${alertas.length > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(201,169,110,0.2)'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 3, background: alertas.length > 0 ? '#dc2626' : '#16a34a' }} />
                <div className="flex items-center gap-2.5 px-4 py-3.5"
                  style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                    style={{ background: alertas.length > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)' }}>
                    <AlertTriangle style={{ width: 15, height: 15, color: alertas.length > 0 ? '#dc2626' : '#16a34a' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', flex: 1 }}>Alertas</span>
                  {alertas.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '0.5px solid rgba(220,38,38,0.25)' }}>
                      {alertas.length}
                    </span>
                  )}
                </div>
                {alertas.length === 0 ? (
                  <div className="py-10 text-center px-4">
                    <CheckCircle2 style={{ width: 28, height: 28, color: '#16a34a', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>Tudo em dia!</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Nenhuma tarefa urgente ou atrasada</p>
                  </div>
                ) : (
                  <ScrollArea style={{ maxHeight: 380 }}>
                    <div className="p-3 space-y-2">
                      {alertas.map(t => <AlertaItem key={t.id} tarefa={t} onClick={() => setDetailTarefa(t)} />)}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Carga por usuário */}
              <div className="rounded-2xl overflow-hidden bg-white"
                style={{ border: '0.5px solid rgba(201,169,110,0.2)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 3, background: GOLD }} />
                <div className="flex items-center gap-2.5 px-4 py-3.5"
                  style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}12` }}>
                    <Users style={{ width: 15, height: 15, color: GOLD_D }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>Carga por Usuário</span>
                </div>
                <div className="p-4 space-y-4">
                  {team.map(member => {
                    const mTarefas = tarefasPorUsuario[member.id] || [];
                    const ativas   = mTarefas.filter(t => t.status !== 'Concluída').length;
                    const urgentes = mTarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída').length;
                    const maxCarga = Math.max(...team.map(m => (tarefasPorUsuario[m.id] || []).filter(t => t.status !== 'Concluída').length), 1);
                    const pct = Math.round((ativas / maxCarga) * 100);
                    const barColor = urgentes > 0 ? '#dc2626' : pct > 70 ? GOLD : BROWN;

                    return (
                      <div key={member.id}>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <div className="relative shrink-0">
                            <div className="h-7 w-7 rounded-xl flex items-center justify-center text-[10px] font-black"
                              style={{ background: `${BROWN}10`, color: BROWN }}>
                              {getInitials(member.fullName)}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
                              style={{ background: member.online ? '#22c55e' : '#d1d5db', border: '1.5px solid white' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1917', flex: 1 }} className="truncate">
                            {member.nome || member.fullName.split(' ')[0]}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: urgentes > 0 ? '#dc2626' : '#9ca3af' }}>{ativas}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.12)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal de Prazo Crítico ── */}
      <Dialog open={criticalPopupOpen} onOpenChange={setCriticalPopupOpen}>
        <DialogContent
          hideCloseButton
          className="p-0 overflow-hidden gap-0"
          style={{
            width: 'calc(100vw - 32px)',
            maxWidth: 460,
            borderRadius: 20,
            border: '1px solid rgba(220,38,38,0.35)',
            boxShadow: '0 32px 80px rgba(220,38,38,0.18), 0 8px 24px rgba(0,0,0,0.20)',
          }}
        >
          {/* Barra superior vermelha */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #7f1d1d, #dc2626, #ef4444)' }} />

          {/* Header dramático */}
          <div className="px-6 pt-5 pb-4" style={{ background: 'linear-gradient(160deg, #1c0606 0%, #3b0d0d 100%)' }}>
            <div className="flex items-start gap-4">
              {/* Ícone pulsante */}
              <div className="relative shrink-0 mt-0.5">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.20)', border: '1px solid rgba(220,38,38,0.40)' }}>
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-[#1c0606] animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400/80 mb-0.5">Atenção urgente</p>
                <h2 className="text-lg font-black text-white leading-tight">
                  {criticalTasks.length} tarefa{criticalTasks.length !== 1 ? 's' : ''} com prazo crítico
                </h2>
                <p className="text-[12px] text-red-200/60 mt-1 leading-snug">
                  {criticalTasks.filter(t => differenceInCalendarDays(new Date(t.prazo_fatal || t.data_limite || ''), new Date()) < 0).length > 0
                    ? `${criticalTasks.filter(t => differenceInCalendarDays(new Date(t.prazo_fatal || t.data_limite || ''), new Date()) < 0).length} já vencida${criticalTasks.filter(t => differenceInCalendarDays(new Date(t.prazo_fatal || t.data_limite || ''), new Date()) < 0).length !== 1 ? 's' : ''} — ação imediata necessária`
                    : 'Prazos fatais próximos — revise e aja agora'}
                </p>
              </div>
              {/* Botão fechar */}
              <button
                onClick={() => setCriticalPopupOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:opacity-70 shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <span className="text-white/60 text-sm leading-none">✕</span>
              </button>
            </div>
          </div>

          {/* Lista de tarefas */}
          <div className="px-4 py-3 space-y-2 max-h-[340px] overflow-y-auto" style={{ background: '#fff' }}>
            {criticalTasks.map((tarefa, idx) => {
              const deadline = tarefa.prazo_fatal || tarefa.data_limite;
              const days = deadline ? differenceInCalendarDays(new Date(deadline), new Date()) : null;
              const isOverdue = days !== null && days < 0;
              const isToday0  = days === 0;
              const overdueDays = isOverdue ? Math.abs(days!) : 0;
              // Intensidade por dias de atraso
              const intensity = isOverdue
                ? overdueDays >= 30 ? 'extreme' : overdueDays >= 7 ? 'high' : 'medium'
                : isToday0 ? 'today' : 'upcoming';
              const badgeStyle: Record<string, React.CSSProperties> = {
                extreme:  { background: '#7f1d1d', color: '#fca5a5' },
                high:     { background: '#991b1b', color: '#fca5a5' },
                medium:   { background: '#dc2626', color: '#fff' },
                today:    { background: '#ea580c', color: '#fff' },
                upcoming: { background: '#b45309', color: '#fff' },
              };
              const rowBorder: Record<string, string> = {
                extreme: 'rgba(127,29,29,0.50)',
                high:    'rgba(153,27,27,0.40)',
                medium:  'rgba(220,38,38,0.30)',
                today:   'rgba(234,88,12,0.30)',
                upcoming:'rgba(180,83,9,0.25)',
              };
              const rowBg: Record<string, string> = {
                extreme: 'rgba(127,29,29,0.06)',
                high:    'rgba(153,27,27,0.05)',
                medium:  'rgba(220,38,38,0.04)',
                today:   'rgba(234,88,12,0.04)',
                upcoming:'rgba(180,83,9,0.04)',
              };
              return (
                <button
                  key={tarefa.id}
                  className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    border: `1px solid ${rowBorder[intensity]}`,
                    background: rowBg[intensity],
                    borderLeftWidth: 3,
                    borderLeftColor: isOverdue ? '#dc2626' : isToday0 ? '#ea580c' : '#b45309',
                  }}
                  onClick={() => { setCriticalPopupOpen(false); setDetailTarefa(tarefa); }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isOverdue && <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        {isToday0 && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                        <p className="text-sm font-bold text-gray-900 truncate">{tarefa.titulo}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Prazo fatal: {deadline ? format(new Date(deadline), "dd/MM/yyyy", { locale: ptBR }) : 'sem prazo'}
                        {tarefa.horario ? ` às ${tarefa.horario.slice(0, 5)}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black whitespace-nowrap"
                        style={badgeStyle[intensity]}
                      >
                        {isOverdue ? `${overdueDays}d atraso` : isToday0 ? 'HOJE' : `${days}d`}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 pt-2 flex gap-2" style={{ background: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
            <button
              onClick={() => setCriticalPopupOpen(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.06)', color: '#374151' }}
            >
              Ver depois
            </button>
            <button
              onClick={() => setCriticalPopupOpen(false)}
              className="flex-[2] py-2.5 rounded-xl text-sm font-black transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #991b1b, #dc2626)', color: '#fff' }}
            >
              Entendido — Vou resolver
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <TarefaDetailModal open={!!detailTarefa} onOpenChange={o => !o && setDetailTarefa(null)} tarefa={detailTarefa}
        onEdit={t => { setDetailTarefa(null); setSelectedTarefa(t); setTarefaModalOpen(true); }}
        onSuccess={fetchTarefas} />
      <TarefaModal open={tarefaModalOpen} onOpenChange={setTarefaModalOpen} tarefa={selectedTarefa} onDelete={deleteTarefa} onSuccess={fetchTarefas} />
      <TimesheetModal open={timesheetModalOpen} onOpenChange={setTimesheetModal} />
    </AppLayout>
  );
}
