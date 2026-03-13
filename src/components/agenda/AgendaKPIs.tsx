import { useMemo } from 'react';
import { format, isToday, isBefore, isAfter, startOfDay } from 'date-fns';
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

  return (
    <div className="grid grid-cols-5 border border-border/60 rounded-lg overflow-hidden bg-card">
      {/* Date cell */}
      <div className="flex flex-col items-center justify-center py-3 px-2 border-r border-border/40">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-3 py-0.5 rounded-sm">
          {monthName}
        </span>
        <span className="text-3xl font-bold text-foreground leading-tight mt-1">{dayNum}</span>
        <span className="text-[11px] text-muted-foreground capitalize">{dayName}</span>
      </div>

      {/* Tarefas */}
      <div className="flex items-center gap-3 py-3 px-4 border-r border-border/40">
        <CircularProgress value={stats.tarefas.total} max={Math.max(stats.tarefas.total, 1)} color="#f97316" />
        <div>
          <p className="text-sm font-bold text-foreground">Tarefas</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="text-destructive font-semibold">{stats.tarefas.atrasadas}</span> atrasadas
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="font-semibold text-emerald-600">{stats.tarefas.hoje}</span> hoje
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="font-semibold">{stats.tarefas.futuras}</span> futuras
          </p>
        </div>
      </div>

      {/* Intimações */}
      <div className="flex items-center gap-3 py-3 px-4 border-r border-border/40">
        <CircularProgress value={stats.intimacoes.total} max={Math.max(stats.intimacoes.total, 1)} color="#f97316" />
        <div>
          <p className="text-sm font-bold text-foreground">Intimações</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="text-destructive font-semibold">{stats.intimacoes.pendentes}</span> pendentes
          </p>
        </div>
      </div>

      {/* Audiências */}
      <div className="flex items-center gap-3 py-3 px-4 border-r border-border/40">
        <CircularProgress value={stats.audiencias.total} max={Math.max(stats.audiencias.total, 1)} color="#f97316" />
        <div>
          <p className="text-sm font-bold text-foreground">Audiências</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="text-destructive font-semibold">{stats.audiencias.atrasadas}</span> atrasadas
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="font-semibold text-emerald-600">{stats.audiencias.hoje}</span> hoje
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="font-semibold">{stats.audiencias.futuras}</span> futuras
          </p>
        </div>
      </div>

      {/* Compromissos */}
      <div className="flex items-center gap-3 py-3 px-4">
        <CircularProgress value={stats.compromissos.total} max={Math.max(stats.compromissos.total, 1)} color="#f97316" />
        <div>
          <p className="text-sm font-bold text-foreground">Compromissos</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="text-destructive font-semibold">{stats.compromissos.atrasadas}</span> atrasados
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="font-semibold text-emerald-600">{stats.compromissos.hoje}</span> hoje
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            <span className="font-semibold">{stats.compromissos.futuras}</span> futuros
          </p>
        </div>
      </div>
    </div>
  );
}
