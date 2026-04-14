import { useState, useMemo } from 'react';
import { Lead } from '@/types/leads';
import { RefreshCw, Users, UserPlus, Activity, Clock, TrendingUp, CheckCircle, Wifi, AlertCircle, Scale } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface RealtimeLeadsMonitorProps {
  leads: Lead[];
  onRefresh?: () => void;
}

const CONVERTED_STATES = ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'];

const STATUS_COLORS: Record<string, string> = {
  'Lead Frio':           '#94a3b8',
  'Em Atendimento':      '#3b82f6',
  'Em Negociação':       '#8b5cf6',
  'Aguardando Contrato': '#f59e0b',
  'Contrato Assinado':   '#0d9488',
  'Ganho':               '#22c55e',
};

export function RealtimeLeadsMonitor({ leads, onRefresh }: RealtimeLeadsMonitorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState(new Date());

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const leadsHoje      = leads.filter(l => new Date(l.created_at) >= todayStart);
    const semResposta24h = leads.filter(l => {
      const criado = new Date(l.created_at);
      return criado < h24ago &&
        (l.status === 'Lead Frio' || !l.lead_state || l.lead_state === 'NEW');
    });

    const trafficLeads    = leads.filter(l => l.tipo_origem === 'trafego');
    const convertidosHoje = leadsHoje.filter(l => CONVERTED_STATES.includes(l.lead_state || ''));
    const taxaHoje        = leadsHoje.length > 0 ? Math.round((convertidosHoje.length / leadsHoje.length) * 100) : 0;

    const sortedLeads = leads.length > 0
      ? leads.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b)
      : null;
    const ultimoLead = sortedLeads ? new Date(sortedLeads.created_at) : null;

    // Status resumido
    const statusMap: Record<string, number> = {};
    leads.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });
    const statusResumo = Object.entries(statusMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      total: leads.length,
      hoje: leadsHoje.length,
      semResposta24h: semResposta24h.length,
      taxaHoje,
      ultimoLead,
      statusResumo,
    };
  }, [leads]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setLastCheck(new Date());
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-card flex flex-col" style={{ border: '0.5px solid rgba(201,169,110,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ height: 3, background: '#3d2b1f' }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '0.5px solid rgba(201,169,110,0.12)' }}>
        <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(61,43,31,0.08)' }}>
          <Activity style={{ width: 16, height: 16, color: '#3d2b1f' }} />
        </div>
        <span className="text-sm font-semibold text-foreground flex-1">Monitor de Leads</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#16a34a' }}>
          <Wifi style={{ width: 11, height: 11 }} /> Online
        </span>
        <button onClick={handleRefresh} disabled={isRefreshing} className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#c9a96e]/10">
          <RefreshCw style={{ width: 13, height: 13, color: '#9ca3af' }} className={cn(isRefreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3 p-5 pb-3">
        {/* Total */}
        <div className="col-span-2 flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(61,43,31,0.04)' }}>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(61,43,31,0.08)' }}>
            <Users style={{ width: 18, height: 18, color: '#3d2b1f' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'inherit' }}>
              <AnimatedCounter value={stats.total} duration={800} />
            </p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Total de leads no CRM</p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>+{stats.hoje}</p>
            <p style={{ fontSize: 10, color: '#9ca3af' }}>hoje</p>
          </div>
        </div>

        {/* Sem resposta 24h */}
        <div className="p-3 rounded-xl" style={{ background: stats.semResposta24h > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(201,169,110,0.06)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle style={{ width: 13, height: 13, color: stats.semResposta24h > 0 ? '#dc2626' : '#9ca3af' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sem resposta +24h</span>
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: stats.semResposta24h > 0 ? '#dc2626' : '#3d2b1f', lineHeight: 1 }}>
            <AnimatedCounter value={stats.semResposta24h} duration={800} />
          </p>
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>leads aguardando</p>
        </div>

        {/* Taxa do dia */}
        <div className="p-3 rounded-xl" style={{ background: 'rgba(201,169,110,0.08)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Scale style={{ width: 13, height: 13, color: '#c9a96e' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Taxa hoje</span>
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#b8922a', lineHeight: 1 }}>
            {stats.taxaHoje}%
          </p>
          <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>conversão do dia</p>
        </div>
      </div>

      {/* Status resumido */}
      <div className="px-5 pb-4">
        <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Por status</p>
        <div className="space-y-2">
          {stats.statusResumo.map(([status, count]) => {
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const color = STATUS_COLORS[status] || '#94a3b8';
            return (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span style={{ fontSize: 11, color: '#6b7280', flex: 1 }} className="truncate">{status}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'inherit', minWidth: 24, textAlign: 'right' }}>{count}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(201,169,110,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-auto px-5 py-3 flex items-center justify-between" style={{ borderTop: '0.5px solid rgba(201,169,110,0.12)' }}>
        <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#9ca3af' }}>
          <CheckCircle style={{ width: 12, height: 12, color: '#16a34a' }} />
          {formatDistanceToNow(lastCheck, { addSuffix: true, locale: ptBR })}
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Realtime ativo</span>
      </div>
    </div>
  );
}
