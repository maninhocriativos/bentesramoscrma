import { AlertTriangle, Clock, FileText, ChevronRight, ShieldCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alerta } from '@/hooks/useAlertas';
import { cn } from '@/lib/utils';

interface AlertasWidgetProps {
  alertas: Alerta[];
  compact?: boolean;
  onAlertClick?: (alerta: Alerta) => void;
}

const TIPO_CONFIG = {
  risco:    { icon: AlertTriangle, dot: '#dc2626', iconBg: 'rgba(220,38,38,0.08)',   iconColor: '#dc2626' },
  prazo:    { icon: Clock,         dot: '#c9a96e', iconBg: 'rgba(201,169,110,0.1)',  iconColor: '#b8922a' },
  tarefa:   { icon: FileText,      dot: '#3d2b1f', iconBg: 'rgba(61,43,31,0.08)',    iconColor: '#3d2b1f' },
  resposta: { icon: AlertTriangle, dot: '#16a34a', iconBg: 'rgba(22,163,74,0.08)',   iconColor: '#16a34a' },
};

const PRIORIDADE_COLORS = {
  alta:  { bg: '#fef2f2', text: '#dc2626', border: 'rgba(220,38,38,0.2)',   left: '#dc2626' },
  media: { bg: '#fffbeb', text: '#b8922a', border: 'rgba(201,169,110,0.3)', left: '#c9a96e' },
  baixa: { bg: '#eff6ff', text: '#2563eb', border: 'rgba(37,99,235,0.2)',   left: '#3b82f6' },
};

export function AlertasWidget({ alertas, compact = false, onAlertClick }: AlertasWidgetProps) {
  const displayAlertas = compact ? alertas.slice(0, 5) : alertas;

  if (alertas.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden bg-card flex flex-col"
        style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ height: 3, background: '#16a34a' }} />
        <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.08)' }}>
            <ShieldCheck style={{ width: 16, height: 16, color: '#16a34a' }} />
          </div>
          <span className="text-sm font-semibold text-foreground">Alertas</span>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(22,163,74,0.08)' }}>
            <ShieldCheck style={{ width: 24, height: 24, color: '#16a34a' }} />
          </div>
          <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhum alerta no momento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-card flex flex-col"
      style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ height: 3, background: '#dc2626' }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.08)' }}>
          <AlertTriangle style={{ width: 16, height: 16, color: '#dc2626' }} />
        </div>
        <span className="text-sm font-semibold text-foreground flex-1">Alertas</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid rgba(220,38,38,0.2)' }}>
          {alertas.length}
        </span>
      </div>

      {/* Lista */}
      <ScrollArea style={{ height: 300 }}>
        <div className="p-3 space-y-2">
          {displayAlertas.map((alerta) => {
            const cfg = TIPO_CONFIG[alerta.tipo] || TIPO_CONFIG.risco;
            const pCfg = PRIORIDADE_COLORS[alerta.prioridade] || PRIORIDADE_COLORS.media;
            const Icon = cfg.icon;

            return (
              <div
                key={alerta.id}
                onClick={() => onAlertClick?.(alerta)}
                className={cn('rounded-xl p-3 transition-all', onAlertClick && 'cursor-pointer hover:opacity-90')}
                style={{
                  background: pCfg.bg,
                  border: `0.5px solid ${pCfg.border}`,
                  borderLeft: `3px solid ${pCfg.left}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  {/* Ícone */}
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.iconBg }}>
                    <Icon style={{ width: 13, height: 13, color: cfg.iconColor }} className={alerta.prioridade === 'alta' ? 'animate-pulse' : ''} />
                  </div>

                  {/* Texto — sem truncate, quebra linha */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'inherit' }}>
                        {alerta.titulo}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5,
                        background: pCfg.border, color: pCfg.text, textTransform: 'uppercase', letterSpacing: '0.05em'
                      }}>
                        {alerta.prioridade}
                      </span>
                    </div>
                    {/* Descrição sem truncate */}
                    <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {alerta.descricao}
                    </p>
                  </div>

                  {onAlertClick && (
                    <ChevronRight style={{ width: 14, height: 14, color: '#d1d5db', flexShrink: 0, marginTop: 2 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {compact && alertas.length > 5 && (
        <div className="px-5 py-2.5 text-center" style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>+{alertas.length - 5} alertas adicionais</span>
        </div>
      )}
    </div>
  );
}
