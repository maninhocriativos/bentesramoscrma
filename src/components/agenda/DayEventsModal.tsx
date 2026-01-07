import { format, isSameDay, parseISO, isPast } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Video, 
  Building2, 
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';

const TIMEZONE = 'America/Manaus';

const parseLocalDate = (dateString: string): Date => {
  const utcDate = parseISO(dateString);
  return toZonedTime(utcDate, TIMEZONE);
};

const getModalidadeIcon = (compromisso: Compromisso) => {
  const tipo = compromisso.tipo?.toLowerCase() || '';
  const descricao = compromisso.descricao?.toLowerCase() || '';
  
  if (tipo.includes('online') || descricao.includes('online') || descricao.includes('virtual') || descricao.includes('remoto')) {
    return { icon: Video, color: 'text-blue-500', label: 'Online' };
  }
  if (tipo.includes('presencial') || descricao.includes('presencial') || descricao.includes('escritório') || descricao.includes('escritorio')) {
    return { icon: Building2, color: 'text-amber-600', label: 'Presencial' };
  }
  return null;
};

const TIPO_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Reunião': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  'Audiência': { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  'Prazo': { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  'Tarefa': { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Outro': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-500' },
};

const CONFIRMACAO_ICONS: Record<ConfirmacaoStatus, { icon: typeof CheckCircle2; color: string }> = {
  pendente: { icon: Clock, color: 'text-amber-500' },
  confirmado: { icon: CheckCircle2, color: 'text-emerald-500' },
  remarcado: { icon: AlertCircle, color: 'text-blue-500' },
  cancelado: { icon: XCircle, color: 'text-red-500' },
};

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  compromissos: Compromisso[];
  onEventClick: (compromisso: Compromisso) => void;
  onNewEvent: () => void;
}

export function DayEventsModal({ 
  isOpen, 
  onClose, 
  date, 
  compromissos, 
  onEventClick,
  onNewEvent 
}: DayEventsModalProps) {
  if (!date) return null;

  const dayCompromissos = compromissos
    .filter(c => isSameDay(parseLocalDate(c.data_inicio), date))
    .sort((a, b) => parseLocalDate(a.data_inicio).getTime() - parseLocalDate(b.data_inicio).getTime());

  const getColors = (tipo: string) => TIPO_COLORS[tipo] || TIPO_COLORS['Outro'];

  const handleEventClick = (compromisso: Compromisso) => {
    onClose();
    onEventClick(compromisso);
  };

  const handleNewEvent = () => {
    onClose();
    onNewEvent();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold capitalize">
                  {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-sm text-muted-foreground font-normal">
                  {dayCompromissos.length} evento{dayCompromissos.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] mt-4">
          <div className="space-y-3 pr-4">
            {dayCompromissos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-muted-foreground font-medium">Nenhum evento neste dia</p>
                <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                  Clique abaixo para adicionar um novo evento
                </p>
                <Button onClick={handleNewEvent} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Evento
                </Button>
              </div>
            ) : (
              dayCompromissos.map(compromisso => {
                const colors = getColors(compromisso.tipo);
                const modalidade = getModalidadeIcon(compromisso);
                const ModalidadeIcon = modalidade?.icon;
                const confirmStatus = (compromisso.confirmacao_status || 'pendente') as ConfirmacaoStatus;
                const confirmConfig = compromisso.lead_id ? CONFIRMACAO_ICONS[confirmStatus] : null;
                const ConfirmIcon = confirmConfig?.icon;

                return (
                  <div
                    key={compromisso.id}
                    className={cn(
                      "flex items-stretch gap-0 rounded-xl border bg-card overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group",
                      colors.bg
                    )}
                    onClick={() => handleEventClick(compromisso)}
                  >
                    {/* Time column */}
                    <div className="flex flex-col items-center justify-center w-20 py-3 bg-muted/40 border-r">
                      <Clock className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-lg font-bold text-foreground leading-none">
                        {format(parseLocalDate(compromisso.data_inicio), 'HH:mm')}
                      </p>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {compromisso.titulo}
                        </h4>
                        <Badge variant="outline" className={cn("shrink-0 text-[10px] font-medium", colors.text)}>
                          {compromisso.tipo}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {ModalidadeIcon && (
                          <span className={cn("flex items-center gap-1 font-medium", modalidade.color)}>
                            <ModalidadeIcon className="h-3 w-3" />
                            <span>{modalidade.label}</span>
                          </span>
                        )}
                        
                        {ConfirmIcon && (
                          <span className={cn("flex items-center gap-1", confirmConfig.color)}>
                            <ConfirmIcon className="h-3 w-3" />
                            <span className="capitalize">{confirmStatus}</span>
                          </span>
                        )}
                        
                        {compromisso.descricao && (
                          <span className="truncate max-w-[180px]">
                            {compromisso.descricao.slice(0, 35)}...
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Arrow indicator */}
                    <div className="flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {dayCompromissos.length > 0 && (
          <div className="pt-4 border-t mt-4">
            <Button onClick={handleNewEvent} variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Adicionar evento neste dia
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}