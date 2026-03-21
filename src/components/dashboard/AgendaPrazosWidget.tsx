import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIntimacoes } from '@/hooks/useIntimacoes';
import { useCompromissos } from '@/hooks/useCompromissos';
import { useTarefas } from '@/hooks/useTarefas';
import { format, isAfter, isBefore, addDays, startOfDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface AgendaItem {
  id: string;
  type: 'intimacao' | 'compromisso' | 'tarefa';
  title: string;
  date: Date;
  icon: typeof Calendar;
  color: string;
  bg: string;
  route: string;
}

export function AgendaPrazosWidget() {
  const { intimacoes } = useIntimacoes();
  const { compromissos } = useCompromissos();
  const { tarefas } = useTarefas();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const now = startOfDay(new Date());
    const limit = addDays(now, 7);
    const result: AgendaItem[] = [];

    // Intimações próximos 7 dias
    intimacoes
      .filter(i => !i.lida && i.data_intimacao)
      .forEach(i => {
        const d = new Date(i.data_intimacao!);
        if (isAfter(d, now) && isBefore(d, limit)) {
          result.push({
            id: i.id,
            type: 'intimacao',
            title: i.processo_titulo || `Intimação ${i.processo_cnj || ''}`,
            date: d,
            icon: FileText,
            color: 'text-destructive',
            bg: 'bg-destructive/10',
            route: '/intimacoes',
          });
        }
      });

    // Compromissos de hoje
    compromissos
      .forEach(c => {
        const d = new Date(c.data_inicio);
        if (isToday(d)) {
          result.push({
            id: c.id,
            type: 'compromisso',
            title: c.titulo,
            date: d,
            icon: Calendar,
            color: 'text-[hsl(217,91%,60%)]',
            bg: 'bg-[hsl(217,91%,60%)]/10',
            route: '/agenda',
          });
        }
      });

    // Tarefas urgentes pendentes
    tarefas
      .filter(t => t.prioridade === 'Urgente' && (t.status === 'Pendente' || t.status === 'Em Andamento'))
      .forEach(t => {
        const d = t.data_limite ? new Date(t.data_limite) : new Date();
        result.push({
          id: t.id,
          type: 'tarefa',
          title: t.titulo,
          date: d,
          icon: AlertTriangle,
          color: 'text-[hsl(38,92%,50%)]',
          bg: 'bg-[hsl(38,92%,50%)]/10',
          route: '/tarefas',
        });
      });

    return result
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [intimacoes, compromissos, tarefas]);

  return (
    <Card className="rounded-2xl border border-border/40 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="h-1 w-full bg-[hsl(217,91%,60%)]" />
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(217,91%,60%)]/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-[hsl(217,91%,60%)]" />
          </div>
          📅 Agenda & Prazos
          {items.length > 0 && (
            <Badge className="ml-auto bg-[hsl(217,91%,60%)] text-white text-[10px] px-1.5 py-0 h-5 border-0">
              {items.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-5">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-[hsl(var(--success))]" />
            </div>
            <p className="text-sm font-medium text-foreground">Tudo tranquilo!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sem prazos urgentes</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[280px]">
            <div className="divide-y divide-border/40">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(item.route)}
                  >
                    <div className={cn("p-1.5 rounded-lg shrink-0", item.bg)}>
                      <Icon className={cn("h-3.5 w-3.5", item.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isToday(item.date) 
                          ? `Hoje às ${format(item.date, 'HH:mm')}`
                          : format(item.date, "dd MMM", { locale: ptBR })
                        }
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        <div
          className="p-2.5 border-t border-border/30 text-center cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => navigate('/agenda')}
        >
          <span className="text-xs font-medium text-primary">Ver todos →</span>
        </div>
      </CardContent>
    </Card>
  );
}
