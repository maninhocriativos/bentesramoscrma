import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
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
  iconBg: string;
  iconColor: string;
  route: string;
}

export function AgendaPrazosWidget() {
  const { intimacoes }   = useIntimacoes();
  const { compromissos } = useCompromissos();
  const { tarefas }      = useTarefas();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const now   = startOfDay(new Date());
    const limit = addDays(now, 7);
    const result: AgendaItem[] = [];

    intimacoes
      .filter(i => !i.lida && i.data_intimacao)
      .forEach(i => {
        const d = new Date(i.data_intimacao!);
        if (isAfter(d, now) && isBefore(d, limit)) {
          result.push({
            id: i.id, type: 'intimacao',
            title: i.processo_titulo || `Intimação ${i.processo_cnj || ''}`,
            date: d, icon: FileText,
            iconBg: 'rgba(220,38,38,0.08)', iconColor: '#dc2626',
            route: '/intimacoes',
          });
        }
      });

    compromissos.forEach(c => {
      const d = new Date(c.data_inicio);
      if (isToday(d)) {
        result.push({
          id: c.id, type: 'compromisso',
          title: c.titulo, date: d, icon: Calendar,
          iconBg: 'rgba(61,43,31,0.08)', iconColor: '#3d2b1f',
          route: '/agenda',
        });
      }
    });

    tarefas
      .filter(t => t.prioridade === 'Urgente' && (t.status === 'Pendente' || t.status === 'Em Andamento'))
      .forEach(t => {
        const d = t.data_limite ? new Date(t.data_limite) : new Date();
        result.push({
          id: t.id, type: 'tarefa',
          title: t.titulo, date: d, icon: AlertTriangle,
          iconBg: 'rgba(201,169,110,0.1)', iconColor: '#b8922a',
          route: '/tarefas',
        });
      });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [intimacoes, compromissos, tarefas]);

  return (
    <div
      className="rounded-2xl overflow-hidden bg-card flex flex-col"
      style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div style={{ height: 3, background: '#3d2b1f' }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,43,31,0.08)' }}>
          <Calendar style={{ width: 16, height: 16, color: '#3d2b1f' }} />
        </div>
        <span className="text-sm font-semibold text-foreground flex-1">📅 Agenda & Prazos</span>
        {items.length > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: '#3d2b1f', color: '#c9a96e' }}>
            {items.length}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-5">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(22,163,74,0.08)' }}>
            <Clock style={{ width: 20, height: 20, color: '#16a34a' }} />
          </div>
          <p className="text-sm font-semibold text-foreground">Tudo tranquilo!</p>
          <p className="text-xs text-muted-foreground mt-0.5">Sem prazos urgentes nos próximos 7 dias</p>
        </div>
      ) : (
        <ScrollArea style={{ maxHeight: 280 }}>
          <div>
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => navigate(item.route)}
                  className="flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-[#c9a96e]/4"
                  style={{ borderBottom: idx < items.length - 1 ? '0.5px solid rgba(201,169,110,0.1)' : 'none' }}
                >
                  {/* Ícone — items-start para alinhar ao topo quando título quebra linha */}
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: item.iconBg }}
                  >
                    <Icon style={{ width: 14, height: 14, color: item.iconColor }} />
                  </div>

                  {/* Texto — sem truncate, quebra linha normalmente */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug" style={{ wordBreak: 'break-word' }}>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isToday(item.date)
                        ? `Hoje às ${format(item.date, 'HH:mm')}`
                        : format(item.date, "dd 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>

                  <ChevronRight style={{ width: 14, height: 14, color: 'rgba(201,169,110,0.4)', flexShrink: 0, marginTop: 4 }} />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Footer */}
      <div
        onClick={() => navigate('/agenda')}
        className="mt-auto px-5 py-3 text-center cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-[#c9a96e]/4"
        style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}
      >
        <span className="text-xs font-semibold" style={{ color: '#c9a96e' }}>Ver todos →</span>
      </div>
    </div>
  );
}
