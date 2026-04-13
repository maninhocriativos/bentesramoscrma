import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Calendar, Link2, Link2Off, RefreshCw,
  ArrowUpToLine, ArrowDownToLine, CheckCircle2,
  Loader2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function GoogleCalendarConnect() {
  const {
    isConnected, isLoading, isSyncing, lastSync,
    connect, disconnect, syncToGoogle, syncFromGoogle, syncFull,
  } = useGoogleCalendar();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled
        className="h-8 rounded-xl border-[rgba(201,169,110,0.25)] gap-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">Google Calendar</span>
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
            'h-8 rounded-xl gap-1.5 text-xs transition-all',
            isConnected
              ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
              : 'border-[rgba(201,169,110,0.25)] text-muted-foreground'
          )}
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calendar className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Google Calendar</span>
          {isConnected && !isSyncing && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl" align="end">
        {/* Header */}
        <div className="bg-[#3d2b1f] px-4 py-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#c9a96e]/15 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-[#c9a96e]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#c9a96e]">Google Calendar</p>
            <p className="text-[11px] text-[#c9a96e]/50">
              {isConnected ? 'Conectado e sincronizando' : 'Não conectado'}
            </p>
          </div>
          {isConnected && (
            <div className="ml-auto h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>

        <div className="p-4 space-y-3">
          {!isConnected ? (
            /* ── Não conectado ── */
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Conecte sua conta Google para sincronizar compromissos entre o CRM e o Google Calendar automaticamente.
              </p>
              <Button
                onClick={connect}
                className="w-full bg-[#3d2b1f] hover:bg-[#5c3d2e] text-[#c9a96e] border border-[#c9a96e]/30 rounded-xl text-xs"
                size="sm"
              >
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Conectar Google Calendar
              </Button>
            </>
          ) : (
            /* ── Conectado ── */
            <>
              {/* Status */}
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Conta conectada</p>
                    {lastSync && (
                      <p className="text-[11px] text-emerald-600/70 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        Última sync: {format(lastSync, "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações de sincronização */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Sincronização
                </p>

                {/* Sync bidirecional completo */}
                <Button
                  onClick={syncFull}
                  disabled={isSyncing}
                  className="w-full bg-[#3d2b1f] hover:bg-[#5c3d2e] text-[#c9a96e] border border-[#c9a96e]/30 rounded-xl text-xs"
                  size="sm"
                >
                  {isSyncing
                    ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  }
                  Sincronizar tudo (bidirecional)
                </Button>

                {/* Exportar CRM → Google */}
                <Button
                  onClick={syncToGoogle}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full rounded-xl text-xs border-[#c9a96e]/25 hover:bg-[#c9a96e]/5"
                  size="sm"
                >
                  <ArrowUpToLine className="h-3.5 w-3.5 mr-2 text-[#c9a96e]" />
                  Enviar CRM → Google
                </Button>

                {/* Importar Google → CRM */}
                <Button
                  onClick={syncFromGoogle}
                  disabled={isSyncing}
                  variant="outline"
                  className="w-full rounded-xl text-xs border-[#c9a96e]/25 hover:bg-[#c9a96e]/5"
                  size="sm"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 mr-2 text-[#c9a96e]" />
                  Importar Google → CRM
                </Button>
              </div>

              {/* Desconectar */}
              <div className="pt-1 border-t border-[#c9a96e]/10">
                <Button
                  onClick={disconnect}
                  variant="ghost"
                  className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                  size="sm"
                >
                  <Link2Off className="h-3.5 w-3.5 mr-2" />
                  Desconectar conta Google
                </Button>
              </div>
            </>
          )}

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Eventos criados no CRM são enviados automaticamente ao Google Calendar
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
