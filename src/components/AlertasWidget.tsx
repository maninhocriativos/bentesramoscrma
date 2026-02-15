import { AlertTriangle, Clock, FileText, ChevronRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alerta } from '@/hooks/useAlertas';
import { cn } from '@/lib/utils';

interface AlertasWidgetProps {
  alertas: Alerta[];
  compact?: boolean;
  onAlertClick?: (alerta: Alerta) => void;
}

const TIPO_CONFIG = {
  risco: { icon: AlertTriangle, color: 'text-primary', bg: 'bg-primary/10' },
  prazo: { icon: Clock, color: 'text-[hsl(var(--gold))]', bg: 'bg-[hsl(var(--gold))]/10' },
  tarefa: { icon: FileText, color: 'text-primary/70', bg: 'bg-primary/10' },
  resposta: { icon: AlertTriangle, color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success))]/10' },
};

const PRIORIDADE_BADGE = {
  alta: 'bg-primary text-primary-foreground',
  media: 'bg-[hsl(var(--gold))] text-[hsl(var(--gold-foreground))]',
  baixa: 'bg-muted text-muted-foreground',
};

export function AlertasWidget({ alertas, compact = false, onAlertClick }: AlertasWidgetProps) {
  if (alertas.length === 0) {
    return (
      <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
        <div className="h-1 w-full bg-[hsl(var(--success))]" />
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--success))]/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" />
            </div>
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--success))]/10 flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6 text-[hsl(var(--success))]" />
            </div>
            <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum alerta no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayAlertas = compact ? alertas.slice(0, 5) : alertas;

  return (
    <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="h-1 w-full bg-primary" />
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          Alertas
          <Badge className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-5">
            {alertas.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y divide-border/40">
            {displayAlertas.map((alerta) => {
              const config = TIPO_CONFIG[alerta.tipo];
              const Icon = config.icon;
              
              return (
                <div
                  key={alerta.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors",
                    onAlertClick && "cursor-pointer"
                  )}
                  onClick={() => onAlertClick?.(alerta)}
                >
                  <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", config.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {alerta.titulo}
                      </span>
                      <Badge className={cn("text-[9px] px-1.5 py-0 h-4", PRIORIDADE_BADGE[alerta.prioridade])}>
                        {alerta.prioridade}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {alerta.descricao}
                    </p>
                  </div>
                  {onAlertClick && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {compact && alertas.length > 5 && (
          <div className="p-2 border-t border-border/30 text-center">
            <span className="text-xs text-muted-foreground">
              +{alertas.length - 5} alertas adicionais
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
