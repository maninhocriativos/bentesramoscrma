import { useMemo, useState, useEffect } from 'react';
import { Users, Circle, Bell, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, Calendar, User, Send, RotateCcw, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useTarefas } from '@/hooks/useTarefas';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tarefa } from '@/types/tarefas';
import { EntregarTarefaModal } from '@/components/tarefas/EntregarTarefaModal';
import { AprovarTarefaModal } from '@/components/tarefas/AprovarTarefaModal';

const PRIORIDADE_CONFIG: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  Urgente: { label: '🔴 Urgente', dot: '#dc2626', bg: 'rgba(220,38,38,0.08)',   color: '#dc2626' },
  Alta:    { label: 'Alta',       dot: '#3d2b1f', bg: 'rgba(61,43,31,0.08)',    color: '#3d2b1f' },
  Media:   { label: 'Média',      dot: '#c9a96e', bg: 'rgba(201,169,110,0.1)',  color: '#b8922a' },
  Baixa:   { label: 'Baixa',      dot: '#9ca3af', bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
};

export function TeamStatusWidget() {
  const { user } = useAuth();
  const { perfil, canAccessSettings } = usePerfil();
  const userName = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || user?.email || '';
  const { getTeamWithStatus, getOnlineCount } = useTeamPresence(user?.id, userName);
  const { tarefas } = useTarefas();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [entregarModal, setEntregarModal] = useState<Tarefa | null>(null);
  const [aprovarModal, setAprovarModal] = useState<Tarefa | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isManager = canAccessSettings;

  // Refresh automático a cada 30s para manter status online atualizado
  useEffect(() => {
    const interval = setInterval(() => {
      refresh?.();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const team = getTeamWithStatus();
  const onlineCount = getOnlineCount();

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    refresh?.();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const tarefasPorUsuario = useMemo(() => {
    const map: Record<string, Tarefa[]> = {};
    const prioOrder: Record<string, number> = { Urgente: 0, Alta: 1, Media: 2, Baixa: 3 };
    tarefas.forEach(t => {
      if (t.responsavel_id && (t.status === 'Pendente' || t.status === 'Em Andamento')) {
        if (!map[t.responsavel_id]) map[t.responsavel_id] = [];
        map[t.responsavel_id].push(t);
      }
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (prioOrder[a.prioridade] ?? 3) - (prioOrder[b.prioridade] ?? 3)));
    return map;
  }, [tarefas]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <div className="rounded-2xl overflow-hidden bg-card" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ height: 3, background: '#3d2b1f' }} />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,43,31,0.08)' }}>
            <Users style={{ width: 16, height: 16, color: '#3d2b1f' }} />
          </div>
          <span className="text-sm font-semibold text-foreground flex-1">Equipe</span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0' }}>
            {onlineCount} online
          </span>
          {/* Botão refresh manual */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#c9a96e]/10"
            title="Atualizar status da equipe"
          >
            <RefreshCw style={{ width: 13, height: 13, color: '#9ca3af' }} className={cn(isRefreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Lista */}
        <ScrollArea style={{ height: 300 }}>
          <div>
            {team.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                <Users style={{ width: 24, height: 24, color: '#d1d5db', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: '#9ca3af' }}>Nenhum membro encontrado</p>
              </div>
            ) : (
              team.map((member) => {
                const memberTarefas = tarefasPorUsuario[member.id] || [];
                const pendentes = memberTarefas.length;
                const hasUrgent = memberTarefas.some(t => t.prioridade === 'Urgente');
                const isExpanded = expandedMember === member.id;

                return (
                  <div key={member.id}>
                    <div
                      className={cn('flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-50 dark:hover:bg-[#c9a96e]/4', pendentes > 0 && 'cursor-pointer')}
                      style={{ borderBottom: '0.5px solid rgba(201,169,110,0.08)' }}
                      onClick={() => pendentes > 0 && setExpandedMember(p => p === member.id ? null : member.id)}
                    >
                      {/* Avatar com dot de status */}
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9" style={{ border: '1.5px solid rgba(201,169,110,0.2)' }}>
                          <AvatarFallback style={{ background: 'rgba(61,43,31,0.08)', color: '#3d2b1f', fontSize: 11, fontWeight: 700 }}>
                            {getInitials(member.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
                          style={{ background: member.online ? '#22c55e' : '#d1d5db', border: '2px solid white' }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">{member.fullName}</p>
                          {hasUrgent && <AlertTriangle style={{ width: 13, height: 13, color: '#dc2626', flexShrink: 0 }} />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {member.online ? (
                            <span style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Circle style={{ width: 6, height: 6, fill: '#16a34a', color: '#16a34a' }} />
                              {member.currentChat ? 'Atendendo' : 'Online'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Offline</span>
                          )}
                          {pendentes > 0 ? (
                            <span style={{ fontSize: 11, color: hasUrgent ? '#dc2626' : '#c9a96e', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock style={{ width: 11, height: 11 }} />
                              {pendentes} tarefa{pendentes > 1 ? 's' : ''}
                              {isExpanded ? <ChevronUp style={{ width: 11, height: 11 }} /> : <ChevronDown style={{ width: 11, height: 11 }} />}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <CheckCircle2 style={{ width: 11, height: 11 }} /> Em dia
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bell */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[#c9a96e]/10 shrink-0"
                              onClick={e => { e.stopPropagation(); toast.success(`Notificação enviada para ${member.fullName}`); }}
                            >
                              <Bell style={{ width: 14, height: 14, color: '#9ca3af' }} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left"><p>Notificar {member.nome || 'membro'}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Tarefas expandidas */}
                    {isExpanded && memberTarefas.length > 0 && (
                      <div className="px-5 py-2 space-y-1.5" style={{ background: 'rgba(201,169,110,0.03)', borderBottom: '0.5px solid rgba(201,169,110,0.08)' }}>
                        {memberTarefas.slice(0, 5).map(t => {
                          const cfg = PRIORIDADE_CONFIG[t.prioridade] || PRIORIDADE_CONFIG.Media;
                          return (
                            <div key={t.id}
                              className="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors hover:bg-[#c9a96e]/8"
                              onClick={e => { e.stopPropagation(); setSelectedTarefa(t); }}
                            >
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                              <span style={{ fontSize: 11, flexShrink: 0, padding: '1px 6px', borderRadius: 6, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                              <span style={{ fontSize: 11 }} className="truncate flex-1">{t.titulo}</span>
                            </div>
                          );
                        })}
                        {memberTarefas.length > 5 && (
                          <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', paddingTop: 4 }}>+{memberTarefas.length - 5} tarefas</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Modal detalhes da tarefa */}
      <Dialog open={!!selectedTarefa} onOpenChange={open => !open && setSelectedTarefa(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedTarefa && (
                <>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: PRIORIDADE_CONFIG[selectedTarefa.prioridade]?.dot || '#9ca3af' }} />
                  {selectedTarefa.titulo}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTarefa && (() => {
            const cfg = PRIORIDADE_CONFIG[selectedTarefa.prioridade] || PRIORIDADE_CONFIG.Media;
            const responsavel = team.find(m => m.id === selectedTarefa.responsavel_id);
            const isMyTask = user?.id === selectedTarefa.responsavel_id;
            const canDeliver = isMyTask && !selectedTarefa.aprovacao_status && selectedTarefa.status !== 'Concluída';
            const canResubmit = isMyTask && selectedTarefa.aprovacao_status === 'devolvida';
            const canApprove = isManager && selectedTarefa.aprovacao_status === 'aguardando_aprovacao';

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Status</p>
                    <Badge variant="secondary" className="text-xs">{selectedTarefa.status}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Prioridade</p>
                    <span className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Responsável</p>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{responsavel?.fullName || 'Não atribuído'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Data Limite</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{selectedTarefa.data_limite ? new Date(selectedTarefa.data_limite).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                    </div>
                  </div>
                </div>
                {selectedTarefa.descricao && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Descrição</p>
                    <p className="text-sm bg-muted/30 rounded-lg p-3">{selectedTarefa.descricao}</p>
                  </div>
                )}
                {selectedTarefa.aprovacao_status && (
                  <div className={cn('rounded-lg p-3 border',
                    selectedTarefa.aprovacao_status === 'aguardando_aprovacao' && 'bg-amber-50 border-amber-200',
                    selectedTarefa.aprovacao_status === 'aprovada' && 'bg-emerald-50 border-emerald-200',
                    selectedTarefa.aprovacao_status === 'devolvida' && 'bg-red-50 border-red-200',
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      {selectedTarefa.aprovacao_status === 'aguardando_aprovacao' && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                      {selectedTarefa.aprovacao_status === 'aprovada' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {selectedTarefa.aprovacao_status === 'devolvida' && <RotateCcw className="h-3.5 w-3.5 text-red-600" />}
                      <span className="text-xs font-medium">
                        {selectedTarefa.aprovacao_status === 'aguardando_aprovacao' && 'Aguardando Aprovação'}
                        {selectedTarefa.aprovacao_status === 'aprovada' && 'Aprovada'}
                        {selectedTarefa.aprovacao_status === 'devolvida' && 'Devolvida para Correção'}
                      </span>
                    </div>
                    {selectedTarefa.aprovacao_feedback && (
                      <p className="text-xs text-muted-foreground">{selectedTarefa.aprovacao_feedback}</p>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {(canDeliver || canResubmit) && (
                    <Button className="flex-1" onClick={() => { setSelectedTarefa(null); setEntregarModal(selectedTarefa); }}>
                      <Send className="h-4 w-4 mr-2" />{canResubmit ? 'Reenviar Entrega' : 'Entregar Tarefa'}
                    </Button>
                  )}
                  {canApprove && (
                    <Button className="flex-1" onClick={() => { setSelectedTarefa(null); setAprovarModal(selectedTarefa); }}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />Revisar Entrega
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {entregarModal && <EntregarTarefaModal open={!!entregarModal} onOpenChange={open => !open && setEntregarModal(null)} tarefa={entregarModal} />}
      {aprovarModal && <AprovarTarefaModal open={!!aprovarModal} onOpenChange={open => !open && setAprovarModal(null)} tarefa={aprovarModal} />}
    </>
  );
}
