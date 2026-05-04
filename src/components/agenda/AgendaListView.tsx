import { useMemo } from 'react';
import { format, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ChevronRight } from 'lucide-react';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { cn } from '@/lib/utils';

const TIPO_DOT: Record<string, string> = {
  'Audiência': '#db2777',
  'Reunião':   '#d97706',
  'Prazo':     '#ca8a04',
  'Tarefa':    '#16a34a',
  'Intimação': '#64748b',
  'Outro':     '#64748b',
};

const TIPO_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  'Audiência': { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200' },
  'Reunião':   { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  'Prazo':     { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'Tarefa':    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  'Intimação': { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
  'Outro':     { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200' },
};

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pendente:   { label: 'Pendente',   bg: 'bg-amber-50', text: 'text-amber-700' },
  confirmado: { label: 'Confirmado', bg: 'bg-green-50',  text: 'text-green-700' },
  cancelado:  { label: 'Cancelado',  bg: 'bg-red-50',    text: 'text-red-700' },
  remarcado:  { label: 'Remarcado',  bg: 'bg-blue-50',   text: 'text-blue-700' },
};

interface AgendaListViewProps {
  compromissos: Compromisso[];
  onEventClick: (c: Compromisso) => void;
  onStatusChange: (id: string, status: ConfirmacaoStatus) => void;
}

export function AgendaListView({ compromissos, onEventClick }: AgendaListViewProps) {
  const grouped = useMemo(() => {
    const sorted = [...compromissos].sort(
      (a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
    );
    const map = new Map<string, Compromisso[]>();
    for (const c of sorted) {
      const key = format(new Date(c.data_inicio), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      date: new Date(key + 'T12:00:00'),
      items,
    }));
  }, [compromissos]);

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.1)' }}>
          <Clock className="h-7 w-7" style={{ color: '#c9a96e' }} />
        </div>
        <p className="text-sm font-medium">Nenhum compromisso encontrado</p>
        <p className="text-xs">Tente ajustar os filtros ou criar um novo compromisso</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      {grouped.map(({ key, date, items }) => {
        const past      = isPast(date) && !isToday(date);
        const today     = isToday(date);
        const tomorrow  = isTomorrow(date);
        const daysUntil = differenceInDays(date, new Date());

        return (
          <div
            key={key}
            className={cn('rounded-2xl overflow-hidden', past && 'opacity-60')}
            style={{ border: '0.5px solid rgba(201,169,110,0.2)' }}
          >
            {/* Day header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                background: today ? 'linear-gradient(135deg, #1e1008, #3d2010)' : 'rgba(201,169,110,0.06)',
                borderBottom: '0.5px solid rgba(201,169,110,0.15)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                  style={{
                    background: today ? '#c9a96e' : past ? 'rgba(0,0,0,0.06)' : 'rgba(201,169,110,0.18)',
                    color: today ? '#1e1008' : past ? '#9ca3af' : '#3d2b1f',
                  }}
                >
                  {format(date, 'd')}
                </div>
                <div>
                  <p className="text-sm font-bold capitalize" style={{ color: today ? '#fff' : undefined }}>
                    {today ? 'Hoje' : tomorrow ? 'Amanhã' : format(date, 'EEEE', { locale: ptBR })}
                  </p>
                  <p className="text-[11px]" style={{ color: today ? '#c9a96e' : undefined }}>
                    <span className={!today ? 'text-muted-foreground' : ''}>
                      {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {tomorrow && !today && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
                    Amanhã
                  </span>
                )}
                {!today && !tomorrow && !past && daysUntil > 0 && daysUntil <= 7 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    em {daysUntil} dias
                  </span>
                )}
                {past && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                    Passado
                  </span>
                )}
                <span
                  className="text-[11px]"
                  style={{ color: today ? 'rgba(255,255,255,0.55)' : undefined }}
                >
                  <span className={!today ? 'text-muted-foreground' : ''}>
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                </span>
              </div>
            </div>

            {/* Items */}
            <div className="bg-card divide-y divide-border/40">
              {items.map((c) => {
                const dot         = TIPO_DOT[c.tipo]   || '#64748b';
                const tipoBadge   = TIPO_BADGE[c.tipo]  || TIPO_BADGE['Outro'];
                const statusBadge = STATUS_BADGE[c.confirmacao_status || 'pendente'];
                const hora        = format(new Date(c.data_inicio), 'HH:mm');
                const horaFim     = c.data_fim ? format(new Date(c.data_fim), 'HH:mm') : null;

                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={() => onEventClick(c)}
                  >
                    <div
                      className="w-[3px] self-stretch rounded-full shrink-0"
                      style={{ background: dot, minHeight: 28 }}
                    />

                    <div className="w-12 shrink-0 text-right tabular-nums">
                      <p className="text-[13px] font-bold">{hora}</p>
                      {horaFim && <p className="text-[10px] text-muted-foreground">{horaFim}</p>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.titulo}</p>
                      {c.descricao && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.descricao}</p>
                      )}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', tipoBadge.bg, tipoBadge.text, tipoBadge.border)}>
                        {c.tipo}
                      </span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusBadge.bg, statusBadge.text)}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
