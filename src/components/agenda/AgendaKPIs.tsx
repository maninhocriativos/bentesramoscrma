import { useMemo } from 'react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { Compromisso } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';

const TIMEZONE = 'America/Manaus';

interface CircularProgressProps {
  value: number;
  max: number;
  color: string;
  size?: number;
}

function CircularProgress({ value, max, color, size = 56 }: CircularProgressProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - pct * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
        {value}
      </span>
    </div>
  );
}

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
    const intLidas = intimacoes.filter(i => i.lida).length;

    return {
      tarefas: { total: tarefas.length, ...countByTime(tarefas) },
      intimacoes: { total: intimacoes.length, pendentes: intNaoLidas, lidas: intLidas },
      audiencias: { total: audiencias.length, ...countByTime(audiencias) },
      compromissos: { total: outros.length, ...countByTime(outros) },
    };
  }, [compromissos, intimacoes, todayStart]);

  const dayName = format(now, 'EEEE', { locale: ptBR });
  const dayNum = format(now, 'd');
  const monthName = format(now, 'MMMM', { locale: ptBR });

  const kpis = [
    {
      title: 'Tarefas',
      total: stats.tarefas.total,
      color: '#f97316',
      lines: [
        { value: stats.tarefas.atrasadas, label: 'atrasadas', variant: 'danger' as const },
        { value: stats.tarefas.hoje, label: 'hoje', variant: 'success' as const },
        { value: stats.tarefas.futuras, label: 'futuras', variant: 'default' as const },
      ],
    },
    {
      title: 'Intimações',
      total: stats.intimacoes.total,
      color: '#f97316',
      lines: [
        { value: stats.intimacoes.pendentes, label: 'pendentes', variant: 'danger' as const },
      ],
    },
    {
      title: 'Audiências',
      total: stats.audiencias.total,
      color: '#f97316',
      lines: [
        { value: stats.audiencias.atrasadas, label: 'atrasadas', variant: 'danger' as const },
        { value: stats.audiencias.hoje, label: 'hoje', variant: 'success' as const },
        { value: stats.audiencias.futuras, label: 'futuras', variant: 'default' as const },
      ],
    },
    {
      title: 'Compromissos',
      total: stats.compromissos.total,
      color: '#f97316',
      lines: [
        { value: stats.compromissos.atrasadas, label: 'atrasados', variant: 'danger' as const },
        { value: stats.compromissos.hoje, label: 'hoje', variant: 'success' as const },
        { value: stats.compromissos.futuras, label: 'futuros', variant: 'default' as const },
      ],
    },
  ];

  const variantClass = (v: 'danger' | 'success' | 'default') => {
    if (v === 'danger') return 'text-destructive font-semibold';
    if (v === 'success') return 'font-semibold text-emerald-600';
    return 'font-semibold';
  };

  return (
    <div className="flex border border-border/60 rounded-lg overflow-hidden bg-card shadow-sm">
      {/* Date cell */}
      <div className="flex flex-col items-center justify-center py-3 px-5 border-r border-border/40 min-w-[100px]">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-3 py-0.5 rounded-sm">
          {monthName}
        </span>
        <span className="text-3xl font-bold text-foreground leading-tight mt-1">{dayNum}</span>
        <span className="text-[11px] text-muted-foreground capitalize">{dayName}</span>
      </div>

      {/* KPI cells */}
      {kpis.map((kpi, idx) => (
        <div key={kpi.title} className={`flex items-center gap-3 py-3 px-4 flex-1 ${idx < kpis.length - 1 ? 'border-r border-border/40' : ''}`}>
          <CircularProgress value={kpi.total} max={Math.max(kpi.total, 1)} color={kpi.color} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{kpi.title}</p>
            {kpi.lines.map((line, li) => (
              <p key={li} className="text-[11px] text-muted-foreground leading-tight">
                <span className={variantClass(line.variant)}>{line.value}</span> {line.label}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
