import { useMemo } from 'react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { Compromisso } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';
import { AlertTriangle, CheckCircle2, Clock, Calendar, Bell, Scale, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIMEZONE = 'America/Manaus';

interface AgendaKPIsProps {
  compromissos: Compromisso[];
  intimacoes: IntimacaoEvent[];
}

export function AgendaKPIs({ compromissos, intimacoes }: AgendaKPIsProps) {
  const now = new Date();
  const todayStart = startOfDay(now);

  const stats = useMemo(() => {
    const tarefas = compromissos.filter(c => c.tipo === 'Tarefa');
    const audiencias = compromissos.filter(c => c.tipo === 'Audiência');
    const outros = compromissos.filter(c => !['Tarefa', 'Audiência'].includes(c.tipo));

    const countByTime = (items: Compromisso[]) => {
      let atrasadas = 0, hoje = 0, futuras = 0;
      items.forEach(c => {
        const d = toZonedTime(new Date(c.data_inicio), TIMEZONE);
        if (isToday(d)) hoje++;
        else if (isBefore(d, todayStart)) atrasadas++;
        else futuras++;
      });
      return { atrasadas, hoje, futuras };
    };

    const intNaoLidas = intimacoes.filter(i => !i.lida).length;

    return {
      tarefas: { total: tarefas.length, ...countByTime(tarefas) },
      intimacoes: { total: intimacoes.length, pendentes: intNaoLidas },
      audiencias: { total: audiencias.length, ...countByTime(audiencias) },
      compromissos: { total: outros.length, ...countByTime(outros) },
    };
  }, [compromissos, intimacoes, todayStart]);

  const dayName = format(now, 'EEEE', { locale: ptBR });
  const dayNum = format(now, 'd');
  const monthName = format(now, 'MMMM', { locale: ptBR }).toUpperCase();

  const kpis = [
    {
      title: 'Tarefas',
      icon: CheckCircle2,
      total: stats.tarefas.total,
      items: [
        { value: stats.tarefas.atrasadas, label: 'atrasadas', danger: true },
        { value: stats.tarefas.hoje, label: 'hoje', success: true },
        { value: stats.tarefas.futuras, label: 'futuras' },
      ],
    },
    {
      title: 'Intimações',
      icon: Bell,
      total: stats.intimacoes.total,
      items: [
        { value: stats.intimacoes.pendentes, label: 'pendentes', danger: stats.intimacoes.pendentes > 0 },
      ],
    },
    {
      title: 'Audiências',
      icon: Scale,
      total: stats.audiencias.total,
      items: [
        { value: stats.audiencias.atrasadas, label: 'atrasadas', danger: true },
        { value: stats.audiencias.hoje, label: 'hoje', success: true },
        { value: stats.audiencias.futuras, label: 'futuras' },
      ],
    },
    {
      title: 'Compromissos',
      icon: Calendar,
      total: stats.compromissos.total,
      items: [
        { value: stats.compromissos.atrasadas, label: 'atrasados', danger: true },
        { value: stats.compromissos.hoje, label: 'hoje', success: true },
        { value: stats.compromissos.futuras, label: 'futuros' },
      ],
    },
  ];

  return (
    <div className="rounded-2xl border border-[#c9a96e]/20 bg-gradient-to-br from-[#faf8f5] to-[#f5f0e8] dark:from-[#2a1f14] dark:to-[#1e1510] shadow-sm overflow-hidden">
      <div className="flex">

        {/* Data */}
        <div className="flex flex-col items-center justify-center py-4 px-5 border-r border-[#c9a96e]/20 min-w-[100px] bg-[#3d2b1f]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#c9a96e]/70 mb-1">
            {monthName}
          </span>
          <span className="text-4xl font-black text-[#c9a96e] leading-none">{dayNum}</span>
          <span className="text-[10px] text-[#c9a96e]/60 capitalize mt-1">{dayName}</span>
        </div>

        {/* KPIs */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            const hasAlert = kpi.items.some(i => i.danger && i.value > 0);
            return (
              <div
                key={kpi.title}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 transition-colors',
                  idx % 2 === 0 ? 'bg-transparent' : 'bg-[#3d2b1f]/[0.02]',
                  idx < kpis.length - 1 && 'border-r border-[#c9a96e]/15'
                )}
              >
                {/* Ícone com número */}
                <div className="relative shrink-0">
                  <div className={cn(
                    'h-11 w-11 rounded-xl flex items-center justify-center',
                    hasAlert ? 'bg-red-50 dark:bg-red-950/30' : 'bg-[#c9a96e]/10'
                  )}>
                    <Icon className={cn('h-5 w-5', hasAlert ? 'text-red-500' : 'text-[#c9a96e]')} />
                  </div>
                  {kpi.total > 0 && (
                    <span className={cn(
                      'absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center',
                      hasAlert ? 'bg-red-500 text-white' : 'bg-[#3d2b1f] text-[#c9a96e]'
                    )}>
                      {kpi.total > 99 ? '99+' : kpi.total}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#3d2b1f] dark:text-[#c9a96e] leading-tight">
                    {kpi.title}
                  </p>
                  <div className="mt-0.5 space-y-0.5">
                    {kpi.items.map((item, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground leading-tight">
                        <span className={cn(
                          'font-bold',
                          item.danger && item.value > 0 ? 'text-red-500' :
                          item.success ? 'text-emerald-600' :
                          'text-[#3d2b1f] dark:text-[#c9a96e]'
                        )}>
                          {item.value}
                        </span>
                        {' '}{item.label}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rodapé */}
      <div className="border-t border-[#c9a96e]/10 px-5 py-2 flex items-center gap-2 bg-[#3d2b1f]/[0.02]">
        <RefreshCw className="h-3 w-3 text-[#c9a96e]/40" />
        <span className="text-[11px] text-[#3d2b1f]/40 dark:text-[#c9a96e]/40">
          Atualiza em tempo real
        </span>
        {(stats.tarefas.atrasadas + stats.audiencias.atrasadas + stats.compromissos.atrasadas) > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="text-[11px] font-semibold text-red-600">
              {stats.tarefas.atrasadas + stats.audiencias.atrasadas + stats.compromissos.atrasadas} itens atrasados
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
