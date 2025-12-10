import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSignature, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Lead } from '@/types/leads';
import { useToast } from '@/hooks/use-toast';

interface ContractWithStatus {
  lead: Lead;
  status: string;
  lastUpdate: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'Documento Enviado': { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: <FileSignature className="h-3.5 w-3.5" /> },
  'Aguardando Assinatura': { label: 'Aguardando', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3.5 w-3.5" /> },
  'Assinatura Parcial': { label: 'Parcial', color: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  'Assinado': { label: 'Assinado', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Finalizado': { label: 'Finalizado', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Prazo Expirado': { label: 'Expirado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3.5 w-3.5" /> },
  'Cancelado': { label: 'Cancelado', color: 'bg-gray-100 text-gray-700', icon: <XCircle className="h-3.5 w-3.5" /> },
  'Recusado': { label: 'Recusado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3.5 w-3.5" /> },
};

interface ContractsPendingWidgetProps {
  leads: Lead[];
}

export function ContractsPendingWidget({ leads }: ContractsPendingWidgetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<ContractWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter leads that have link_contrato
  const leadsWithContract = leads.filter(lead => lead.link_contrato);

  const fetchContractStatuses = useCallback(async (showLoading = true) => {
    if (leadsWithContract.length === 0) {
      setLoading(false);
      setContracts([]);
      return;
    }

    if (showLoading) setLoading(true);
    const contractsWithStatus: ContractWithStatus[] = [];

    // Fetch interactions for all leads with contracts
    const leadIds = leadsWithContract.map(lead => lead.id);
    
    const { data: interactions, error } = await supabase
      .from('interacoes')
      .select('cliente_id, resumo, created_at')
      .in('cliente_id', leadIds)
      .eq('tipo', 'Documento')
      .ilike('resumo', 'Contrato:%')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contract statuses:', error);
      setLoading(false);
      return;
    }

    // Map interactions to leads
    for (const lead of leadsWithContract) {
      const leadInteraction = interactions?.find(i => i.cliente_id === lead.id);
      let status = 'Aguardando Assinatura';
      let lastUpdate = null;

      if (leadInteraction) {
        const statusMatch = leadInteraction.resumo.match(/Contrato:\s*(.+)/);
        if (statusMatch) {
          status = statusMatch[1].trim();
        }
        lastUpdate = leadInteraction.created_at;
      }

      contractsWithStatus.push({
        lead,
        status,
        lastUpdate,
      });
    }

    // Sort: pending first, then by last update
    contractsWithStatus.sort((a, b) => {
      const pendingStatuses = ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'];
      const aIsPending = pendingStatuses.includes(a.status);
      const bIsPending = pendingStatuses.includes(b.status);
      
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      
      // Then by last update
      if (a.lastUpdate && b.lastUpdate) {
        return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
      }
      return 0;
    });

    setContracts(contractsWithStatus);
    setLoading(false);
  }, [leadsWithContract]);

  // Initial fetch
  useEffect(() => {
    fetchContractStatuses();
  }, [leads]);

  // Real-time subscription for contract status updates
  useEffect(() => {
    const channel = supabase
      .channel('contracts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interacoes',
        },
        (payload) => {
          console.log('New interaction received:', payload);
          // Check if it's a contract-related interaction
          const resumo = payload.new?.resumo as string;
          if (payload.new?.tipo === 'Documento' && resumo?.startsWith('Contrato:')) {
            toast({
              title: 'Atualização de contrato',
              description: resumo,
            });
            // Refresh contract statuses
            fetchContractStatuses(false);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads_juridicos',
        },
        (payload) => {
          // Check if link_contrato was updated
          if (payload.new?.link_contrato !== payload.old?.link_contrato) {
            console.log('Contract link updated:', payload);
            fetchContractStatuses(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContractStatuses, toast]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchContractStatuses(false);
    setRefreshing(false);
    toast({
      title: 'Atualizado',
      description: 'Status dos contratos atualizados.',
    });
  };

  const pendingCount = contracts.filter(c => 
    ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(c.status)
  ).length;

  const signedCount = contracts.filter(c => 
    ['Assinado', 'Finalizado'].includes(c.status)
  ).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-purple-600" />
            Contratos para Assinatura
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {pendingCount} pendentes
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {signedCount} assinados
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum contrato vinculado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Vincule contratos aos leads na página de detalhes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.slice(0, 5).map((contract) => {
              const config = statusConfig[contract.status] || statusConfig['Aguardando Assinatura'];
              
              return (
                <div
                  key={contract.lead.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/leads/${contract.lead.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {contract.lead.nome || 'Sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contract.lead.tipo_acao || 'Tipo não definido'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge className={`${config.color} flex items-center gap-1 text-xs`}>
                      {config.icon}
                      {config.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
            
            {contracts.length > 5 && (
              <Button
                variant="ghost"
                className="w-full mt-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/leads')}
              >
                Ver todos os {contracts.length} contratos
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
