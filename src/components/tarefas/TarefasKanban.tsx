import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tarefa } from '@/types/tarefas';
import { Skeleton } from '@/components/ui/skeleton';

const columns = [
  { id: 'Pendente', title: 'Pendente', color: 'bg-amber-500' },
  { id: 'Em Andamento', title: 'Em Andamento', color: 'bg-blue-500' },
  { id: 'Concluída', title: 'Concluída', color: 'bg-green-500' },
];

export function TarefasKanban({ tarefas, loading, onUpdateTarefa }: { 
  tarefas: Tarefa[]; 
  loading: boolean;
  onUpdateTarefa: (id: string, updates: Partial<Tarefa>) => Promise<boolean>;
  onDeleteTarefa: (id: string) => Promise<boolean>;
}) {
  if (loading) return <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-64" />)}</div>;

  const prioridadeColor = (p: string) => {
    if (p === 'Urgente') return 'bg-red-100 text-red-800';
    if (p === 'Alta') return 'bg-orange-100 text-orange-800';
    if (p === 'Media') return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map(col => (
        <Card key={col.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${col.color}`} />
              {col.title}
              <Badge variant="secondary" className="ml-auto">{tarefas.filter(t => t.status === col.id).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 min-h-[200px]">
            {tarefas.filter(t => t.status === col.id).map(tarefa => (
              <div key={tarefa.id} className="p-3 bg-muted rounded-lg border cursor-pointer hover:shadow-sm">
                <p className="font-medium text-sm">{tarefa.titulo}</p>
                {tarefa.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tarefa.descricao}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={prioridadeColor(tarefa.prioridade)} variant="outline">{tarefa.prioridade}</Badge>
                  {tarefa.data_limite && <span className="text-xs text-muted-foreground">{tarefa.data_limite}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
