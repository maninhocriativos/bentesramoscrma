import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContratosKPIs } from '@/components/contratos/ContratosKPIs';
import { ContratosTable } from '@/components/contratos/ContratosTable';
import { ModelosContratos } from '@/components/contratos/ModelosContratos';
import { useLeads } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ContratoComStatus {
  id: string;
  leadId: string;
  leadNome: string;
  leadEmail: string | null;
  tipoAcao: string | null;
  linkContrato: string;
  status: string;
  lastUpdate: string | null;
}

export default function ContratosPage() {
  const { leads, loading: leadsLoading } = useLeads();
  const { toast } = useToast();
  const [contratos, setContratos] = useState<ContratoComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('todos');

  const leadsComContrato = leads.filter(lead => lead.link_contrato);

  const fetchContractStatuses = useCallback(async (showLoading = true) => {
    if (leadsComContrato.length === 0) {
      setLoading(false);
      setContratos([]);
      return;
    }

    if (showLoading) setLoading(true);
    const contractsWithStatus: ContratoComStatus[] = [];

    const leadIds = leadsComContrato.map(lead => lead.id);
    
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

    for (const lead of leadsComContrato) {
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
        id: `${lead.id}-contract`,
        leadId: lead.id,
        leadNome: lead.nome || 'Sem nome',
        leadEmail: lead.email,
        tipoAcao: lead.tipo_acao,
        linkContrato: lead.link_contrato!,
        status,
        lastUpdate,
      });
    }

    // Sort: pending first
    contractsWithStatus.sort((a, b) => {
      const pendingStatuses = ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'];
      const aIsPending = pendingStatuses.includes(a.status);
      const bIsPending = pendingStatuses.includes(b.status);
      
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      
      if (a.lastUpdate && b.lastUpdate) {
        return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
      }
      return 0;
    });

    setContratos(contractsWithStatus);
    setLoading(false);
  }, [leadsComContrato]);

  useEffect(() => {
    if (!leadsLoading) {
      fetchContractStatuses();
    }
  }, [leads, leadsLoading]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('contracts-page-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interacoes',
        },
        (payload) => {
          const resumo = payload.new?.resumo as string;
          if (payload.new?.tipo === 'Documento' && resumo?.startsWith('Contrato:')) {
            toast({
              title: 'Atualização de contrato',
              description: resumo,
            });
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
          if (payload.new?.link_contrato !== payload.old?.link_contrato) {
            fetchContractStatuses(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContractStatuses, toast]);

  const filteredContratos = contratos.filter(contrato => {
    switch (activeTab) {
      case 'em-processo':
        return ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(contrato.status);
      case 'finalizados':
        return ['Assinado', 'Finalizado'].includes(contrato.status);
      case 'cancelados':
        return ['Cancelado', 'Recusado', 'Prazo Expirado'].includes(contrato.status);
      default:
        return true;
    }
  });

  const kpiData = {
    emProcesso: contratos.filter(c => ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(c.status)).length,
    recusados: contratos.filter(c => c.status === 'Recusado').length,
    finalizados: contratos.filter(c => ['Assinado', 'Finalizado'].includes(c.status)).length,
    cancelados: contratos.filter(c => ['Cancelado', 'Prazo Expirado'].includes(c.status)).length,
    total: contratos.length,
  };

  const isLoading = leadsLoading || loading;

  return (
    <AppLayout>
      <AppHeader title="Contratos" />
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 space-y-6 animate-fade-in overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ContratosKPIs data={kpiData} onRefresh={() => fetchContractStatuses(false)} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="todos">Todos ({contratos.length})</TabsTrigger>
                <TabsTrigger value="em-processo">Em Processo ({kpiData.emProcesso})</TabsTrigger>
                <TabsTrigger value="finalizados">Finalizados ({kpiData.finalizados})</TabsTrigger>
                <TabsTrigger value="cancelados">Cancelados ({kpiData.cancelados})</TabsTrigger>
                <TabsTrigger value="modelos">Modelos</TabsTrigger>
              </TabsList>

              <TabsContent value="todos">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="em-processo">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="finalizados">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="cancelados">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="modelos">
                <ModelosContratos />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
