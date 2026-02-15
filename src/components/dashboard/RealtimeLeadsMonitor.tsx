import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/types/leads';
import { 
  RefreshCw, Users, UserPlus, Activity, Clock, TrendingUp,
  AlertTriangle, CheckCircle, Wifi, WifiOff
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface RealtimeLeadsMonitorProps {
  leads: Lead[];
  onRefresh?: () => void;
}

interface RealtimeStats {
  totalLeads: number;
  leadsHoje: number;
  leadsUltima24h: number;
  ultimoLeadEntrou: Date | null;
  leadsNaoContabilizados: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

export function RealtimeLeadsMonitor({ leads, onRefresh }: RealtimeLeadsMonitorProps) {
  const [stats, setStats] = useState<RealtimeStats>({
    totalLeads: leads.length,
    leadsHoje: 0,
    leadsUltima24h: 0,
    ultimoLeadEntrou: null,
    leadsNaoContabilizados: 0,
    connectionStatus: 'connecting'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [recentActivity, setRecentActivity] = useState<{ type: string; lead?: Lead; time: Date }[]>([]);

  const calculateStats = useCallback(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const leadsHoje = leads.filter(lead => new Date(lead.created_at) >= todayStart).length;
    const leadsUltima24h = leads.filter(lead => new Date(lead.created_at) >= yesterday).length;
    const sortedLeads = [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const ultimoLeadEntrou = sortedLeads.length > 0 ? new Date(sortedLeads[0].created_at) : null;
    setStats(prev => ({ ...prev, totalLeads: leads.length, leadsHoje, leadsUltima24h, ultimoLeadEntrou }));
  }, [leads]);

  const checkUntrackedLeads = useCallback(async () => {
    try {
      const { count, error } = await supabase.from('leads_juridicos').select('*', { count: 'exact', head: true });
      if (error) return;
      const diff = (count || 0) - leads.length;
      setStats(prev => ({ ...prev, leadsNaoContabilizados: diff > 0 ? diff : 0 }));
    } catch {}
  }, [leads.length]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkUntrackedLeads();
      onRefresh?.();
      setLastCheck(new Date());
      setRecentActivity(prev => [{ type: 'refresh', time: new Date() }, ...prev.slice(0, 4)]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('leads-monitor-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_juridicos' }, (payload) => {
        setRecentActivity(prev => [{ type: payload.eventType, lead: payload.new as Lead, time: new Date() }, ...prev.slice(0, 4)]);
        setStats(prev => ({ ...prev, connectionStatus: 'connected' }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStats(prev => ({ ...prev, connectionStatus: 'connected' }));
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setStats(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        else setStats(prev => ({ ...prev, connectionStatus: 'connecting' }));
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { calculateStats(); }, [leads, calculateStats]);
  useEffect(() => { checkUntrackedLeads(); const i = setInterval(checkUntrackedLeads, 30000); return () => clearInterval(i); }, [checkUntrackedLeads]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'INSERT': return <UserPlus className="w-3 h-3 text-[hsl(var(--success))]" />;
      case 'UPDATE': return <Activity className="w-3 h-3 text-blue-500" />;
      case 'DELETE': return <AlertTriangle className="w-3 h-3 text-destructive" />;
      case 'refresh': return <RefreshCw className="w-3 h-3 text-primary" />;
      default: return <Activity className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <Card className="rounded-2xl border-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="h-1 w-full bg-primary" />
      <CardHeader className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            Monitor de Leads
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary"
              className={cn(
                "flex items-center gap-1 text-[10px] h-6 px-2",
                stats.connectionStatus === 'connected' && "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
                stats.connectionStatus === 'disconnected' && "bg-destructive/10 text-destructive"
              )}
            >
              {stats.connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : stats.connectionStatus === 'disconnected' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3 animate-pulse" />}
              <span className="hidden sm:inline">{stats.connectionStatus === 'connected' ? 'Online' : stats.connectionStatus === 'disconnected' ? 'Offline' : '...'}</span>
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-7 w-7 p-0">
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-5 pb-5 space-y-4">
        {stats.leadsNaoContabilizados > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 flex-1">
              {stats.leadsNaoContabilizados} lead{stats.leadsNaoContabilizados > 1 ? 's' : ''} não contabilizado{stats.leadsNaoContabilizados > 1 ? 's' : ''}
            </p>
            <Button size="sm" variant="outline" onClick={handleRefresh} className="h-7 text-[10px] border-amber-500/30 text-amber-700 px-2">
              Sync
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-muted/30 text-center">
            <Users className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold"><AnimatedCounter value={stats.totalLeads} duration={800} /></p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="p-3 rounded-xl bg-[hsl(var(--success))]/8 text-center">
            <UserPlus className="w-4 h-4 text-[hsl(var(--success))] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[hsl(var(--success))]"><AnimatedCounter value={stats.leadsHoje} duration={800} /></p>
            <p className="text-[10px] text-muted-foreground">Hoje</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/8 text-center">
            <TrendingUp className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-600"><AnimatedCounter value={stats.leadsUltima24h} duration={800} /></p>
            <p className="text-[10px] text-muted-foreground">24h</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 text-center">
            <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium mt-0.5">
              {stats.ultimoLeadEntrou 
                ? formatDistanceToNow(stats.ultimoLeadEntrou, { addSuffix: true, locale: ptBR })
                : '--'
              }
            </p>
            <p className="text-[10px] text-muted-foreground">Último</p>
          </div>
        </div>

        {recentActivity.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Atividade</p>
            {recentActivity.slice(0, 3).map((activity, index) => (
              <div key={index} className={cn("flex items-center gap-2 p-2 rounded-lg bg-muted/20 text-xs", index === 0 && "animate-fade-in")}>
                {getActivityIcon(activity.type)}
                <span className="flex-1 truncate">
                  {activity.type === 'INSERT' && <span>Novo: <strong>{activity.lead?.nome || 'Sem nome'}</strong></span>}
                  {activity.type === 'UPDATE' && <span>Atualizado: <strong>{activity.lead?.nome || 'Sem nome'}</strong></span>}
                  {activity.type === 'DELETE' && <span>Removido</span>}
                  {activity.type === 'refresh' && <span>Sincronização manual</span>}
                </span>
                <span className="text-muted-foreground text-[10px]">{formatDistanceToNow(activity.time, { addSuffix: true, locale: ptBR })}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-[hsl(var(--success))]" />
            {formatDistanceToNow(lastCheck, { addSuffix: true, locale: ptBR })}
          </span>
          <span>Auto: 30s</span>
        </div>
      </CardContent>
    </Card>
  );
}
