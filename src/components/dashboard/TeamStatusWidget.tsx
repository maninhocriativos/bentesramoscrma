import { Users, Circle, Bell, CheckCircle2, Clock, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tarefa } from '@/types/tarefas';

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Urgente: { label: '🔴 Urgente', color: 'text-destructive', bg: 'bg-destructive/10' },
  Alta: { label: 'Alta', color: 'text-primary', bg: 'bg-primary/10' },
  Media: { label: 'Média', color: 'text-[hsl(var(--gold))]', bg: 'bg-[hsl(var(--gold))]/10' },
  Baixa: { label: 'Baixa', color: 'text-muted-foreground', bg: 'bg-muted' },
};

export function TeamStatusWidget() {
  const { user } = useAuth();
  const { perfil } = usePerfil();
  const userName = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || user?.email || '';
  const { getTeamWithStatus, getOnlineCount } = useTeamPresence(user?.id, userName);
  const { tarefas } = useTarefas();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);

  const team = getTeamWithStatus();
  const onlineCount = getOnlineCount();

  const tarefasPorUsuario = useMemo(() => {
    const map: Record<string, Tarefa[]> = {};
    tarefas.forEach(t => {
      if (t.responsavel_id && (t.status === 'Pendente' || t.status === 'Em Andamento')) {
        if (!map[t.responsavel_id]) map[t.responsavel_id] = [];
        map[t.responsavel_id].push(t);
      }
    });
    // Sort by priority
    const prioOrder = { Urgente: 0, Alta: 1, Media: 2, Baixa: 3 };
    Object.values(map).forEach(arr => arr.sort((a, b) => (prioOrder[a.prioridade] ?? 3) - (prioOrder[b.prioridade] ?? 3)));
    return map;
  }, [tarefas]);

  const handleNotify = (memberName: string) => {
    toast.success(`Notificação enviada para ${memberName}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const toggleExpand = (memberId: string) => {
    setExpandedMember(prev => prev === memberId ? null : memberId);
  };

  return (
    <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="h-1 w-full bg-primary" />
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          Equipe
          <Badge className="ml-auto bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-[10px] px-1.5 py-0 h-5">
            {onlineCount} online
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y divide-border/40">
            {team.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-5">
                <Users className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
              </div>
            ) : (
              team.map((member) => {
                const memberTarefas = tarefasPorUsuario[member.id] || [];
                const pendentes = memberTarefas.length;
                const hasUrgent = memberTarefas.some(t => t.prioridade === 'Urgente');
                const hasAlta = memberTarefas.some(t => t.prioridade === 'Alta');
                const isExpanded = expandedMember === member.id;

                return (
                  <div key={member.id}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors",
                        pendentes > 0 && "cursor-pointer"
                      )}
                      onClick={() => pendentes > 0 && toggleExpand(member.id)}
                    >
                      {/* Avatar with online dot */}
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 border border-border/60">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(member.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <Circle
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current stroke-white stroke-[2]",
                            member.online
                              ? 'text-[hsl(var(--success))]'
                              : 'text-muted-foreground/40'
                          )}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">
                            {member.fullName}
                          </p>
                          {hasUrgent && (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {member.currentChat ? (
                            <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--success))]">
                              <MessageSquare className="h-3 w-3" />
                              Atendendo
                            </span>
                          ) : member.online ? (
                            <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--success))]">
                              <Circle className="h-2 w-2 fill-current" />
                              Online
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Offline</span>
                          )}

                          {pendentes > 0 ? (
                            <span className={cn(
                              "flex items-center gap-0.5 text-[11px]",
                              hasUrgent ? 'text-destructive' : hasAlta ? 'text-primary' : 'text-[hsl(var(--gold))]'
                            )}>
                              <Clock className="h-3 w-3" />
                              {pendentes} tarefa{pendentes > 1 ? 's' : ''}
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/60">
                              <CheckCircle2 className="h-3 w-3" />
                              Em dia
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notify button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotify(member.fullName);
                              }}
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Notificar {member.nome || 'membro'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Expanded task list */}
                    {isExpanded && memberTarefas.length > 0 && (
                      <div className="bg-muted/20 px-5 py-2 space-y-1.5 border-t border-border/20">
                        {memberTarefas.slice(0, 5).map(tarefa => {
                          const config = PRIORIDADE_CONFIG[tarefa.prioridade] || PRIORIDADE_CONFIG.Media;
                          return (
                            <div
                              key={tarefa.id}
                              className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTarefa(tarefa);
                              }}
                            >
                              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.bg, config.color === 'text-destructive' && 'bg-destructive', config.color === 'text-primary' && 'bg-primary', config.color === 'text-[hsl(var(--gold))]' && 'bg-[hsl(var(--gold))]')} />
                              <span className="text-[11px] text-foreground truncate flex-1">
                                {tarefa.titulo}
                              </span>
                              <Badge className={cn("text-[9px] px-1 py-0 h-4 shrink-0", config.bg, config.color)}>
                                {config.label}
                              </Badge>
                            </div>
                          );
                        })}
                        {memberTarefas.length > 5 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">
                            +{memberTarefas.length - 5} tarefas
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
      {/* Task detail modal */}
      <Dialog open={!!selectedTarefa} onOpenChange={(open) => !open && setSelectedTarefa(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {selectedTarefa && (
                <>
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    selectedTarefa.prioridade === 'Urgente' && 'bg-destructive',
                    selectedTarefa.prioridade === 'Alta' && 'bg-primary',
                    selectedTarefa.prioridade === 'Media' && 'bg-[hsl(var(--gold))]',
                    selectedTarefa.prioridade === 'Baixa' && 'bg-muted-foreground',
                  )} />
                  {selectedTarefa.titulo}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTarefa && (() => {
            const config = PRIORIDADE_CONFIG[selectedTarefa.prioridade] || PRIORIDADE_CONFIG.Media;
            const responsavel = team.find(m => m.id === selectedTarefa.responsavel_id);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</p>
                    <Badge variant="secondary" className="text-xs">{selectedTarefa.status}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Prioridade</p>
                    <Badge className={cn("text-xs", config.bg, config.color)}>{config.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Responsável</p>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{responsavel?.fullName || 'Não atribuído'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Data Limite</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">
                        {selectedTarefa.data_limite
                          ? new Date(selectedTarefa.data_limite).toLocaleDateString('pt-BR')
                          : 'Sem prazo'}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedTarefa.descricao && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Descrição</p>
                    <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">
                      {selectedTarefa.descricao}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
