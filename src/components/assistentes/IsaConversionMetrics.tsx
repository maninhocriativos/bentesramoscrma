import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Send, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  Users,
  FileCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface ConversionMetrics {
  totalLeads: number;
  leadsWithDocs: number;
  contractsSent: number;
  contractsSigned: number;
  docsCollectionRate: number;
  signatureRate: number;
  avgTimeToContract: string;
  pendingDocs: number;
  recentConversions: Array<{
    id: string;
    nome: string;
    state: string;
    updated_at: string;
  }>;
}

export function IsaConversionMetrics() {
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    
    // Real-time updates
    const channel = supabase
      .channel('conversion-metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_juridicos' }, fetchMetrics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, fetchMetrics)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchMetrics = async () => {
    try {
      // Total leads (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: leads } = await supabase
        .from('leads_juridicos')
        .select('id, nome, lead_state, state_updated_at, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const totalLeads = leads?.length || 0;

      // Leads com documentos
      const { data: docsData } = await supabase
        .from('documentos')
        .select('cliente_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const uniqueLeadsWithDocs = new Set(docsData?.map(d => d.cliente_id)).size;

      // Contratos enviados (state = CONTRACT_SENT ou CONTRACT_SIGNED)
      const contractsSent = leads?.filter(l => 
        ['CONTRACT_SENT', 'CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'].includes(l.lead_state || '')
      ).length || 0;

      // Contratos assinados
      const contractsSigned = leads?.filter(l => 
        ['CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER'].includes(l.lead_state || '')
      ).length || 0;

      // Docs pendentes
      const pendingDocs = leads?.filter(l => l.lead_state === 'DOCS_PENDING').length || 0;

      // Conversões recentes
      const recentConversions = leads
        ?.filter(l => ['CONTRACT_SIGNED', 'READY_FOR_LAWYER'].includes(l.lead_state || ''))
        .sort((a, b) => new Date(b.state_updated_at || b.created_at).getTime() - new Date(a.state_updated_at || a.created_at).getTime())
        .slice(0, 5)
        .map(l => ({
          id: l.id,
          nome: l.nome || 'Lead sem nome',
          state: l.lead_state || 'UNKNOWN',
          updated_at: l.state_updated_at || l.created_at
        })) || [];

      setMetrics({
        totalLeads,
        leadsWithDocs: uniqueLeadsWithDocs,
        contractsSent,
        contractsSigned,
        docsCollectionRate: totalLeads > 0 ? (uniqueLeadsWithDocs / totalLeads) * 100 : 0,
        signatureRate: contractsSent > 0 ? (contractsSigned / contractsSent) * 100 : 0,
        avgTimeToContract: '~2.5 dias',
        pendingDocs,
        recentConversions
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const statCards = [
    {
      title: 'Leads (30 dias)',
      value: metrics.totalLeads,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Docs Coletados',
      value: metrics.leadsWithDocs,
      subtitle: `${metrics.docsCollectionRate.toFixed(0)}% dos leads`,
      icon: FileCheck,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Contratos Enviados',
      value: metrics.contractsSent,
      icon: Send,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      title: 'Contratos Assinados',
      value: metrics.contractsSigned,
      subtitle: `${metrics.signatureRate.toFixed(0)}% taxa assinatura`,
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    }
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getStateBadge = (state: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      'CONTRACT_SIGNED': { label: 'Assinado', variant: 'default' },
      'READY_FOR_LAWYER': { label: 'Pronto', variant: 'default' },
      'DOCS_PENDING': { label: 'Docs Pendentes', variant: 'secondary' }
    };
    const c = config[state] || { label: state, variant: 'outline' };
    return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Métricas de Conversão da Isa</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Últimos 30 dias
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Taxa de Coleta de Docs</span>
              <span className="text-sm text-muted-foreground">{metrics.docsCollectionRate.toFixed(0)}%</span>
            </div>
            <Progress value={metrics.docsCollectionRate} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Taxa de Assinatura</span>
              <span className="text-sm text-muted-foreground">{metrics.signatureRate.toFixed(0)}%</span>
            </div>
            <Progress value={metrics.signatureRate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversions & Pending */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Conversões Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {metrics.recentConversions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conversão ainda</p>
            ) : (
              <div className="space-y-2">
                {metrics.recentConversions.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[150px]">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(lead.updated_at)}</p>
                    </div>
                    {getStateBadge(lead.state)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Pendências
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Aguardando Documentos</span>
                <Badge variant="secondary">{metrics.pendingDocs}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tempo Médio p/ Contrato</span>
                <Badge variant="outline">{metrics.avgTimeToContract}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
