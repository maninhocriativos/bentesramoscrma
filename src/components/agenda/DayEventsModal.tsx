import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Clock, Video, Building2, Calendar as CalendarIcon,
  CheckCircle2, AlertCircle, XCircle, ArrowRight, Plus, Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { IntimacaoEvent } from '@/hooks/useIntimacoes';

const TZ = 'America/Manaus';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Data do evento em Manaus (yyyy-MM-dd). */
const eventDateStr = (isoStr: string): string => {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, TZ, 'yyyy-MM-dd');
  } catch { return ''; }
};

/** Horário do evento em Manaus (HH:mm). */
const eventTime = (isoStr: string): string => {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, TZ, 'HH:mm');
  } catch { return ''; }
};

const getModalidadeIcon = (c: Compromisso) => {
  const t = (c.tipo || '').toLowerCase();
  const d = (c.descricao || '').toLowerCase();
  if (t.includes('online') || d.includes('online') || d.includes('virtual') || d.includes('remoto'))
    return { icon: Video, color: 'text-blue-500', label: 'Online' };
  if (t.includes('presencial') || d.includes('presencial') || d.includes('escritório') || d.includes('escritorio'))
    return { icon: Building2, color: 'text-amber-600', label: 'Presencial' };
  return null;
};

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ConfirmacaoStatus, { bg: string; text: string; dot: string; border: string }> = {
  pendente:   { bg: 'bg-amber-50 dark:bg-amber-500/10',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500',   border: 'border-amber-300 dark:border-amber-500/30'   },
  confirmado: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-500/30' },
  remarcado:  { bg: 'bg-blue-50 dark:bg-blue-500/10',     text: 'text-blue-700 dark:text-blue-400',     dot: 'bg-blue-500',    border: 'border-blue-300 dark:border-blue-500/30'     },
  cancelado:  { bg: 'bg-red-50 dark:bg-red-500/10',       text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500',     border: 'border-red-300 dark:border-red-500/30'       },
};

const STATUS_ICONS: Record<ConfirmacaoStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pendente:   { icon: Clock,         color: 'text-amber-500',  label: 'Pendente'   },
  confirmado: { icon: CheckCircle2,  color: 'text-emerald-500', label: 'Confirmado' },
  remarcado:  { icon: AlertCircle,   color: 'text-blue-500',   label: 'Remarcado'  },
  cancelado:  { icon: XCircle,       color: 'text-red-500',    label: 'Cancelado'  },
};

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  'Reunião':   { bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400'    },
  'Audiência': { bg: 'bg-red-500/10',     text: 'text-red-600 dark:text-red-400'      },
  'Prazo':     { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400'  },
  'Tarefa':    { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  'Outro':     { bg: 'bg-slate-500/10',   text: 'text-slate-600 dark:text-slate-400'  },
};

// ─── PROPS ───────────────────────────────────────────────────────────────────

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  compromissos: Compromisso[];
  intimacoes?: IntimacaoEvent[];
  onEventClick: (c: Compromisso) => void;
  onNewEvent: () => void;
  onStatusChange?: (id: string, s: ConfirmacaoStatus) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export function DayEventsModal({
  isOpen, onClose, date, compromissos, intimacoes = [],
  onEventClick, onNewEvent, onStatusChange,
}: DayEventsModalProps) {
  if (!date) return null;

  // Chave do dia clicado no fuso local (igual à chave das células do Calendar)
  const dayKey = format(date, 'yyyy-MM-dd');

  // Filtra eventos cujo dia em Manaus == dia clicado no browser local
  const dayCompromissos = compromissos
    .filter(c => c.data_inicio && eventDateStr(c.data_inicio) === dayKey)
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

  const dayIntimacoes = intimacoes.filter(i => {
    const raw = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
    return raw && eventDateStr(raw) === dayKey;
  });

  const totalEvents = dayCompromissos.length + dayIntimacoes.length;
  const getColors = (tipo: string) => TIPO_COLORS[tipo] || TIPO_COLORS['Outro'];

  const StatusDropdown = ({ compromisso }: { compromisso: Compromisso }) => {
    const status = (compromisso.confirmacao_status || 'pendente') as ConfirmacaoStatus;
    const cfg    = STATUS_ICONS[status];
    const sc     = STATUS_COLORS[status];
    const Icon   = cfg.icon;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all hover:brightness-95', sc.bg, sc.text, sc.border)}
            onClick={e => e.stopPropagation()}
          >
            <Icon className="h-3 w-3" />
            <span>{cfg.label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-xl" onClick={e => e.stopPropagation()}>
          {(Object.entries(STATUS_ICONS) as [ConfirmacaoStatus, typeof cfg][]).map(([key, val]) => {
            const I = val.icon;
            return (
              <DropdownMenuItem key={key} onClick={() => onStatusChange?.(compromisso.id, key)}
                className={cn('gap-2 text-xs', key === status && 'bg-muted')}>
                <I className={cn('h-3.5 w-3.5', val.color)} />
                <span>{val.label}</span>
                {key === status && <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold capitalize">
                {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground font-normal">
                {totalEvents} evento{totalEvents !== 1 ? 's' : ''}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] mt-4">
          <div className="space-y-3 pr-4">
            {totalEvents === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground font-medium">Nenhum evento neste dia</p>
                <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Clique abaixo para adicionar</p>
                <Button onClick={() => { onClose(); onNewEvent(); }} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Evento
                </Button>
              </div>
            ) : (
              <>
                {dayCompromissos.map(c => {
                  const colors    = getColors(c.tipo);
                  const sc        = STATUS_COLORS[(c.confirmacao_status || 'pendente') as ConfirmacaoStatus];
                  const modalidade = getModalidadeIcon(c);
                  const MIcon     = modalidade?.icon;
                  return (
                    <div key={c.id}
                      className={cn('flex items-stretch gap-0 rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group', sc.border, sc.bg)}
                      onClick={() => { onClose(); onEventClick(c); }}>
                      <div className={cn('w-1.5 shrink-0', sc.dot)} />
                      <div className="flex flex-col items-center justify-center w-20 py-3 border-r border-border/20">
                        <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                        <p className="text-lg font-bold text-foreground leading-none">
                          {eventTime(c.data_inicio)}
                        </p>
                      </div>
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{c.titulo}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={cn('text-[10px] font-medium', colors.text)}>{c.tipo}</Badge>
                            <StatusDropdown compromisso={c} />
                          </div>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {MIcon && (
                            <span className={cn('flex items-center gap-1 font-medium', modalidade.color)}>
                              <MIcon className="h-3 w-3" /><span>{modalidade.label}</span>
                            </span>
                          )}
                          {c.descricao && (
                            <span className="truncate max-w-[180px]">{c.descricao.slice(0, 35)}...</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}

                {dayIntimacoes.map(i => {
                  const dateStr = i.data_intimacao || i.data_publicacao || i.data_disponibilizacao;
                  if (!dateStr) return null;
                  return (
                    <div key={i.id} className="flex items-stretch gap-0 rounded-xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 overflow-hidden">
                      <div className="w-1.5 shrink-0 bg-purple-500" />
                      <div className="flex flex-col items-center justify-center w-20 py-3 border-r border-purple-200/30">
                        <Scale className="h-4 w-4 text-purple-500 mb-1" />
                        <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">PRAZO</p>
                      </div>
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-purple-800 dark:text-purple-300 truncate">
                            {i.processo_cnj || 'Intimação'}
                          </h4>
                          <Badge className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-[10px] shrink-0">Intimação</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {i.processo_titulo || i.conteudo?.slice(0, 100) || 'Sem detalhes'}
                        </p>
                        {i.tribunal && (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-1 inline-block">{i.tribunal}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>

        {totalEvents > 0 && (
          <div className="pt-4 border-t mt-4">
            <Button onClick={() => { onClose(); onNewEvent(); }} variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" /> Adicionar evento neste dia
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
