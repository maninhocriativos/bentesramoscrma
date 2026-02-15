import { Users, Circle, Bell, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useTeamPresence } from '@/hooks/useTeamPresence';
import { useTarefas } from '@/hooks/useTarefas';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/hooks/usePerfil';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function TeamStatusWidget() {
  const { user } = useAuth();
  const { perfil } = usePerfil();
  const userName = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || user?.email || '';
  const { getTeamWithStatus, getOnlineCount } = useTeamPresence(user?.id, userName);
  const { tarefas } = useTarefas();

  const team = getTeamWithStatus();
  const onlineCount = getOnlineCount();

  const tarefasPorUsuario = useMemo(() => {
    const map: Record<string, number> = {};
    tarefas.forEach(t => {
      if (t.responsavel_id && (t.status === 'Pendente' || t.status === 'Em Andamento')) {
        map[t.responsavel_id] = (map[t.responsavel_id] || 0) + 1;
      }
    });
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

  const getActivityLabel = (member: ReturnType<typeof getTeamWithStatus>[0]) => {
    if (!member.online) return 'Offline';
    if (member.currentChat) return 'Atendendo chat';
    return 'Online';
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
                const pendentes = tarefasPorUsuario[member.id] || 0;
                const activity = getActivityLabel(member);

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.fullName}
                      </p>
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

                        {pendentes > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] text-[hsl(var(--gold))]">
                            <Clock className="h-3 w-3" />
                            {pendentes} tarefa{pendentes > 1 ? 's' : ''}
                          </span>
                        )}

                        {pendentes === 0 && (
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
                            onClick={() => handleNotify(member.fullName)}
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
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
