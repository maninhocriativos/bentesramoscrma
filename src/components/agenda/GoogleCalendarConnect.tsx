import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Calendar as CalendarIcon, 
  Link, 
  Unlink, 
  RefreshCw, 
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function GoogleCalendarConnect() {
  const { 
    isConnected, 
    isLoading, 
    isSyncing, 
    connect, 
    disconnect, 
    syncToGoogle 
  } = useGoogleCalendar();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn(
            "gap-2",
            isConnected && "border-green-500/50 text-green-600 dark:text-green-400"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Google Calendar</span>
          {isConnected && <CheckCircle className="h-3 w-3" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Google Calendar</h4>
            <p className="text-xs text-muted-foreground">
              {isConnected 
                ? 'Sua conta do Google está conectada. Os eventos criados aqui serão sincronizados.'
                : 'Conecte sua conta para sincronizar eventos com o Google Calendar.'
              }
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {isConnected ? (
              <>
                <Button 
                  onClick={syncToGoogle} 
                  disabled={isSyncing}
                  className="w-full"
                  size="sm"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sincronizar Agora
                </Button>
                <Button 
                  variant="outline" 
                  onClick={disconnect}
                  className="w-full text-destructive hover:text-destructive"
                  size="sm"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button onClick={connect} className="w-full" size="sm">
                <Link className="h-4 w-4 mr-2" />
                Conectar Google Calendar
              </Button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Apenas tarefas e reuniões criadas no sistema serão sincronizadas para sua agenda Google.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
