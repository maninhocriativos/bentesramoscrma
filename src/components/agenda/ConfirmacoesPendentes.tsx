import { useState } from 'react';
import { format, parseISO, isFuture } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Phone,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Compromisso, ConfirmacaoStatus } from '@/types/compromissos';

const TIMEZONE = 'America/Manaus';

const parseLocalDate = (dateString: string): Date => {
  const utcDate = parseISO(dateString);
  return toZonedTime(utcDate, TIMEZONE);
};

interface ConfirmacoesPendentesProps {
  compromissos: Compromisso[];
  onEventClick: (compromisso: Compromisso) => void;
}

const STATUS_CONFIG: Record<ConfirmacaoStatus, { 
  label: string; 
  icon: typeof CheckCircle2; 
  color: string;
  bgColor: string;
}> = {
  pendente: { 
    label: 'Aguardando', 
    icon: Clock, 
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20'
  },
  confirmado: { 
    label: 'Confirmado', 
    icon: CheckCircle2, 
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20'
  },
  remarcado: { 
    label: 'Remarcar', 
    icon: AlertCircle, 
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20'
  },
  cancelado: { 
    label: 'Cancelado', 
    icon: XCircle, 
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20'
  },
};

export function ConfirmacoesPendentes({ compromissos, onEventClick }: ConfirmacoesPendentesProps) {
  const [filter, setFilter] = useState<ConfirmacaoStatus | 'todos'>('pendente');
  
  // Filtrar apenas compromissos futuros com lead vinculado
  const compromissosFuturos = compromissos.filter(c => 
    isFuture(parseLocalDate(c.data_inicio)) && c.lead_id
  );
  
  const filteredCompromissos = filter === 'todos' 
    ? compromissosFuturos
    : compromissosFuturos.filter(c => (c.confirmacao_status || 'pendente') === filter);
  
  const counts = {
    pendente: compromissosFuturos.filter(c => (c.confirmacao_status || 'pendente') === 'pendente').length,
    confirmado: compromissosFuturos.filter(c => c.confirmacao_status === 'confirmado').length,
    remarcado: compromissosFuturos.filter(c => c.confirmacao_status === 'remarcado').length,
    cancelado: compromissosFuturos.filter(c => c.confirmacao_status === 'cancelado').length,
  };

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Confirmações
            </h3>
            <p className="text-xs text-white/80">{counts.pendente} aguardando resposta</p>
          </div>
          <Badge className="bg-white/20 text-white border-0">
            {compromissosFuturos.length} futuros
          </Badge>
        </div>
      </div>
      
      {/* Filter tabs */}
      <div className="flex gap-1 p-2 border-b bg-muted/30 overflow-x-auto">
        <Button
          variant={filter === 'todos' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-7 shrink-0"
          onClick={() => setFilter('todos')}
        >
          Todos
        </Button>
        {(Object.keys(STATUS_CONFIG) as ConfirmacaoStatus[]).map(status => {
          const config = STATUS_CONFIG[status];
          const count = counts[status];
          return (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "text-xs h-7 gap-1 shrink-0",
                filter !== status && config.color
              )}
              onClick={() => setFilter(status)}
            >
              <config.icon className="h-3 w-3" />
              {config.label}
              {count > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
      
      <ScrollArea className="h-[300px]">
        <div className="p-3 space-y-2">
          {filteredCompromissos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'pendente' 
                  ? 'Nenhuma confirmação pendente' 
                  : `Nenhum compromisso ${STATUS_CONFIG[filter as ConfirmacaoStatus]?.label.toLowerCase() || ''}`
                }
              </p>
            </div>
          ) : (
            filteredCompromissos.map(compromisso => {
              const status = (compromisso.confirmacao_status || 'pendente') as ConfirmacaoStatus;
              const config = STATUS_CONFIG[status];
              const StatusIcon = config.icon;
              
              return (
                <div
                  key={compromisso.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md group",
                    config.bgColor
                  )}
                  onClick={() => onEventClick(compromisso)}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    config.bgColor
                  )}>
                    <StatusIcon className={cn("h-5 w-5", config.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{compromisso.titulo}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(parseLocalDate(compromisso.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                      <Badge variant="outline" className={cn("text-[10px]", config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    {compromisso.confirmacao_resposta && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate italic">
                        "{compromisso.confirmacao_resposta}"
                      </p>
                    )}
                  </div>
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
