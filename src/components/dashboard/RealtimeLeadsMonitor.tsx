import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lead } from '@/types/leads';
import { 
  RefreshCw, Users, UserPlus, Activity, Clock, TrendingUp,
  CheckCircle, Wifi
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface RealtimeLeadsMonitorProps {
  leads: Lead[];
  onRefresh?: () => void;
}

export function RealtimeLeadsMonitor({ leads, onRefresh }: RealtimeLeadsMonitorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  // Compute stats directly from leads prop (no extra subscription needed)
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const leadsHoje = leads.filter(lead => new Date(lead.created_at) >= todayStart).length;
    const leadsUltima24h = leads.filter(lead => new Date(lead.created_at) >= yesterday).length;
    const sortedLeads = leads.length > 0
      ? leads.reduce((latest, l) => new Date(l.created_at) > new Date(latest.created_at) ? l : latest)
      : null;
    const ultimoLeadEntrou = sortedLeads ? new Date(sortedLeads.created_at) : null;

    return { totalLeads: leads.length, leadsHoje, leadsUltima24h, ultimoLeadEntrou };
  }, [leads]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      onRefresh?.();
      setLastCheck(new Date());
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
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
              className="flex items-center gap-1 text-[10px] h-6 px-2 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
            >
              <Wifi className="w-3 h-3" />
              <span className="hidden sm:inline">Online</span>
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-7 w-7 p-0">
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-5 pb-5 space-y-4">
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
          <div className="p-3 rounded-xl bg-[hsl(var(--gold))]/10 text-center">
            <TrendingUp className="w-4 h-4 text-[hsl(var(--gold))] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[hsl(var(--gold))]"><AnimatedCounter value={stats.leadsUltima24h} duration={800} /></p>
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

        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-[hsl(var(--success))]" />
            {formatDistanceToNow(lastCheck, { addSuffix: true, locale: ptBR })}
          </span>
          <span>Realtime ativo</span>
        </div>
      </CardContent>
    </Card>
  );
}
