import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tarefa } from '@/types/tarefas';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CheckCircle2, RotateCcw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const columns = [
  { id: 'Pendente', title: 'Pendente', color: 'bg-amber-500' },
  { id: 'Em Andamento', title: 'Em Andamento', color: 'bg-blue-500' },
  { id: 'Concluída', title: 'Concluída', color: 'bg-green-500' },
];

const APROVACAO_LABELS: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  aguardando_aprovacao: { label: 'Aguardando Aprovação', icon: Clock, className: 'bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30' },
  aprovada: { label: 'Aprovada', icon: CheckCircle2, className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30' },
  devolvida: { label: 'Devolvida', icon: RotateCcw, className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function TarefasKanban({ tarefas, loading, onUpdateTarefa, onDeleteTarefa, onSelectTarefa }: { 
  tarefas: Tarefa[]; 
  loading: boolean;
  onUpdateTarefa: (id: string, updates: Partial<Tarefa>) => Promise<boolean>;
  onDeleteTarefa: (id: string) => Promise<boolean>;
  onSelectTarefa?: (tarefa: Tarefa) => void;
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
            {tarefas.filter(t => t.status === col.id).map(tarefa => {
              const aprovacao = tarefa.aprovacao_status ? APROVACAO_LABELS[tarefa.aprovacao_status] : null;
              const AprovacaoIcon = aprovacao?.icon;
              return (
                <div 
                  key={tarefa.id} 
                  className="p-3 bg-muted rounded-lg border cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => onSelectTarefa?.(tarefa)}
                >
                  <p className="font-medium text-sm">{tarefa.titulo}</p>
                  {tarefa.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tarefa.descricao}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge className={prioridadeColor(tarefa.prioridade)} variant="outline">{tarefa.prioridade}</Badge>
                    {tarefa.data_limite && <span className="text-xs text-muted-foreground">{tarefa.data_limite}</span>}
                    {aprovacao && AprovacaoIcon && (
                      <Badge variant="outline" className={cn("text-[10px] gap-1", aprovacao.className)}>
                        <AprovacaoIcon className="h-3 w-3" />
                        {aprovacao.label}
                      </Badge>
                    )}
                    {tarefa.aprovacao_nota && (
                      <div className="flex items-center gap-0.5 ml-auto">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={cn("h-2.5 w-2.5", s <= tarefa.aprovacao_nota! ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-muted-foreground/20')} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
