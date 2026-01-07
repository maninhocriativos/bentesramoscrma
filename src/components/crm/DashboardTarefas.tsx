import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useTarefas } from '@/hooks/useTarefas';
import { 
  Plus, 
  Clock, 
  AlertTriangle,
  Calendar,
  CheckSquare
} from 'lucide-react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface DashboardTarefasProps {
  onNewTask?: () => void;
}

export function DashboardTarefas({ onNewTask }: DashboardTarefasProps) {
  const { tarefas, loading, updateTarefa } = useTarefas();
  const navigate = useNavigate();

  // Filter pending and in-progress tasks, sorted by priority and due date
  const pendingTasks = tarefas
    .filter((t) => t.status === 'Pendente' || t.status === 'Em Andamento')
    .sort((a, b) => {
      // Priority order: Urgente > Alta > Media > Baixa
      const prioridade = { 'Urgente': 0, 'Alta': 1, 'Media': 2, 'Baixa': 3 };
      const aPrio = prioridade[a.prioridade] ?? 4;
      const bPrio = prioridade[b.prioridade] ?? 4;
      if (aPrio !== bPrio) return aPrio - bPrio;
      
      // Then by due date
      if (!a.data_limite) return 1;
      if (!b.data_limite) return -1;
      return new Date(a.data_limite).getTime() - new Date(b.data_limite).getTime();
    })
    .slice(0, 8);

  const handleComplete = async (id: string) => {
    await updateTarefa(id, { 
      status: 'Concluída',
      data_conclusao: new Date().toISOString()
    });
  };

  const getTaskStatus = (task: typeof tarefas[0]) => {
    if (!task.data_limite) return 'upcoming';
    const taskDate = new Date(task.data_limite);
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

  const getPrioridadeBadge = (prioridade: string) => {
    const colors: Record<string, string> = {
      'Urgente': 'bg-red-500 text-white',
      'Alta': 'bg-amber-500 text-white',
      'Media': 'bg-blue-500 text-white',
      'Baixa': 'bg-slate-400 text-white',
    };
    return (
      <Badge className={`text-[9px] px-1.5 py-0 h-4 ${colors[prioridade] || colors['Baixa']}`}>
        {prioridade}
      </Badge>
    );
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
          onClick={onNewTask || (() => navigate('/tarefas'))}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova Tarefa
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="h-[180px] pr-2">
          <div className="space-y-1.5">
            {loading ? (
              <div className="text-center py-6">
                <Clock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2 animate-spin" />
                <p className="text-xs text-muted-foreground">Carregando...</p>
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma tarefa pendente
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-primary mt-1 h-auto p-0"
                  onClick={onNewTask || (() => navigate('/tarefas'))}
                >
                  Criar primeira tarefa
                </Button>
              </div>
            ) : (
              pendingTasks.map((task) => {
                const status = getTaskStatus(task);
                
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/tarefas')}
                  >
                    <Checkbox
                      checked={task.status === 'Concluída'}
                      onCheckedChange={() => handleComplete(task.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 h-4 w-4 border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-foreground leading-tight truncate">
                          {task.titulo}
                        </p>
                        {getPrioridadeBadge(task.prioridade)}
                        {getStatusBadge(status)}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {task.data_limite 
                          ? format(new Date(task.data_limite), "dd/MM 'às' HH:mm", { locale: ptBR })
                          : 'Sem prazo definido'
                        }
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