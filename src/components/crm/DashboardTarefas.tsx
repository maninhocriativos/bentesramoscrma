import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTarefas } from '@/hooks/useTarefas';
import { Plus, Clock, Calendar, CheckSquare, AlertTriangle } from 'lucide-react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DashboardTarefasProps {
  onNewTask?: () => void;
}

export function DashboardTarefas({ onNewTask }: DashboardTarefasProps) {
  const { tarefas, loading, updateTarefa } = useTarefas();
  const navigate = useNavigate();

  const pendingTasks = tarefas
    .filter((t) => t.status === 'Pendente' || t.status === 'Em Andamento')
    .sort((a, b) => {
      const prioridade = { 'Urgente': 0, 'Alta': 1, 'Media': 2, 'Baixa': 3 };
      const aPrio = prioridade[a.prioridade as keyof typeof prioridade] ?? 4;
      const bPrio = prioridade[b.prioridade as keyof typeof prioridade] ?? 4;
      if (aPrio !== bPrio) return aPrio - bPrio;
      if (!a.data_limite) return 1;
      if (!b.data_limite) return -1;
      return new Date(a.data_limite).getTime() - new Date(b.data_limite).getTime();
    })
    .slice(0, 6);

  const handleComplete = async (id: string) => {
    await updateTarefa(id, { status: 'Concluída', data_conclusao: new Date().toISOString() });
  };

  const getTaskStatus = (task: typeof tarefas[0]) => {
    if (!task.data_limite) return 'upcoming';
    const taskDate = new Date(task.data_limite);
    const now = new Date();
    if (isBefore(taskDate, startOfDay(now)) && !isToday(taskDate)) return 'overdue';
    if (isToday(taskDate)) return 'today';
    return 'upcoming';
  };

  return (
    <Card className="bg-card/50 border-border/40">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium text-foreground flex items-center gap-2">
          <CheckSquare className="h-3.5 w-3.5 text-primary" />
          Prazos e Tarefas
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-primary"
          onClick={onNewTask || (() => navigate('/tarefas'))}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          Nova
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-[160px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pendingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Calendar className="h-6 w-6 mb-1 opacity-40" />
              <span className="text-xs">Nenhuma tarefa</span>
              <Button
                variant="link"
                size="sm"
                className="text-[10px] text-primary h-auto p-0 mt-1"
                onClick={onNewTask || (() => navigate('/tarefas'))}
              >
                Criar primeira tarefa
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendingTasks.map((task) => {
                const status = getTaskStatus(task);
                const isOverdue = status === 'overdue';
                const isTodays = status === 'today';
                
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/tarefas')}
                  >
                    <Checkbox
                      checked={task.status === 'Concluída'}
                      onCheckedChange={() => handleComplete(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs text-foreground truncate flex-1">{task.titulo}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOverdue && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      {isTodays && <Clock className="h-3 w-3 text-amber-500" />}
                      <span className={cn(
                        "text-[10px]",
                        isOverdue ? "text-destructive" : isTodays ? "text-amber-500" : "text-muted-foreground"
                      )}>
                        {task.data_limite 
                          ? format(new Date(task.data_limite), "dd/MM", { locale: ptBR })
                          : '—'
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
