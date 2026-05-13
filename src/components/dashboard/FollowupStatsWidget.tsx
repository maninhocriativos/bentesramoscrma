import { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Clock, CheckCircle2, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowupStats {
  pipeline_ativo: number;
  em_andamento: number;
  aguardando_optin: number;
  convertidos_automacao: number;
}

function StatRow({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-bold tabular-nums text-foreground">{value.toLocaleString('pt-BR')}</span>
    </div>
  );
}

function FollowupStatsWidget() {
  const [stats, setStats] = useState<FollowupStats>({ pipeline_ativo: 0, em_andamento: 0, aguardando_optin: 0, convertidos_automacao: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const [
        { count: pipeline_ativo },
        { count: em_andamento },
        { count: aguardando_optin },
        { count: convertidos_automacao },
      ] = await Promise.all([
        supabase.from('traffic_followups').select('id', { count: 'exact', head: true }).eq('automation_active', true),
        supabase.from('traffic_followups').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('followup_nutricao').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        // Leads de tráfego que converteram (Ganho ou Contrato Assinado)
        supabase.from('leads_juridicos')
          .select('id', { count: 'exact', head: true })
          .eq('tipo_origem', 'trafego')
          .in('status', ['Ganho', 'Contrato Assinado']),
      ]);
      setStats({
        pipeline_ativo:        pipeline_ativo        || 0,
        em_andamento:          em_andamento          || 0,
        aguardando_optin:      aguardando_optin      || 0,
        convertidos_automacao: convertidos_automacao || 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-2xl border border-[#c9a96e]/15 bg-card shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col">
      {/* Header */}
      <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-2xl" />
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Follow-up Automático</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Pipeline de reativação</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Stats */}
      <div className="px-5 pb-5 flex-1">
        {loading ? (
          <div className="space-y-2.5 pt-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
                  <div className="h-3.5 w-28 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-3.5 w-8 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <StatRow icon={Users}         label="No pipeline ativo"     value={stats.pipeline_ativo}       color="bg-blue-50 text-blue-600" />
            <StatRow icon={MessageSquare} label="Em andamento"           value={stats.em_andamento}         color="bg-indigo-50 text-indigo-600" />
            <StatRow icon={Clock}         label="Aguardando reativação"  value={stats.aguardando_optin}     color="bg-amber-50 text-amber-600" />
            <StatRow icon={CheckCircle2}  label="Convertidos (automação)" value={stats.convertidos_automacao} color="bg-emerald-50 text-emerald-600" />
          </>
        )}
      </div>
    </div>
  );
}

export default memo(FollowupStatsWidget);
