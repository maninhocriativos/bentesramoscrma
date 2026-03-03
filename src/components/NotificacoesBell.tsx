import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotificacoes, Notificacao } from '@/hooks/useNotificacoes';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tipoIcons: Record<string, string> = {
  handoff: '🚨',
  info: 'ℹ️',
  alerta: '⚠️',
  sucesso: '✅',
};

const tipoBadgeColors: Record<string, string> = {
  handoff: 'bg-destructive/10 text-destructive border-destructive/20',
  alerta: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  sucesso: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export function NotificacoesBell() {
  const { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas } = useNotificacoes();
  const navigate = useNavigate();

  const handleClick = (notif: Notificacao) => {
    if (!notif.lida) marcarComoLida(notif.id);
    if (notif.link) navigate(notif.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-xl border-border hover:bg-muted h-8 w-8 md:h-10 md:w-10"
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold animate-pulse">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notificações</h3>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={marcarTodasComoLidas}>
              <CheckCheck className="h-3 w-3" /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notificacoes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notificacoes.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3',
                    !notif.lida && 'bg-primary/5'
                  )}
                >
                  <span className="text-lg shrink-0 mt-0.5">{tipoIcons[notif.tipo] || 'ℹ️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">{notif.titulo}</span>
                      {!notif.lida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{notif.mensagem}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', tipoBadgeColors[notif.tipo])}>
                        {notif.tipo}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  {notif.link && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
