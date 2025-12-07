import { AlertTriangle, Clock, FileText, ChevronRight } from 'lucide-react';
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
  risco: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
  prazo: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  tarefa: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

const PRIORIDADE_BADGE = {
  alta: 'bg-red-500 text-white',
  media: 'bg-amber-500 text-white',
  baixa: 'bg-slate-400 text-white',
};

export function AlertasWidget({ alertas, compact = false, onAlertClick }: AlertasWidgetProps) {
  if (alertas.length === 0) {
    return (
      <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas do Gestor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center py-4">
            ✅ Nenhum alerta no momento
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayAlertas = compact ? alertas.slice(0, 5) : alertas;

  return (
    <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Alertas do Gestor
          <Badge className="ml-auto bg-red-500 text-white text-xs">
            {alertas.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={compact ? 'h-[200px]' : 'h-[300px]'}>
          <div className="divide-y divide-border">
            {displayAlertas.map((alerta) => {
              const config = TIPO_CONFIG[alerta.tipo];
              const Icon = config.icon;
              
              return (
                <div
                  key={alerta.id}
                  className={cn(
                    "flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors",
                    onAlertClick && "cursor-pointer"
                  )}
                  onClick={() => onAlertClick?.(alerta)}
                >
                  <div className={cn("p-2 rounded-lg shrink-0", config.bg)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground truncate">
                        {alerta.titulo}
                      </span>
                      <Badge className={cn("text-[10px] px-1.5 py-0", PRIORIDADE_BADGE[alerta.prioridade])}>
                        {alerta.prioridade}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {alerta.descricao}
                    </p>
                  </div>
                  {onAlertClick && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {compact && alertas.length > 5 && (
          <div className="p-2 border-t bg-muted/30 text-center">
            <span className="text-xs text-muted-foreground">
              +{alertas.length - 5} alertas adicionais
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
