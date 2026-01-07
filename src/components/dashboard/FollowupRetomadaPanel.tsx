import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageCircle, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Users
} from 'lucide-react';

interface FollowupStats {
  // Follow-up inicial (10min, 1h, 24h)
  aguardando_followup_1: number;
  aguardando_followup_2: number;
  aguardando_followup_3: number;
  followup_concluido: number;
  
  // Retomada (24h, 48h, 6 dias após follow-up)
  aguardando_retomada_1: number;
  aguardando_retomada_2: number;
  aguardando_retomada_3: number;
  retomada_concluida: number;
  
  // Geral
  total_leads_frios: number;
  responderam: number;
}

export function FollowupRetomadaPanel() {
  const [stats, setStats] = useState<FollowupStats>({
    aguardando_followup_1: 0,
    aguardando_followup_2: 0,
    aguardando_followup_3: 0,
    followup_concluido: 0,
    aguardando_retomada_1: 0,
    aguardando_retomada_2: 0,
    aguardando_retomada_3: 0,
    retomada_concluida: 0,
    total_leads_frios: 0,
    responderam: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    
    try {
      // Buscar todos os followups com status do lead
      const { data: followups, error } = await supabase
        .from('lead_followups')
        .select(`
          *,
          leads_juridicos!inner(id, nome, status)
        `);

      if (error) throw error;

      // Buscar eventos de retomada
      const { data: retomadaEvents } = await supabase
        .from('system_events')
        .select('lead_id, acao')
        .eq('tipo', 'retomada')
        .in('acao', ['retomada_1_enviado', 'retomada_2_enviado', 'retomada_3_enviado']);

      // Mapear retomadas por lead
      const retomadaPorLead: Record<string, Set<string>> = {};
      retomadaEvents?.forEach(e => {
        if (e.lead_id) {
          if (!retomadaPorLead[e.lead_id]) {
            retomadaPorLead[e.lead_id] = new Set();
          }
          retomadaPorLead[e.lead_id].add(e.acao);
        }
      });

      const newStats: FollowupStats = {
        aguardando_followup_1: 0,
        aguardando_followup_2: 0,
        aguardando_followup_3: 0,
        followup_concluido: 0,
        aguardando_retomada_1: 0,
        aguardando_retomada_2: 0,
        aguardando_retomada_3: 0,
        retomada_concluida: 0,
        total_leads_frios: 0,
        responderam: 0,
      };

      followups?.forEach((f: any) => {
        const lead = f.leads_juridicos;
        const leadId = lead.id;
        
        // Contagem geral
        if (lead.status === 'Lead Frio') {
          newStats.total_leads_frios++;
        }
        
        if (f.respondido) {
          newStats.responderam++;
          return;
        }

        // Follow-up inicial
        if (!f.followup_1_enviado) {
          newStats.aguardando_followup_1++;
        } else if (!f.followup_2_enviado) {
          newStats.aguardando_followup_2++;
        } else if (!f.followup_3_enviado) {
          newStats.aguardando_followup_3++;
        } else if (f.status === 'concluido' && lead.status === 'Lead Frio') {
          // Follow-up concluído, verificar retomada
          newStats.followup_concluido++;
          
          const retomadas = retomadaPorLead[leadId] || new Set();
          
          if (!retomadas.has('retomada_1_enviado')) {
            newStats.aguardando_retomada_1++;
          } else if (!retomadas.has('retomada_2_enviado')) {
            newStats.aguardando_retomada_2++;
          } else if (!retomadas.has('retomada_3_enviado')) {
            newStats.aguardando_retomada_3++;
          } else {
            newStats.retomada_concluida++;
          }
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const followupSteps = [
    { label: '10 min', value: stats.aguardando_followup_1, color: 'bg-blue-500' },
    { label: '1 hora', value: stats.aguardando_followup_2, color: 'bg-blue-400' },
    { label: '24h', value: stats.aguardando_followup_3, color: 'bg-blue-300' },
  ];

  const retomadaSteps = [
    { label: '24h', value: stats.aguardando_retomada_1, color: 'bg-amber-500' },
    { label: '48h', value: stats.aguardando_retomada_2, color: 'bg-amber-400' },
    { label: '6 dias', value: stats.aguardando_retomada_3, color: 'bg-amber-300' },
  ];

  return (
    <Card className="bg-card border-border/50 shadow-soft">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Automação de Leads Frios
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
          onClick={fetchStats}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo Geral */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-foreground">{stats.total_leads_frios}</p>
            <p className="text-xs text-muted-foreground">Leads Frios</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-success/10">
            <p className="text-2xl font-bold text-success">{stats.responderam}</p>
            <p className="text-xs text-muted-foreground">Responderam</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/10">
            <p className="text-2xl font-bold text-primary">{stats.followup_concluido}</p>
            <p className="text-xs text-muted-foreground">Em Retomada</p>
          </div>
        </div>

        {/* Follow-up Inicial */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-foreground">Follow-up Inicial</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              10min → 1h → 24h
            </Badge>
          </div>
          <div className="flex gap-2">
            {followupSteps.map((step, i) => (
              <div key={i} className="flex-1">
                <div className={`h-2 rounded-full ${step.color} opacity-80`} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{step.label}</span>
                  <span className="text-xs font-semibold">{step.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retomada */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-foreground">Retomada</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              24h → 48h → 6 dias
            </Badge>
          </div>
          <div className="flex gap-2">
            {retomadaSteps.map((step, i) => (
              <div key={i} className="flex-1">
                <div className={`h-2 rounded-full ${step.color} opacity-80`} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{step.label}</span>
                  <span className="text-xs font-semibold">{step.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Final */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="text-xs text-muted-foreground">Retomada concluída:</span>
          </div>
          <Badge className="bg-muted text-foreground">
            {stats.retomada_concluida}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
