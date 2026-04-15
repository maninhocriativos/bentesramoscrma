import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTarefas, useTimesheet } from '@/hooks/useTarefas';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { TarefaModal } from '@/components/tarefas/TarefaModal';
import { TarefaDetailModal } from '@/components/tarefas/TarefaDetailModal';
import { TimesheetModal } from '@/components/tarefas/TimesheetModal';
import { TimesheetTable } from '@/components/tarefas/TimesheetTable';
import { Tarefa } from '@/types/tarefas';
import {
  Plus, Clock, AlertTriangle, CheckCircle2, CheckSquare,
  TrendingUp, Users, Star, RotateCcw, ChevronRight,
  Flame, Calendar, Target, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isPast, isToday, isTomorrow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Config ─────────────────────────────────────────────────────────────────
const PRIO_CFG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  Urgente: { dot: '#dc2626', bg: 'rgba(220,38,38,0.08)', text: '#dc2626', label: 'Urgente' },
  Alta:    { dot: '#c9a96e', bg: 'rgba(201,169,110,0.1)', text: '#b8922a', label: 'Alta' },
  Media:   { dot: '#3d2b1f', bg: 'rgba(61,43,31,0.08)',  text: '#3d2b1f', label: 'Média' },
  Baixa:   { dot: '#94a3b8', bg: 'rgba(148,163,184,0.1)', text: '#64748b', label: 'Baixa' },
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  'Pendente':    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Pendente' },
  'Em Andamento':{ color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Em Andamento' },
  'Concluída':   { color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  label: 'Concluída' },
};

const APROV_CFG: Record<string, { label: string; color: string; bg: string }> = {
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: '#b8922a', bg: 'rgba(201,169,110,0.12)' },
  aprovada:             { label: 'Aprovada',             color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  devolvida:            { label: 'Devolvida',            color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function getDeadlineInfo(dataLimite: string | null) {
  if (!dataLimite) return null;
  const d = new Date(dataLimite);
  if (isPast(d) && !isToday(d)) return { label: 'Atrasada', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
  if (isToday(d)) return { label: 'Hoje!', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (isTomorrow(d)) return { label: 'Amanhã', color: '#c9a96e', bg: 'rgba(201,169,110,0.1)' };
  return { label: format(d, 'dd/MM', { locale: ptBR }), color: '#9ca3af', bg: 'transparent' };
}

// ── TarefaCard ───────────────────────────────────────────────────────────────
function TarefaCard({ tarefa, onClick }: { tarefa: Tarefa; onClick: () => void }) {
  const prio = PRIO_CFG[tarefa.prioridade] || PRIO_CFG.Baixa;
  const dl   = getDeadlineInfo(tarefa.data_limite);
  const aprov = tarefa.aprovacao_status ? APROV_CFG[tarefa.aprovacao_status] : null;

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: 'white',
        border: `0.5px solid rgba(201,169,110,0.2)`,
        borderLeft: `3px solid ${prio.dot}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917', lineHeight: 1.3 }} className="flex-1">
          {tarefa.titulo}
        </p>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: prio.bg, color: prio.text, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {prio.label}
        </span>
      </div>

      {tarefa.descricao && (
        <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4, marginBottom: 8 }} className="line-clamp-2">
          {tarefa.descricao}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {dl && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: dl.bg, color: dl.color }}>
            {dl.label}
          </span>
        )}
        {aprov && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, background: aprov.bg, color: aprov.color }}>
            {aprov.label}
          </span>
        )}
        {tarefa.aprovacao_nota && (
          <div className="flex items-center gap-0.5 ml-auto">
            {[1,2,3,4,5].map(s => (
              <Star key={s} style={{ width: 10, height: 10, color: s <= tarefa.aprovacao_nota! ? '#c9a96e' : '#e5e7eb', fill: s <= tarefa.aprovacao_nota! ? '#c9a96e' : 'transparent' }} />
            ))}
          </div>
        )}
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
      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-stone-50"
      style={{ border: `0.5px solid ${atrasada ? 'rgba(220,38,38,0.2)' : 'rgba(201,169,110,0.15)'}`, background: atrasada ? 'rgba(220,38,38,0.03)' : 'white', marginBottom: 6 }}
    >
      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: prio.bg }}>
        {atrasada
          ? <AlertTriangle style={{ width: 13, height: 13, color: '#dc2626' }} className="animate-pulse" />
          : <Flame style={{ width: 13, height: 13, color: prio.dot }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1917' }} className="truncate">{tarefa.titulo}</p>
        <p style={{ fontSize: 11, color: '#9ca3af' }}>
          {atrasada
            ? `Atrasada ${formatDistanceToNow(dl!, { locale: ptBR, addSuffix: true })}`
            : dl ? `Vence ${formatDistanceToNow(dl, { locale: ptBR, addSuffix: true })}` : 'Sem prazo'
          }
        </p>
      </div>
      <ChevronRight style={{ width: 14, height: 14, color: '#d1d5db', flexShrink: 0 }} />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TarefasPage() {
  const { user }   = useAuth();
  const { perfil } = usePerfil();
  const userName = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || user?.email || '';
  const { getTeamWithStatus } = useTeamPresence(user?.id, userName);
  const { tarefas, loading, updateTarefa, deleteTarefa } = useTarefas();
  const { registros, loading: loadingTS } = useTimesheet();
  const team = getTeamWithStatus();

  const [tarefaModalOpen, setTarefaModalOpen]   = useState(false);
  const [timesheetModalOpen, setTimesheetModal]  = useState(false);
  const [selectedTarefa, setSelectedTarefa]      = useState<Tarefa | null>(null);
  const [detailTarefa, setDetailTarefa]          = useState<Tarefa | null>(null);
  const [activeUser, setActiveUser]              = useState<string | 'all'>('all');

  const handleNew = () => { setSelectedTarefa(null); setTarefaModalOpen(true); };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const ativas = tarefas.filter(t => t.status !== 'Concluída' && t.status !== 'Cancelada');
    const atrasadas = ativas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && !isToday(new Date(t.data_limite)));
    const aguardando = tarefas.filter(t => t.aprovacao_status === 'aguardando_aprovacao');
    const hojePrazo = ativas.filter(t => t.data_limite && isToday(new Date(t.data_limite)));
    const totalHoras = registros.reduce((a, r) => a + r.duracao_minutos, 0) / 60;

    return {
      pendentes:    tarefas.filter(t => t.status === 'Pendente').length,
      emAndamento:  tarefas.filter(t => t.status === 'Em Andamento').length,
      concluidas:   tarefas.filter(t => t.status === 'Concluída').length,
      urgentes:     tarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída').length,
      atrasadas:    atrasadas.length,
      aguardando:   aguardando.length,
      hojePrazo:    hojePrazo.length,
      totalHoras,
    };
  }, [tarefas, registros]);

  // ── Alertas ───────────────────────────────────────────────────────────────
  const alertas = useMemo(() => {
    const ativas = tarefas.filter(t => t.status !== 'Concluída' && t.status !== 'Cancelada');
    return [
      // Atrasadas
      ...ativas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && !isToday(new Date(t.data_limite))),
      // Hoje
      ...ativas.filter(t => t.data_limite && isToday(new Date(t.data_limite))),
      // Urgentes sem prazo
      ...ativas.filter(t => t.prioridade === 'Urgente' && !t.data_limite),
      // Aguardando aprovação
      ...tarefas.filter(t => t.aprovacao_status === 'aguardando_aprovacao'),
    ].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i).slice(0, 20);
  }, [tarefas]);

  // ── Tarefas por usuário ───────────────────────────────────────────────────
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

      <div className="flex-1 overflow-auto">
        <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-black text-foreground" style={{ color: '#3d2b1f' }}>Gestão de Tarefas</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Controle de demandas, prazos e timesheet da equipe</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setTimesheetModal(true)} variant="outline" size="sm" style={{ borderColor: 'rgba(201,169,110,0.4)', color: '#3d2b1f' }}>
                <Clock style={{ width: 14, height: 14, marginRight: 6 }} /> Registrar Horas
              </Button>
              <Button onClick={handleNew} size="sm" style={{ background: '#3d2b1f', color: '#c9a96e' }}>
                <Plus style={{ width: 14, height: 14, marginRight: 6 }} /> Nova Tarefa
              </Button>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Pendentes',    value: kpis.pendentes,   icon: CheckSquare, accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
              { label: 'Em Andamento', value: kpis.emAndamento, icon: TrendingUp,  accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
              { label: 'Concluídas',   value: kpis.concluidas,  icon: CheckCircle2,accent: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
              { label: 'Urgentes',     value: kpis.urgentes,    icon: Flame,       accent: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
              { label: 'Atrasadas',    value: kpis.atrasadas,   icon: AlertTriangle,accent:'#dc2626', bg: 'rgba(220,38,38,0.08)' },
              { label: 'Vence Hoje',   value: kpis.hojePrazo,   icon: Calendar,    accent: '#c9a96e', bg: 'rgba(201,169,110,0.1)' },
              { label: 'Aguard. Apr.', value: kpis.aguardando,  icon: Bell,        accent: '#b8922a', bg: 'rgba(201,169,110,0.12)' },
              { label: 'Horas/Mês',    value: kpis.totalHoras.toFixed(1), icon: Clock, accent: '#3d2b1f', bg: 'rgba(61,43,31,0.06)', suffix: 'h' },
            ].map((k, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.2)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="h-[3px]" style={{ background: k.accent }} />
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
                    <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                      <k.icon style={{ width: 12, height: 12, color: k.accent }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: k.value > 0 && (k.label === 'Atrasadas' || k.label === 'Urgentes') ? k.accent : '#1c1917' }}>
                    {k.value}{(k as any).suffix || ''}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main content ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">

            {/* ── Kanban + Tabs ── */}
            <div className="space-y-4">
              <Tabs defaultValue="kanban">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <TabsList style={{ background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.2)' }}>
                    <TabsTrigger value="kanban" style={{ fontSize: 12 }}>Quadro de Tarefas</TabsTrigger>
                    <TabsTrigger value="timesheet" style={{ fontSize: 12 }}>Timesheet</TabsTrigger>
                    <TabsTrigger value="equipe" style={{ fontSize: 12 }}>Por Usuário</TabsTrigger>
                  </TabsList>

                  {/* Filtro de usuário */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setActiveUser('all')}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{ background: activeUser === 'all' ? '#3d2b1f' : 'rgba(61,43,31,0.06)', color: activeUser === 'all' ? '#c9a96e' : '#9ca3af' }}
                    >
                      Todos
                    </button>
                    {team.slice(0, 6).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setActiveUser(m.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={{ background: activeUser === m.id ? '#3d2b1f' : 'rgba(61,43,31,0.06)', color: activeUser === m.id ? '#c9a96e' : '#9ca3af' }}
                      >
                        <div className={cn('w-1.5 h-1.5 rounded-full', m.online ? 'bg-emerald-500' : 'bg-gray-300')} />
                        {m.nome || m.fullName.split(' ')[0]}
                        {tarefasPorUsuario[m.id]?.filter(t => t.status !== 'Concluída').length > 0 && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: '#dc2626', color: 'white', borderRadius: 4, padding: '0 3px' }}>
                            {tarefasPorUsuario[m.id].filter(t => t.status !== 'Concluída').length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kanban */}
                <TabsContent value="kanban" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {columns.map(col => {
                      const cfg = STATUS_CFG[col];
                      const colTarefas = filteredTarefas.filter(t => t.status === col);
                      return (
                        <div key={col} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(201,169,110,0.03)', border: '0.5px solid rgba(201,169,110,0.15)' }}>
                          {/* Col header */}
                          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#3d2b1f' }}>{cfg.label}</span>
                            <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: cfg.bg, color: cfg.color }}>
                              {colTarefas.length}
                            </span>
                          </div>
                          {/* Cards */}
                          <div className="p-3 space-y-2 min-h-48">
                            {loading
                              ? <div className="h-20 rounded-xl bg-muted/30 animate-pulse" />
                              : colTarefas.length === 0
                              ? <div className="flex flex-col items-center justify-center py-8" style={{ color: '#d1d5db' }}>
                                  <CheckCircle2 style={{ width: 20, height: 20, marginBottom: 4 }} />
                                  <p style={{ fontSize: 11 }}>Nenhuma tarefa</p>
                                </div>
                              : colTarefas.map(t => (
                                  <TarefaCard key={t.id} tarefa={t} onClick={() => setDetailTarefa(t)} />
                                ))
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* Timesheet */}
                <TabsContent value="timesheet" className="mt-4">
                  <div className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.2)' }}>
                    <div className="px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)', background: 'rgba(201,169,110,0.04)' }}>
                      <p className="text-sm font-semibold" style={{ color: '#3d2b1f' }}>Controle de Horas</p>
                    </div>
                    <div className="p-4">
                      <TimesheetTable registros={registros} loading={loadingTS} />
                    </div>
                  </div>
                </TabsContent>

                {/* Por usuário */}
                <TabsContent value="equipe" className="mt-4">
                  <div className="space-y-4">
                    {team.map(member => {
                      const mTarefas = tarefasPorUsuario[member.id] || [];
                      const ativas = mTarefas.filter(t => t.status !== 'Concluída');
                      const urgentes = mTarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída');
                      const atrasadas = mTarefas.filter(t => t.data_limite && isPast(new Date(t.data_limite)) && !isToday(new Date(t.data_limite)) && t.status !== 'Concluída');

                      return (
                        <div key={member.id} className="rounded-2xl overflow-hidden" style={{ border: '0.5px solid rgba(201,169,110,0.2)', background: 'white' }}>
                          <div style={{ height: 3, background: urgentes.length > 0 ? '#dc2626' : atrasadas.length > 0 ? '#c9a96e' : '#3d2b1f' }} />
                          {/* Member header */}
                          <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.1)' }}>
                            <div className="relative">
                              <Avatar className="h-9 w-9" style={{ border: '1.5px solid rgba(201,169,110,0.2)' }}>
                                <AvatarFallback style={{ background: 'rgba(61,43,31,0.08)', color: '#3d2b1f', fontSize: 11, fontWeight: 700 }}>
                                  {getInitials(member.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full" style={{ background: member.online ? '#22c55e' : '#d1d5db', border: '2px solid white' }} />
                            </div>
                            <div className="flex-1">
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>{member.fullName}</p>
                              <p style={{ fontSize: 11, color: '#9ca3af' }}>{member.online ? 'Online agora' : 'Offline'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {urgentes.length > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                                  {urgentes.length} urgente{urgentes.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {atrasadas.length > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                                  {atrasadas.length} atrasada{atrasadas.length > 1 ? 's' : ''}
                                </span>
                              )}
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>{ativas.length} ativa{ativas.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          {/* Tasks */}
                          {mTarefas.length === 0 ? (
                            <div className="py-6 text-center" style={{ color: '#d1d5db', fontSize: 12 }}>Sem tarefas atribuídas</div>
                          ) : (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {mTarefas.slice(0, 6).map(t => (
                                <TarefaCard key={t.id} tarefa={t} onClick={() => setDetailTarefa(t)} />
                              ))}
                              {mTarefas.length > 6 && (
                                <div className="flex items-center justify-center rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
                                  style={{ border: '0.5px dashed rgba(201,169,110,0.3)', minHeight: 60 }}
                                  onClick={() => { setActiveUser(member.id); }}>
                                  <p style={{ fontSize: 11, color: '#c9a96e', fontWeight: 600 }}>+{mTarefas.length - 6} mais</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* ── Sidebar de Alertas ── */}
            <div className="space-y-4">
              {/* Alertas */}
              <div className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 3, background: alertas.length > 0 ? '#dc2626' : '#16a34a' }} />
                <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: alertas.length > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)' }}>
                    <AlertTriangle style={{ width: 16, height: 16, color: alertas.length > 0 ? '#dc2626' : '#16a34a' }} />
                  </div>
                  <span className="text-sm font-semibold text-foreground flex-1">Alertas de Tarefas</span>
                  {alertas.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', border: '0.5px solid rgba(220,38,38,0.2)' }}>
                      {alertas.length}
                    </span>
                  )}
                </div>
                {alertas.length === 0 ? (
                  <div className="py-10 text-center px-5">
                    <CheckCircle2 style={{ width: 28, height: 28, color: '#16a34a', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1917' }}>Tudo em dia!</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Nenhuma tarefa atrasada ou urgente</p>
                  </div>
                ) : (
                  <ScrollArea style={{ height: 320 }}>
                    <div className="p-3">
                      {alertas.map(t => <AlertaItem key={t.id} tarefa={t} onClick={() => setDetailTarefa(t)} />)}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Resumo por usuário */}
              <div className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ height: 3, background: '#c9a96e' }} />
                <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.1)' }}>
                    <Users style={{ width: 16, height: 16, color: '#c9a96e' }} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Carga por Usuário</span>
                </div>
                <div className="p-4 space-y-3">
                  {team.map(member => {
                    const mTarefas = tarefasPorUsuario[member.id] || [];
                    const ativas = mTarefas.filter(t => t.status !== 'Concluída').length;
                    const urgentes = mTarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída').length;
                    const maxCarga = Math.max(...team.map(m => (tarefasPorUsuario[m.id] || []).filter(t => t.status !== 'Concluída').length), 1);
                    const pct = Math.round((ativas / maxCarga) * 100);

                    return (
                      <div key={member.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(61,43,31,0.08)', color: '#3d2b1f' }}>
                              {getInitials(member.fullName)}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full" style={{ background: member.online ? '#22c55e' : '#d1d5db', border: '1.5px solid white' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#3d2b1f', flex: 1 }} className="truncate">{member.nome || member.fullName.split(' ')[0]}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: urgentes > 0 ? '#dc2626' : '#9ca3af' }}>{ativas}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.1)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: urgentes > 0 ? '#dc2626' : pct > 70 ? '#c9a96e' : '#3d2b1f' }} />
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

      {/* Modals */}
      <TarefaDetailModal open={!!detailTarefa} onOpenChange={o => !o && setDetailTarefa(null)} tarefa={detailTarefa} onEdit={t => { setDetailTarefa(null); setSelectedTarefa(t); setTarefaModalOpen(true); }} />
      <TarefaModal open={tarefaModalOpen} onOpenChange={setTarefaModalOpen} tarefa={selectedTarefa} onDelete={deleteTarefa} />
      <TimesheetModal open={timesheetModalOpen} onOpenChange={setTimesheetModal} />
    </AppLayout>
  );
}
