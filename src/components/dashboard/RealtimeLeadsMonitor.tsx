import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Lead } from '@/types/leads';
import { 
  RefreshCw, 
  Users, 
  UserPlus, 
  Activity, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff
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

  // Calculate stats from leads
  const calculateStats = useCallback(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const leadsHoje = leads.filter(lead => new Date(lead.created_at) >= todayStart).length;
    const leadsUltima24h = leads.filter(lead => new Date(lead.created_at) >= yesterday).length;
    
    const sortedLeads = [...leads].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const ultimoLeadEntrou = sortedLeads.length > 0 ? new Date(sortedLeads[0].created_at) : null;

    setStats(prev => ({
      ...prev,
      totalLeads: leads.length,
      leadsHoje,
      leadsUltima24h,
      ultimoLeadEntrou
    }));
  }, [leads]);

  // Check for untracked leads in the database
  const checkUntrackedLeads = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('leads_juridicos')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Erro ao verificar leads não contabilizados:', error);
        return;
      }

      const dbCount = count || 0;
      const localCount = leads.length;
      const diff = dbCount - localCount;

      setStats(prev => ({
        ...prev,
        leadsNaoContabilizados: diff > 0 ? diff : 0
      }));

      if (diff > 0) {
        console.log(`⚠️ Detectados ${diff} leads não contabilizados no frontend`);
      }
    } catch (err) {
      console.error('Erro ao verificar leads:', err);
    }
  }, [leads.length]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await checkUntrackedLeads();
      if (onRefresh) {
        onRefresh();
      }
      setLastCheck(new Date());
      
      setRecentActivity(prev => [
        { type: 'refresh', time: new Date() },
        ...prev.slice(0, 4)
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Monitor realtime connection status
  useEffect(() => {
    const channel = supabase
      .channel('leads-monitor-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_juridicos' },
        (payload) => {
          const eventType = payload.eventType;
          const newLead = payload.new as Lead | undefined;
          
          setRecentActivity(prev => [
            { type: eventType, lead: newLead, time: new Date() },
            ...prev.slice(0, 4)
          ]);

          // Connection confirmed
          setStats(prev => ({ ...prev, connectionStatus: 'connected' }));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStats(prev => ({ ...prev, connectionStatus: 'connected' }));
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStats(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        } else {
          setStats(prev => ({ ...prev, connectionStatus: 'connecting' }));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Recalculate stats when leads change
  useEffect(() => {
    calculateStats();
  }, [leads, calculateStats]);

  // Periodic check for untracked leads
  useEffect(() => {
    checkUntrackedLeads();
    const interval = setInterval(checkUntrackedLeads, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [checkUntrackedLeads]);

  const getConnectionIcon = () => {
    switch (stats.connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-success" />;
      case 'connecting':
        return <Wifi className="w-4 h-4 text-amber-500 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-destructive" />;
    }
  };

  const getConnectionLabel = () => {
    switch (stats.connectionStatus) {
      case 'connected':
        return 'Tempo Real Ativo';
      case 'connecting':
        return 'Conectando...';
      case 'disconnected':
        return 'Desconectado';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'INSERT':
        return <UserPlus className="w-3 h-3 text-success" />;
      case 'UPDATE':
        return <Activity className="w-3 h-3 text-blue-500" />;
      case 'DELETE':
        return <AlertTriangle className="w-3 h-3 text-destructive" />;
      case 'refresh':
        return <RefreshCw className="w-3 h-3 text-primary" />;
      default:
        return <Activity className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <Card className="rounded-xl shadow-soft border border-border/50 overflow-hidden">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            Monitor de Leads em Tempo Real
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <Badge 
              variant={stats.connectionStatus === 'connected' ? 'default' : 'secondary'}
              className={cn(
                "flex items-center gap-1 text-xs",
                stats.connectionStatus === 'connected' && "bg-success/10 text-success hover:bg-success/20",
                stats.connectionStatus === 'disconnected' && "bg-destructive/10 text-destructive"
              )}
            >
              {getConnectionIcon()}
              <span className="hidden sm:inline">{getConnectionLabel()}</span>
            </Badge>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 px-2"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Warning for untracked leads */}
        {stats.leadsNaoContabilizados > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {stats.leadsNaoContabilizados} lead{stats.leadsNaoContabilizados > 1 ? 's' : ''} não contabilizado{stats.leadsNaoContabilizados > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-600/80">
                Clique em Atualizar para sincronizar
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleRefresh} className="border-amber-500/30 text-amber-700">
              Atualizar
            </Button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 text-center hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">
              <AnimatedCounter value={stats.totalLeads} duration={800} />
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>

          <div className="p-3 rounded-lg bg-success/10 text-center hover:bg-success/20 transition-colors">
            <div className="flex items-center justify-center gap-1 mb-1">
              <UserPlus className="w-4 h-4 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">
              <AnimatedCounter value={stats.leadsHoje} duration={800} />
            </p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 text-center hover:bg-blue-500/20 transition-colors">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600">
              <AnimatedCounter value={stats.leadsUltima24h} duration={800} />
            </p>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 text-center hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {stats.ultimoLeadEntrou 
                ? formatDistanceToNow(stats.ultimoLeadEntrou, { addSuffix: true, locale: ptBR })
                : '--'
              }
            </p>
            <p className="text-xs text-muted-foreground">Último Lead</p>
          </div>
        </div>

        {/* Recent Activity Feed */}
        {recentActivity.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Atividade Recente
            </p>
            <div className="space-y-1.5">
              {recentActivity.slice(0, 4).map((activity, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg bg-muted/20 text-xs",
                    index === 0 && "animate-fade-in"
                  )}
                >
                  {getActivityIcon(activity.type)}
                  <span className="flex-1 truncate">
                    {activity.type === 'INSERT' && (
                      <span>Novo lead: <strong>{activity.lead?.nome || 'Sem nome'}</strong></span>
                    )}
                    {activity.type === 'UPDATE' && (
                      <span>Lead atualizado: <strong>{activity.lead?.nome || 'Sem nome'}</strong></span>
                    )}
                    {activity.type === 'DELETE' && (
                      <span>Lead removido</span>
                    )}
                    {activity.type === 'refresh' && (
                      <span>Dados atualizados manualmente</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(activity.time, { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last check indicator */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-success" />
            <span>Última verificação: {formatDistanceToNow(lastCheck, { addSuffix: true, locale: ptBR })}</span>
          </div>
          <span>Atualização automática: 30s</span>
        </div>
      </CardContent>
    </Card>
  );
}
