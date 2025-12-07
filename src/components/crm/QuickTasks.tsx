import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Compromisso } from '@/types/compromissos';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Clock, 
  AlertTriangle,
  Calendar,
  CheckSquare
} from 'lucide-react';

interface QuickTasksProps {
  compromissos: Compromisso[];
  onNewTask?: () => void;
}

export function QuickTasks({ compromissos, onNewTask }: QuickTasksProps) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const upcomingTasks = compromissos
    .filter((c) => {
      const taskDate = new Date(c.data_inicio);
      return !isBefore(taskDate, startOfDay(new Date())) || isToday(taskDate);
    })
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
    .slice(0, 8);

  const toggleComplete = (id: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getTaskStatus = (task: Compromisso) => {
    const taskDate = new Date(task.data_inicio);
    const now = new Date();
    
    if (isBefore(taskDate, startOfDay(now)) && !isToday(taskDate)) {
      return 'overdue';
    }
    if (isToday(taskDate)) {
      return 'today';
    }
    return 'upcoming';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            Atrasado
          </Badge>
        );
      case 'today':
        return (
          <Badge className="bg-accent text-accent-foreground text-[9px] px-1.5 py-0 h-4">
            <Clock className="h-2.5 w-2.5 mr-0.5" />
            Hoje
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="h-full bg-card border-border/50 shadow-soft">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Prazos e Tarefas
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
          onClick={onNewTask}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova Tarefa
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="h-[180px] pr-2">
          <div className="space-y-1.5">
            {upcomingTasks.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma tarefa pendente
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-primary mt-1 h-auto p-0"
                  onClick={onNewTask}
                >
                  Criar primeira tarefa
                </Button>
              </div>
            ) : (
              upcomingTasks.map((task) => {
                const status = getTaskStatus(task);
                const isCompleted = completedTasks.has(task.id);
                
                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors ${
                      isCompleted ? 'opacity-50' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() => toggleComplete(task.id)}
                      className="mt-0.5 h-4 w-4 border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium text-foreground leading-tight truncate ${
                          isCompleted ? 'line-through' : ''
                        }`}>
                          {task.titulo}
                        </p>
                        {!isCompleted && getStatusBadge(status)}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(task.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        {task.tipo && (
                          <span className="ml-1.5 text-muted-foreground/70">
                            • {task.tipo}
                          </span>
                        )}
                      </p>
                    </div>
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
